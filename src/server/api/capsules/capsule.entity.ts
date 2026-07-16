import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToMany, OneToMany,
} from 'typeorm';
import { CapsuleStatus, CapsuleCondition, CapsuleCategory } from '../../../shared/types/entities';
import { Post } from '../posts/post.entity';
import { Order } from '../orders/order.entity';

@Entity('capsules')
export class Capsule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ type: 'simple-enum', enum: CapsuleStatus, default: CapsuleStatus.AVAILABLE })
  status: CapsuleStatus;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'json', nullable: true })
  images: string[];

  @Column({ type: 'simple-enum', enum: CapsuleCondition, nullable: true })
  condition: CapsuleCondition;

  @Column({ type: 'simple-enum', enum: CapsuleCategory, nullable: true })
  category: CapsuleCategory;

  @Column({ nullable: true })
  size: string;

  // Sous-type libre (ex: "tshirt", "jean" pour la categorie vetement) — pas d'enum strict cote
  // base, les valeurs valides par categorie sont gerees cote client (constants/capsule.ts).
  @Column({ nullable: true })
  subcategory: string;

  @Column({ type: 'json', nullable: true })
  colors: string[];

  @Column({ nullable: true, type: 'json' })
  variants: {
    name: string;
    options: string[];
    price?: number;
  }[];

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 0 })
  soldCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  commissionRate: number;

  @ManyToMany(() => Post, (post) => post.capsules)
  posts: Post[];

  @Column()
  creatorId: string;

  @OneToMany(() => Order, (order) => order.capsule)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
