import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { BoostStatus, BoostObjective, BoostScope } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

@Entity('boosts')
export class Boost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: BoostStatus, default: BoostStatus.PENDING })
  status: BoostStatus;

  @Column({ type: 'simple-enum', enum: BoostObjective, default: BoostObjective.VIEWS })
  objective: BoostObjective;

  @Column({ type: 'simple-enum', enum: BoostScope, default: BoostScope.POST })
  scope: BoostScope;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  budget: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalColumnTransformer })
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

  @ManyToOne(() => Post, (post) => post.boosts, { nullable: true })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ nullable: true })
  postId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
