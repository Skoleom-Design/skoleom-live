import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { PostType, PostStatus } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Boost } from '../boosts/boost.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'enum', enum: PostType, default: PostType.VIDEO })
  type: PostType;

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.ACTIVE })
  status: PostStatus;

  @Column()
  mediaUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ nullable: true, type: 'json' })
  tags: string[];

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  likeCount: number;

  @Column({ default: 0 })
  shareCount: number;

  @Column({ default: 0 })
  boostScore: number;

  @Column({ default: false })
  isBoosted: boolean;

  @Column({ nullable: true })
  musicName: string;

  @Column({ nullable: true })
  musicUrl: string;

  @ManyToOne(() => User, (user) => user.posts, { eager: true })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  creatorId: string;

  @OneToMany(() => Capsule, (capsule) => capsule.post, { cascade: true })
  capsules: Capsule[];

  @OneToMany(() => Boost, (boost) => boost.post)
  boosts: Boost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
