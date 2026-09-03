import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, ManyToMany, OneToMany, JoinColumn, JoinTable,
} from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '../../common/timestamp-column.type';
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

  @Column({ type: 'simple-enum', enum: PostType, default: PostType.VIDEO })
  type: PostType;

  @Column({ type: 'simple-enum', enum: PostStatus, default: PostStatus.ACTIVE })
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
  commentCount: number;

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

  @ManyToMany(() => Capsule, (capsule) => capsule.posts, { cascade: true })
  @JoinTable({ name: 'post_capsules' })
  capsules: Capsule[];

  @ManyToMany(() => User)
  @JoinTable({ name: 'post_likes' })
  likedBy: User[];

  @OneToMany(() => Boost, (boost) => boost.post)
  boosts: Boost[];

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt: Date;
}
