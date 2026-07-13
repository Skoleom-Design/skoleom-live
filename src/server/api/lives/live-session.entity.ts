import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, ManyToMany, JoinColumn, JoinTable,
} from 'typeorm';
import { LiveStatus } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';

@Entity('live_sessions')
export class LiveSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'simple-enum', enum: LiveStatus, default: LiveStatus.LIVE })
  status: LiveStatus;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  creatorId: string;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  endedAt: Date;

  @ManyToMany(() => Capsule)
  @JoinTable({ name: 'live_capsules' })
  capsules: Capsule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
