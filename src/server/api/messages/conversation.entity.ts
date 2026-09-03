import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '../../common/timestamp-column.type';
import { User } from '../users/user.entity';

// Conversation 1:1 uniquement â€” userAId/userBId sont toujours ranges dans l'ordre
// lexicographique (voir MessagesService.canonicalPair) pour garantir l'unicite de la paire
// sans avoir a tester les deux sens a chaque requete.
@Entity('conversations')
@Unique(['userAId', 'userBId'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userAId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userAId' })
  userA: User;

  @Index()
  @Column()
  userBId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userBId' })
  userB: User;

  @Column({ type: 'text', nullable: true })
  lastMessageText: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt: Date;
}
