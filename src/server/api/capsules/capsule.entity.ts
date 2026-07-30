import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToMany, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { CapsuleStatus, CapsuleCondition, CapsuleCategory } from '../../../shared/types/entities';
import { Post } from '../posts/post.entity';
import { Order } from '../orders/order.entity';
import { CapsuleGroup } from './capsule-group.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

@Entity('capsules')
export class Capsule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Optionnel — un article d'occasion ou fait main n'a souvent pas de marque.
  @Column({ nullable: true })
  brand: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
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

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15, transformer: DecimalColumnTransformer })
  commissionRate: number;

  @ManyToMany(() => Post, (post) => post.capsules)
  posts: Post[];

  // Regroupe plusieurs articles créés ensemble sous une même capsule nommée
  // (ex: "Ma collection sneakers" contenant "Adidas" + "Nike"). Nullable pour
  // ne pas casser les capsules existantes créées avant ce champ.
  @Column({ nullable: true })
  groupId: string;

  @ManyToOne(() => CapsuleGroup, (group) => group.products, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'groupId' })
  group: CapsuleGroup;

  @Column()
  creatorId: string;

  @OneToMany(() => Order, (order) => order.capsule)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
