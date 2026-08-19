import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';
import { WalletTransactionType } from '../../../shared/types/entities';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

// Historique des mouvements de solde wallet (walletBalance) — recharge, retrait, achat
// de capsule via solde, cadeau envoyé/reçu, déblocage de vente en attente. `amount` est
// signé : positif pour un crédit, négatif pour un débit.
@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'simple-enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalColumnTransformer })
  amount: number;

  @Column({ nullable: true })
  description: string;

  // Identifiant lié (paymentIntentId pour une recharge, orderId pour un achat/une vente,
  // giftId pour un cadeau) — sert aussi de clé d'idempotence pour les recharges Stripe.
  @Column({ nullable: true })
  reference: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
