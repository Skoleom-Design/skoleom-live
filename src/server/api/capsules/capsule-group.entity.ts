import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Capsule } from './capsule.entity';

// Une capsule est le "produit" que le créateur vend : elle a un nom, et regroupe
// un ou plusieurs articles (chacun modélisé par une ligne Capsule) créés ensemble.
@Entity('capsule_groups')
export class CapsuleGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  creatorId: string;

  @OneToMany(() => Capsule, (capsule) => capsule.group)
  products: Capsule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
