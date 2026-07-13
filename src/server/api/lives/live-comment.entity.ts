import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { LiveSession } from './live-session.entity';

@Entity('live_comments')
export class LiveComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  text: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => LiveSession)
  @JoinColumn({ name: 'liveSessionId' })
  liveSession: LiveSession;

  @Column()
  liveSessionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
