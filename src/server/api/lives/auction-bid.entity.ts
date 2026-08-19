import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { LiveSession } from './live-session.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

// Historique des mises d'une enchere — sert d'audit trail et alimente le fil "encheres" affiche
// aux spectateurs, en plus de currentBid/currentBidderId sur LiveSession (etat courant).
@Entity('auction_bids')
export class AuctionBid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LiveSession)
  @JoinColumn({ name: 'liveSessionId' })
  liveSession: LiveSession;

  @Column()
  liveSessionId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column()
  bidderId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  amount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
