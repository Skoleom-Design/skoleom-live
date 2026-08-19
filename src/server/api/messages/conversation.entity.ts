import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

// Conversation 1:1 uniquement — userAId/userBId sont toujours ranges dans l'ordre
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

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
