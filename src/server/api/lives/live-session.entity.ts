import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, ManyToMany, JoinColumn, JoinTable,
} from 'typeorm';
import { LiveStatus, LiveMode } from '../../../shared/types/entities';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

@Entity('live_sessions')
export class LiveSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'simple-enum', enum: LiveStatus, default: LiveStatus.LIVE })
  status: LiveStatus;

  @Column({ type: 'simple-enum', enum: LiveMode, default: LiveMode.LIVE })
  mode: LiveMode;

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

  // Produit actuellement mis en avant en mode live classique (file de vente façon Whatnot) —
  // doit faire partie de `capsules`. Nul si aucun produit n'a encore été choisi.
  @ManyToOne(() => Capsule, { nullable: true, eager: true })
  @JoinColumn({ name: 'featuredCapsuleId' })
  featuredCapsule: Capsule;

  @Column({ nullable: true })
  featuredCapsuleId: string;

  // Champs specifiques au mode "enchere" — nuls pour un live classique.
  @ManyToOne(() => Capsule, { nullable: true, eager: true })
  @JoinColumn({ name: 'auctionCapsuleId' })
  auctionCapsule: Capsule;

  @Column({ nullable: true })
  auctionCapsuleId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalColumnTransformer })
  startingBid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalColumnTransformer })
  currentBid: number;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'currentBidderId' })
  currentBidder: User;

  @Column({ nullable: true })
  currentBidderId: string;

  @Column({ nullable: true })
  auctionEndsAt: Date;

  @Column({ default: false })
  auctionSettled: boolean;

  // Un live "enchere" peut enchainer plusieurs manches (une par capsule choisie en cours de
  // direct) — true tant qu'une manche est en cours de mise, false entre deux manches.
  @Column({ default: false })
  auctionActive: boolean;

  // Nombre de manches deja lancees sur ce live — plafonne selon l'offre (voir AUCTION_ROUNDS_LIMIT
  // dans lives.service.ts), le meme principe que les limites de capsules par offre.
  @Column({ default: 0 })
  auctionRoundsCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
