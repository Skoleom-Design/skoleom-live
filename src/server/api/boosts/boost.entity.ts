import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { BoostStatus, BoostObjective } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';

@Entity('boosts')
export class Boost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BoostStatus, default: BoostStatus.PENDING })
  status: BoostStatus;

  @Column({ type: 'enum', enum: BoostObjective, default: BoostObjective.VIEWS })
  objective: BoostObjective;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  budget: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  spent: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  endedAt: Date;

  @Column({ default: 0 })
  impressions: number;

  @Column({ default: 0 })
  clicks: number;

  @Column({ default: 0 })
  conversions: number;

  @ManyToOne(() => User, (user) => user.boosts)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Post, (post) => post.boosts)
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column()
  postId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
