import { IsEmail, IsString, IsOptional, IsEnum, MinLength, Matches } from 'class-validator';
import { UserPlan } from '../../../shared/types/entities';

// Le seul rempart cote serveur contre un mot de passe trivial (le check cote client dans
// login.tsx n'est qu'un confort UX, jamais fiable) — active via ValidationPipe (voir main.ts,
// deja branche globalement mais qui n'avait jusqu'ici jamais de vraie classe DTO a valider,
// juste des types TS inline sans effet sur le body recu au runtime).
export class RegisterDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Choisis un pseudo.' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })
  password: string;

  @IsOptional()
  @IsEnum(UserPlan)
  plan?: UserPlan;
}
