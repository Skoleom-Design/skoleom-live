import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { LiveSession } from './live-session.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

@Entity('gifts')
export class Gift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  giftType: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: string;

  // Nuls pour un cadeau "hors-live" (ex: page vitrine /live demo, non rattachee a un vrai
  // createur/LiveSession) — l'argent est alors integralement compte comme platformAmount.
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'receiverId' })
  receiver: User | null;

  @Column({ nullable: true })
  receiverId: string | null;

  @ManyToOne(() => LiveSession, { nullable: true })
  @JoinColumn({ name: 'liveSessionId' })
  liveSession: LiveSession | null;

  @Column({ nullable: true })
  liveSessionId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  creatorAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  platformAmount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
