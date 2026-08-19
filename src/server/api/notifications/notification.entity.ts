import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { NotificationType } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { LiveSession } from '../lives/live-session.entity';

// Notification (like/commentaire/follow/nouveau post/live demarre) — pousse en temps reel via
// RealtimeGateway en plus d'etre persistee ; le badge cote profil se base sur le compteur non-lu.
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: NotificationType })
  type: NotificationType;

  @Index()
  @Column()
  recipientId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'actorId' })
  actor: User;

  @Column()
  actorId: string;

  @ManyToOne(() => Post, { nullable: true })
  @JoinColumn({ name: 'postId' })
  post: Post | null;

  @Column({ nullable: true })
  postId: string | null;

  @ManyToOne(() => LiveSession, { nullable: true })
  @JoinColumn({ name: 'liveId' })
  live: LiveSession | null;

  @Column({ nullable: true })
  liveId: string | null;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
