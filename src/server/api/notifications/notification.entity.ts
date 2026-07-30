import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { NotificationType } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';

// Notification legere (like/commentaire reçu) — pas de canal temps reel dedie pour l'instant,
// le badge cote profil se base sur un simple GET du compteur non-lu.
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

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
