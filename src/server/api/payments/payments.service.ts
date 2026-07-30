import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Boost } from '../boosts/boost.entity';
import { BoostsService } from '../boosts/boosts.service';
import { WalletTransaction } from './wallet-transaction.entity';
import { OrderStatus, BoostStatus, CapsuleStatus, WalletTransactionType } from '../../../shared/types/entities';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Capsule)
    private capsulesRepo: Repository<Capsule>,
    @InjectRepository(Boost)
    private boostsRepo: Repository<Boost>,
    @InjectRepository(WalletTransaction)
    private walletTxRepo: Repository<WalletTransaction>,
    private boostsService: BoostsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  private logTx(userId: string, type: WalletTransactionType, amount: number, description?: string, reference?: string) {
    return this.walletTxRepo.save(
      this.walletTxRepo.create({ userId, type, amount, description, reference }),
    );
  }

  async createCapsulePaymentIntent(
    capsuleId: string,
    buyerId: string,
    selectedVariant?: string,
  ): Promise<{ clientSecret: string; orderId: string }> {
    const capsule = await this.capsulesRepo.findOne({ where: { id: capsuleId } });
    if (!capsule) throw new BadRequestException('Capsule not found');

    const commissionRate = capsule.commissionRate / 100;
    const commissionAmount = capsule.price * commissionRate;
    const creatorAmount = capsule.price - commissionAmount;

    const order = this.ordersRepo.create({
      capsuleId,
      buyerId,
      creatorId: capsule.creatorId,
      amount: capsule.price,
      commissionAmount,
      creatorAmount,
      currency: capsule.currency,
      selectedVariant,
      status: OrderStatus.PENDING,
    });
    const savedOrder = await this.ordersRepo.save(order);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(capsule.price * 100),
      currency: capsule.currency.toLowerCase(),
      metadata: {
        orderId: savedOrder.id,
        capsuleId,
        buyerId,
        creatorId: capsule.creatorId,
      },
    });

    await this.ordersRepo.update(savedOrder.id, {
      stripePaymentIntentId: paymentIntent.id,
    });

    return { clientSecret: paymentIntent.client_secret!, orderId: savedOrder.id };
  }

  // Stripe n'est pas configuré pour de vrais paiements — l'achat d'un boost débite directement
  // le wallet (déjà réel) et active le boost immédiatement, sans intent ni redirection Stripe.
  async payBoostWithWallet(userId: string, boostId: string): Promise<{ walletBalance: number }> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId, userId } });
    if (!boost) throw new NotFoundException('Boost introuvable');
    if (boost.status !== BoostStatus.PENDING) {
      throw new BadRequestException('Ce boost a déjà été traité.');
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (Number(user.walletBalance) < Number(boost.budget)) {
      throw new BadRequestException('Solde insuffisant — recharge ton wallet pour continuer.');
    }

    await this.usersRepo.decrement({ id: userId }, 'walletBalance', boost.budget);
    await this.logTx(userId, WalletTransactionType.BOOST_PURCHASE, -boost.budget, `Boost (${boost.durationDays}j)`, boostId);
    await this.boostsService.activate(boostId);

    const updated = await this.usersRepo.findOne({ where: { id: userId } });
    return { walletBalance: Number(updated!.walletBalance) };
  }

  // Stripe n'est pas encore configuré pour de vrais paiements — la recharge crédite directement
  // le solde en base pour simuler le flux (pas de PaymentIntent, pas de redirection Stripe Elements).
  async simulateWalletTopup(userId: string, amount: number): Promise<{ walletBalance: number }> {
    if (!amount || amount <= 0) throw new BadRequestException('Invalid amount');

    await this.usersRepo.increment({ id: userId }, 'walletBalance', amount);
    await this.logTx(userId, WalletTransactionType.TOPUP, amount, 'Recharge du wallet (simulée)');
    const updated = await this.usersRepo.findOne({ where: { id: userId } });
    return { walletBalance: updated!.walletBalance };
  }

  // Idem côté retrait : aucune mise en relation bancaire réelle n'existe encore (voir
  // "Skoleom Wallet — bientôt disponible" côté profil), donc le retrait débite simplement le
  // solde en base sans déclencher de vrai virement.
  async withdrawFromWallet(userId: string, amount: number): Promise<{ walletBalance: number }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!amount || amount <= 0) throw new BadRequestException('Invalid amount');
    if (amount > user.walletBalance) throw new BadRequestException('Solde insuffisant');

    await this.usersRepo.decrement({ id: userId }, 'walletBalance', amount);
    await this.logTx(userId, WalletTransactionType.WITHDRAWAL, -amount, 'Retrait vers le compte bancaire (simulé)');
    const updated = await this.usersRepo.findOne({ where: { id: userId } });
    return { walletBalance: updated!.walletBalance };
  }

  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    return this.walletTxRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async payCapsuleWithWallet(
    buyerId: string,
    capsuleId: string,
    selectedVariant?: string,
  ): Promise<Order> {
    const capsule = await this.capsulesRepo.findOne({ where: { id: capsuleId } });
    if (!capsule) throw new NotFoundException('Capsule introuvable');
    return this.executeWalletPurchase(buyerId, capsule, Number(capsule.price), selectedVariant);
  }

  // Reutilisee par le reglement d'une enchere : meme logique d'achat (debit/credit wallet,
  // escrow vendeur, decrement stock) mais au prix gagnant plutot qu'au prix catalogue de la capsule.
  async settleAuctionSale(buyerId: string, capsuleId: string, winningAmount: number): Promise<Order> {
    const capsule = await this.capsulesRepo.findOne({ where: { id: capsuleId } });
    if (!capsule) throw new NotFoundException('Capsule introuvable');
    return this.executeWalletPurchase(buyerId, capsule, winningAmount);
  }

  private async executeWalletPurchase(
    buyerId: string,
    capsule: Capsule,
    price: number,
    selectedVariant?: string,
  ): Promise<Order> {
    if (capsule.status === CapsuleStatus.SOLD_OUT || capsule.stock <= 0) {
      throw new BadRequestException('Cette capsule est épuisée.');
    }
    if (capsule.creatorId === buyerId) {
      throw new BadRequestException("Tu ne peux pas acheter ta propre capsule.");
    }

    const buyer = await this.usersRepo.findOne({ where: { id: buyerId } });
    if (!buyer) throw new NotFoundException('Utilisateur introuvable');
    if (Number(buyer.walletBalance) < price) {
      throw new BadRequestException('Solde insuffisant — recharge ton wallet pour continuer.');
    }

    const commissionRate = capsule.commissionRate / 100;
    const commissionAmount = price * commissionRate;
    const creatorAmount = price - commissionAmount;

    const order = await this.ordersRepo.save(
      this.ordersRepo.create({
        capsuleId: capsule.id,
        buyerId,
        creatorId: capsule.creatorId,
        amount: price,
        commissionAmount,
        creatorAmount,
        currency: capsule.currency,
        selectedVariant,
        status: OrderStatus.PAID,
      }),
    );

    await this.usersRepo.decrement({ id: buyerId }, 'walletBalance', price);
    await this.logTx(buyerId, WalletTransactionType.CAPSULE_PURCHASE, -price, capsule.name, order.id);

    await this.creditSaleToPending(order);
    await this.decrementCapsuleStock(capsule.id);

    return order;
  }

  private async creditSaleToPending(order: Order): Promise<void> {
    await this.usersRepo.increment({ id: order.creatorId }, 'totalEarnings', order.creatorAmount);
    await this.usersRepo.increment({ id: order.creatorId }, 'pendingBalance', order.creatorAmount);
    await this.logTx(
      order.creatorId,
      WalletTransactionType.CAPSULE_SALE_PENDING,
      order.creatorAmount,
      'Vente en attente de livraison',
      order.id,
    );
  }

  private async decrementCapsuleStock(capsuleId: string): Promise<void> {
    const capsule = await this.capsulesRepo.findOne({ where: { id: capsuleId } });
    if (!capsule || capsule.stock <= 0) return;
    await this.capsulesRepo.decrement({ id: capsuleId }, 'stock', 1);
    await this.capsulesRepo.increment({ id: capsuleId }, 'soldCount', 1);
    if (capsule.stock - 1 <= 0) {
      await this.capsulesRepo.update(capsuleId, { status: CapsuleStatus.SOLD_OUT });
    }
  }

  // Le créateur confirme l'expédition/réception — libère les gains en attente vers le solde
  // dépensable. Il n'existe pas encore de suivi transporteur réel : c'est une action manuelle.
  async markOrderDelivered(orderId: string, creatorId: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId, creatorId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Cette commande ne peut pas être marquée comme livrée.');
    }

    await this.ordersRepo.update(orderId, { status: OrderStatus.DELIVERED });
    await this.usersRepo.decrement({ id: creatorId }, 'pendingBalance', order.creatorAmount);
    await this.usersRepo.increment({ id: creatorId }, 'walletBalance', order.creatorAmount);
    await this.logTx(
      creatorId,
      WalletTransactionType.CAPSULE_SALE_RELEASED,
      order.creatorAmount,
      'Vente livrée — gains débloqués',
      orderId,
    );

    return this.ordersRepo.findOne({ where: { id: orderId } }) as Promise<Order>;
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { orderId, boostId } = pi.metadata;

      if (orderId) await this.markOrderPaid(orderId);
      if (boostId) await this.boostsService.activate(boostId);
    }
  }

  // Le webhook Stripe ci-dessus est la voie "officielle" de confirmation pour les commandes de
  // capsules, mais elle suppose une instance Stripe CLI qui relaie les évènements vers ce serveur
  // — absent en dev/démo, il ne se déclenche jamais. Cette méthode offre une confirmation
  // alternative : une fois le paiement confirmé côté client (Stripe Elements), le frontend appelle
  // directement cet endpoint, qui re-vérifie le statut auprès de Stripe avant d'activer quoi que
  // ce soit (on ne fait donc jamais confiance au seul client).
  async confirmOrderPayment(orderId: string, buyerId: string): Promise<void> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId, buyerId } });
    if (!order) throw new BadRequestException('Commande introuvable');
    if (order.status !== OrderStatus.PENDING) return;
    if (!order.stripePaymentIntentId) throw new BadRequestException('Aucun paiement associé à cette commande');

    const pi = await this.stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (pi.status !== 'succeeded') throw new BadRequestException('Paiement non confirmé');

    await this.markOrderPaid(orderId);
  }

  private async markOrderPaid(orderId: string): Promise<void> {
    await this.ordersRepo.update(orderId, { status: OrderStatus.PAID });
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (order) {
      await this.creditSaleToPending(order);
      await this.decrementCapsuleStock(order.capsuleId);
    }
  }
}
