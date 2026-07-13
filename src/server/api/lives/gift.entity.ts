import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { LiveSession } from './live-session.entity';

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

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @Column()
  receiverId: string;

  @ManyToOne(() => LiveSession)
  @JoinColumn({ name: 'liveSessionId' })
  liveSession: LiveSession;

  @Column()
  liveSessionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  creatorAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  platformAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}
