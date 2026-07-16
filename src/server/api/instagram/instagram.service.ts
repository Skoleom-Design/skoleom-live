import {
  Injectable, BadRequestException, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { User } from '../users/user.entity';
import { PostsService } from '../posts/posts.service';
import { FilesService } from '../files/files.service';
import { PostType } from '../../../shared/types/entities';

const IG_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH_URL = 'https://graph.instagram.com';
const IG_SCOPE = 'instagram_business_basic';
const MEDIA_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

export interface InstagramMediaDto {
  id: string;
  caption?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
}

interface RawIgMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  children?: { data: { id: string; media_url: string; media_type: 'IMAGE' | 'VIDEO' }[] };
}

@Injectable()
export class InstagramService {
  private readonly stateJwt: JwtService;

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private postsService: PostsService,
    private filesService: FilesService,
  ) {
    // Instance JWT dediee, courte duree de vie — sert uniquement a securiser le parametre `state`
    // du flow OAuth (evite d'avoir a stocker un etat cote serveur entre la redirection et le retour).
    this.stateJwt = new JwtService({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: '15m' },
    });
  }

  private assertConfigured() {
    if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) {
      throw new ServiceUnavailableException(
        "L'intégration Instagram n'est pas configurée sur ce serveur (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET manquants).",
      );
    }
  }

  private redirectUri(): string {
    return process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/api/instagram/callback';
  }

  getAuthorizeUrl(userId: string): string {
    this.assertConfigured();
    const state = this.stateJwt.sign({ sub: userId, purpose: 'instagram_oauth' });
    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: IG_SCOPE,
      state,
    });
    return `${IG_AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(code: string | undefined, state: string | undefined, oauthError: string | undefined): Promise<string> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (oauthError || !code || !state) {
      return `${frontendUrl}/studio?instagram=error`;
    }

    let userId: string;
    try {
      const payload = this.stateJwt.verify(state) as { sub: string; purpose: string };
      if (payload.purpose !== 'instagram_oauth') throw new Error('invalid purpose');
      userId = payload.sub;
    } catch {
      return `${frontendUrl}/studio?instagram=error`;
    }

    try {
      this.assertConfigured();

      // 1) code -> token courte duree
      const shortLived = await axios.post(
        IG_TOKEN_URL,
        new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID!,
          client_secret: process.env.INSTAGRAM_APP_SECRET!,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri(),
          code,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const shortLivedToken = shortLived.data.access_token as string;

      // 2) token courte duree -> token longue duree (60 jours)
      const longLived = await axios.get(`${IG_GRAPH_URL}/access_token`, {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: process.env.INSTAGRAM_APP_SECRET!,
          access_token: shortLivedToken,
        },
      });
      const longLivedToken = longLived.data.access_token as string;
      const expiresInSeconds = longLived.data.expires_in as number;

      // 3) profil
      const profile = await axios.get(`${IG_GRAPH_URL}/me`, {
        params: { fields: 'id,username', access_token: longLivedToken },
      });

      await this.usersRepo.update(userId, {
        instagramUserId: profile.data.id,
        instagramUsername: profile.data.username,
        instagramAccessToken: longLivedToken,
        instagramTokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      });

      return `${frontendUrl}/studio?instagram=connected`;
    } catch {
      return `${frontendUrl}/studio?instagram=error`;
    }
  }

  async getStatus(userId: string): Promise<{ connected: boolean; username?: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user?.instagramUserId) return { connected: false };
    return { connected: true, username: user.instagramUsername };
  }

  async disconnect(userId: string): Promise<void> {
    await this.usersRepo.update(userId, {
      instagramUserId: undefined,
      instagramUsername: undefined,
      instagramAccessToken: undefined,
      instagramTokenExpiresAt: undefined,
    });
  }

  private async getValidToken(userId: string): Promise<string> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.instagramAccessToken')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user?.instagramAccessToken) {
      throw new BadRequestException('Compte Instagram non connecté.');
    }
    if (user.instagramTokenExpiresAt && user.instagramTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('La connexion Instagram a expiré, reconnectez votre compte.');
    }
    return user.instagramAccessToken;
  }

  private mapMedia(raw: RawIgMedia): InstagramMediaDto {
    return {
      id: raw.id,
      caption: raw.caption,
      mediaType: raw.media_type,
      mediaUrl: raw.media_url,
      thumbnailUrl: raw.thumbnail_url,
      permalink: raw.permalink,
      timestamp: raw.timestamp,
    };
  }

  async listMedia(userId: string): Promise<InstagramMediaDto[]> {
    const token = await this.getValidToken(userId);
    const res = await axios.get(`${IG_GRAPH_URL}/me/media`, {
      params: { fields: MEDIA_FIELDS, access_token: token, limit: 30 },
    });
    return (res.data.data as RawIgMedia[]).map((m) => this.mapMedia(m));
  }

  async importMedia(userId: string, mediaIds: string[]): Promise<{ imported: number; failed: { id: string; reason: string }[] }> {
    if (!mediaIds?.length) throw new BadRequestException('Aucun média sélectionné.');
    const token = await this.getValidToken(userId);

    let imported = 0;
    const failed: { id: string; reason: string }[] = [];

    for (const mediaId of mediaIds) {
      try {
        const res = await axios.get(`${IG_GRAPH_URL}/${mediaId}`, {
          params: { fields: `${MEDIA_FIELDS},children{media_url,media_type}`, access_token: token },
        });
        const raw = res.data as RawIgMedia;

        // Carrousel — on importe uniquement le premier element (limitation MVP, un post = un media ici).
        const source = raw.media_type === 'CAROUSEL_ALBUM' && raw.children?.data?.length
          ? raw.children.data[0]
          : { media_url: raw.media_url, media_type: raw.media_type === 'CAROUSEL_ALBUM' ? 'IMAGE' as const : raw.media_type };

        const isVideo = source.media_type === 'VIDEO';
        const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
        const extension = isVideo ? 'mp4' : 'jpg';

        const mediaRes = await axios.get(source.media_url, { responseType: 'arraybuffer' });
        const { fileUrl } = await this.filesService.saveBuffer('posts', Buffer.from(mediaRes.data), extension, mimeType);

        let thumbnailUrl: string | undefined;
        if (isVideo && raw.thumbnail_url) {
          try {
            const thumbRes = await axios.get(raw.thumbnail_url, { responseType: 'arraybuffer' });
            const saved = await this.filesService.saveBuffer('posts', Buffer.from(thumbRes.data), 'jpg', 'image/jpeg');
            thumbnailUrl = saved.fileUrl;
          } catch {
            // miniature optionnelle — on continue sans si le telechargement echoue
          }
        }

        const tags = Array.from(new Set((raw.caption?.match(/#(\w+)/g) || []).map((t) => t.slice(1))));
        const caption = (raw.caption || '').replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();

        await this.postsService.create(userId, {
          type: isVideo ? PostType.VIDEO : PostType.PHOTO,
          mediaUrl: fileUrl,
          thumbnailUrl,
          caption: caption || undefined,
          tags,
        });
        imported += 1;
      } catch (err) {
        failed.push({ id: mediaId, reason: err instanceof Error ? err.message : 'Erreur inconnue' });
      }
    }

    return { imported, failed };
  }
}
