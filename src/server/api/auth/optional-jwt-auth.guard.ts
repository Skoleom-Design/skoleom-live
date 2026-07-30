import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Comme JwtAuthGuard, mais ne rejette jamais la requete : sans token (ou avec un token invalide),
// `req.user` reste simplement undefined au lieu de déclencher un 401 — utile pour les routes
// publiques dont le comportement varie legerement selon que le visiteur est connu ou anonyme
// (ex: ne pas compter la vue d'un post par son propre créateur).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    return user || undefined;
  }
}
