import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { OrderStatus } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  commissionAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  creatorAmount: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  @Column({ nullable: true })
  selectedVariant: string;

  @Column({ type: 'json', nullable: true })
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
  };

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column()
  buyerId: string;

  @ManyToOne(() => Capsule, (capsule) => capsule.orders)
  @JoinColumn({ name: 'capsuleId' })
  capsule: Capsule;

  @Column()
  capsuleId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  creatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
