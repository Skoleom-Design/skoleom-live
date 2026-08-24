import { Injectable, UnauthorizedException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { User } from '../users/user.entity';
import { LoginLog } from './login-log.entity';
import { UserPlan } from '../../../shared/types/entities';
import { MonetizerService } from '../integrations/monetizer.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_SCOPE = 'openid email profile';

@Injectable()
export class AuthService {
  private readonly stateJwt: JwtService;

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(LoginLog)
    private loginLogsRepo: Repository<LoginLog>,
    private jwtService: JwtService,
    private monetizerService: MonetizerService,
  ) {
    // Meme principe que InstagramService : JWT dedie de courte duree pour securiser `state`
    // sans avoir a le stocker cote serveur entre la redirection vers Google et le retour.
    this.stateJwt = new JwtService({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: '15m' },
    });
  }

  // Un seul appareil connecté a la fois : chaque login regenere ce marqueur et l'embarque dans
  // le JWT — voir JwtStrategy.validate, qui rejette tout jeton dont le sessionId ne correspond
  // plus (superseded par une connexion plus recente sur un autre appareil).
  private async issueSession(userId: string, role: string): Promise<string> {
    const sessionId = randomUUID();
    await this.usersRepo.update(userId, { currentSessionId: sessionId });
    return this.jwtService.sign({ sub: userId, role, sessionId });
  }

  async register(email: string, username: string, password: string, plan?: UserPlan) {
    const exists = await this.usersRepo.findOne({ where: [{ email }, { username }] });
    if (exists) throw new ConflictException('Email or username already taken');

    const hashed = await bcrypt.hash(password, 12);
    const user = this.usersRepo.create({ email, username, password: hashed, plan });
    const saved = await this.usersRepo.save(user);

    // Provisionnement du compte Monetizer en tache de fond — jamais bloquant, jamais fatal :
    // voir MonetizerService pour le detail (mot de passe genere, jamais celui de l'utilisateur).
    this.monetizerService.createAccount(email, username)
      .then((monetizerUserId) => {
        if (monetizerUserId) this.usersRepo.update(saved.id, { monetizerUserId });
      });

    const { password: _, ...result } = saved;
    return { user: result, token: await this.issueSession(saved.id, saved.role) };
  }

  // Best-effort — n'a jamais le droit de faire echouer une connexion reussie (visible seulement
  // dans le detail utilisateur admin, voir AdminService.getUserDetail).
  private recordLogin(userId: string, ip?: string, userAgent?: string): void {
    this.loginLogsRepo.save(this.loginLogsRepo.create({ userId, ip, userAgent })).catch(() => {});
  }

  async login(identifier: string, password: string, ip?: string, userAgent?: string) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :identifier OR user.username = :identifier', { identifier })
      .getOne();
    // user.password est nul pour un compte cree via Google — jamais de match, pas de crash bcrypt.
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password: _, ...result } = user;
    this.recordLogin(user.id, ip, userAgent);
    return { user: result, token: await this.issueSession(user.id, user.role) };
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepo.update(userId, { currentSessionId: null as unknown as string });
  }

  // GOOGLE_REDIRECT_URI est exige explicitement (pas de fallback localhost) — un ancien bug
  // envoyait silencieusement Google vers "http://localhost:3000/..." quand cette variable
  // n'etait pas configuree sur Render, redirigeant le navigateur de vrais utilisateurs vers la
  // machine locale de dev au lieu du domaine public. Mieux vaut echouer bruyamment ici.
  private assertGoogleConfigured() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new ServiceUnavailableException(
        "La connexion Google n'est pas configurée sur ce serveur (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI manquants).",
      );
    }
  }

  private googleRedirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI!;
  }

  getGoogleAuthUrl(): string {
    this.assertGoogleConfigured();
    const state = this.stateJwt.sign({ purpose: 'google_oauth' });
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: this.googleRedirectUri(),
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      state,
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  // Un compte Google peut deja exister (googleId), correspondre a un compte email/mot de passe
  // deja cree (email identique — on lie googleId a ce compte), ou etre entierement nouveau.
  private async findOrCreateGoogleUser(profile: { googleId: string; email: string; name?: string; picture?: string }): Promise<User> {
    let user = await this.usersRepo.findOne({ where: { googleId: profile.googleId } });
    if (user) return user;

    user = await this.usersRepo.findOne({ where: { email: profile.email } });
    if (user) {
      await this.usersRepo.update(user.id, { googleId: profile.googleId });
      user.googleId = profile.googleId;
      return user;
    }

    const username = await this.generateUsernameFromEmail(profile.email);
    const created = this.usersRepo.create({
      email: profile.email,
      username,
      googleId: profile.googleId,
      displayName: profile.name,
      avatarUrl: profile.picture,
    });
    return this.usersRepo.save(created);
  }

  // register() rejette un pseudo deja pris — ici il n'y a personne a qui demander d'en choisir
  // un autre, donc on en derive un depuis l'email et on ajoute un suffixe si besoin.
  private async generateUsernameFromEmail(email: string): Promise<string> {
    const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'user';
    let candidate = base;
    let suffix = 0;
    while (await this.usersRepo.findOne({ where: { username: candidate } })) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    return candidate;
  }

  // Chemins RELATIFS (pas d'URL absolue construite depuis FRONTEND_URL) — cette route est
  // toujours atteinte via le domaine public (Google y redirige directement), donc le navigateur
  // resout deja "/auth/..." par rapport a ce meme domaine. Un ancien bug utilisait
  // `${process.env.FRONTEND_URL || 'http://localhost:3001'}/...` : si FRONTEND_URL etait mal
  // configuree (ou absente) sur Render, ca renvoyait de vrais utilisateurs prod vers localhost.
  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
    oauthError: string | undefined,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    if (oauthError || !code || !state) {
      return '/auth/login?googleError=1';
    }

    try {
      const payload = this.stateJwt.verify(state) as { purpose: string };
      if (payload.purpose !== 'google_oauth') throw new Error('invalid purpose');
    } catch {
      return '/auth/login?googleError=1';
    }

    try {
      this.assertGoogleConfigured();

      const tokenRes = await axios.post(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: 'authorization_code',
          redirect_uri: this.googleRedirectUri(),
          code,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const accessToken = tokenRes.data.access_token as string;

      const userinfo = await axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const { sub, email, name, picture } = userinfo.data as { sub: string; email: string; name?: string; picture?: string };
      if (!email) return '/auth/login?googleError=1';

      const user = await this.findOrCreateGoogleUser({ googleId: sub, email, name, picture });
      const { password: _, ...result } = user;
      this.recordLogin(user.id, ip, userAgent);
      const token = await this.issueSession(user.id, user.role);
      const payloadB64 = Buffer.from(JSON.stringify({ user: result, token })).toString('base64url');

      return `/auth/google-callback?data=${payloadB64}`;
    } catch {
      return '/auth/login?googleError=1';
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { password: _, ...result } = user;
    return result;
  }
}
