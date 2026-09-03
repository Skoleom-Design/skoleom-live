import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '../../common/timestamp-column.type';

// Une ligne par connexion reussie (login classique ou Google) â€” sert uniquement a l'historique
// affiche dans le detail utilisateur admin (voir AdminService.getUserDetail), jamais lu par le
// reste de l'app. ip/userAgent sont best-effort et peuvent etre absents (ex: derriere un proxy
// qui ne les transmet pas).
@Entity('login_logs')
export class LoginLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt: Date;
}
