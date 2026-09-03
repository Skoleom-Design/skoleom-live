import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '../../common/timestamp-column.type';
import { User } from '../users/user.entity';

export enum AdminActionType {
  PLAN_CHANGE = 'plan_change',
  STATUS_CHANGE = 'status_change',
  CREDIT = 'credit',
  BOOST_GRANT = 'boost_grant',
  BOOST_CANCEL = 'boost_cancel',
  BOOST_APPROVE = 'boost_approve',
  ACCOUNT_DELETE = 'account_delete',
  ACCOUNT_TRASH = 'account_trash',
  ACCOUNT_RESTORE = 'account_restore',
}

@Entity('admin_action_logs')
export class AdminActionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: AdminActionType })
  action: AdminActionType;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'adminId' })
  admin: User;

  @Column()
  adminId: string;

  @Column()
  targetUserId: string;

  @Column({ type: 'json', nullable: true })
  details: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt: Date;
}
