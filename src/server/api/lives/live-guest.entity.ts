import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique,
} from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '../../common/timestamp-column.type';

// Un invité actuellement autorisé à publier caméra/micro dans la room LiveKit d'un live, en
// plus du créateur — remplace l'ancien slot unique `LiveSession.duoPartnerId` (une seule ligne
// avant), généralisé à autant de lignes que le live a d'invités actifs. Pas de relation `User`
// eager par défaut (voir Follow) — on hydrate explicitement quand l'appelant en a besoin.
@Entity('live_guests')
@Unique(['liveId', 'userId'])
export class LiveGuest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  liveId: string;

  @Index()
  @Column()
  userId: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  joinedAt: Date;
}
