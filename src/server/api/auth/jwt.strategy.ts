import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_secret',
    });
  }

  async validate(payload: { sub: string; role: string; sessionId?: string }) {
    // Requete la BDD (plutot que de faire confiance au seul token) pour qu'un compte
    // suspendu par un admin perde l'acces immediatement, meme avec un token encore valide.
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.currentSessionId')
      .where('user.id = :id', { id: payload.sub })
      .getOne();
    if (!user || !user.isActive) throw new UnauthorizedException();
    // Un seul appareil connecté a la fois — un login plus recent (ailleurs) a regenere
    // currentSessionId, ce jeton-ci n'est plus le dernier emis pour ce compte.
    if (user.currentSessionId !== payload.sessionId) throw new UnauthorizedException('SESSION_SUPERSEDED');
    return { id: user.id, role: user.role };
  }
}
