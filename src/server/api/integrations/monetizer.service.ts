import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

// Lu a l'appel (pas au chargement du module) : ce fichier est importe via AuthModule bien avant
// que ConfigModule.forRoot() (déclaré dans app.module.ts) n'ait charge le .env dans process.env
// — une constante de module ici resterait figee a vide pour toute la duree du process.
function registerUrl(): string {
  return process.env.MONETIZER_API_URL ? `${process.env.MONETIZER_API_URL}/api/auth/register` : '';
}

// Monetizer exige un mot de passe (min/maj/chiffre/caractère spécial) plus strict que skoleomLive
// — on ne réutilise jamais le mot de passe réel de l'utilisateur, on en génère un dédié que
// personne n'a besoin de connaître pour l'instant (ce compte n'est pas encore utilisé pour se
// connecter directement à Monetizer, seulement pour exister côté WooCommerce).
function generateCompliantPassword(): string {
  return `Sk${crypto.randomBytes(9).toString('base64url')}!1`;
}

// Provisionne un compte Monetizer correspondant à l'inscription skoleomLive — toujours best-effort :
// un échec (Monetizer indisponible, validation refusée, etc.) ne doit jamais faire échouer
// l'inscription skoleomLive elle-même, voir l'appel dans AuthService.register().
@Injectable()
export class MonetizerService {
  private readonly logger = new Logger(MonetizerService.name);

  async createAccount(email: string, username: string): Promise<string | null> {
    const url = registerUrl();
    if (!url) return null;

    try {
      const { data } = await axios.post(
        url,
        {
          mail: email,
          password: generateCompliantPassword(),
          nom: username,
          prenom: username,
          account_type: 'creator',
          abonnement: 'free',
        },
        { timeout: 5000 },
      );
      return data?.user?.id != null ? String(data.user.id) : null;
    } catch (err) {
      this.logger.warn(`Provisioning Monetizer échoué pour ${email}: ${err}`);
      return null;
    }
  }
}
