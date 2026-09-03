import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique,
} from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '../../common/timestamp-column.type';

// Qui a le droit de REGARDER un live prive, en plus du createur â€” distinct de LiveGuest qui
// controle qui a le droit de PUBLIER sa camera/micro (voir le commentaire sur LiveSession.isPrivate).
// Pas de relation `User` eager par defaut, meme principe que Follow/LiveGuest.
@Entity('live_viewer_access')
@Unique(['liveId', 'userId'])
export class LiveViewerAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  liveId: string;

  @Index()
  @Column()
  userId: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  grantedAt: Date;
}
