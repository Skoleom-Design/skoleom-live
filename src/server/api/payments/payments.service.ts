import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Boost } from '../boosts/boost.entity';
import { BoostsService } from '../boosts/boosts.service';
import { OrderStatus, BoostStatus } from '../../../shared/types/entities';

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
    private boostsService: BoostsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
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

  async createBoostPaymentIntent(
    boostId: string,
    userId: string,
  ): Promise<{ clientSecret: string }> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId, userId } });
    if (!boost) throw new BadRequestException('Boost not found');

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(boost.budget * 100),
      currency: boost.currency.toLowerCase(),
      metadata: { boostId, userId },
    });

    await this.boostsRepo.update(boostId, {
      stripePaymentIntentId: paymentIntent.id,
    });

    return { clientSecret: paymentIntent.client_secret! };
  }

  async createWalletTopupIntent(userId: string, amount: number): Promise<{ clientSecret: string }> {
    if (!amount || amount <= 0) throw new BadRequestException('Invalid amount');

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      metadata: { walletTopupUserId: userId },
    });

    return { clientSecret: paymentIntent.client_secret! };
  }

  async withdrawFromWallet(userId: string, amount: number): Promise<{ walletBalance: number }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!amount || amount <= 0) throw new BadRequestException('Invalid amount');
    if (amount > user.walletBalance) throw new BadRequestException('Solde insuffisant');
    if (!user.stripeAccountId) {
      throw new BadRequestException(
        "Aucun compte bancaire n'est relié pour l'instant — la mise en relation Stripe pour les virements n'est pas encore configurée.",
      );
    }

    await this.usersRepo.decrement({ id: userId }, 'walletBalance', amount);
    const updated = await this.usersRepo.findOne({ where: { id: userId } });
    return { walletBalance: updated!.walletBalance };
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
      const { orderId, boostId, walletTopupUserId } = pi.metadata;

      if (walletTopupUserId) {
        await this.usersRepo.increment(
          { id: walletTopupUserId },
          'walletBalance',
          pi.amount / 100,
        );
      }

      if (orderId) await this.markOrderPaid(orderId);
      if (boostId) await this.boostsService.activate(boostId);
    }
  }

  // Le webhook Stripe ci-dessus est la voie "officielle" de confirmation, mais elle suppose une
  // instance Stripe CLI qui relaie les évènements vers ce serveur — absent en dev/démo, il ne se
  // déclenche jamais. Ces deux méthodes offrent une confirmation alternative : une fois le
  // paiement confirmé côté client (Stripe Elements), le frontend appelle directement ces endpoints,
  // qui re-vérifient le statut auprès de Stripe avant d'activer quoi que ce soit (on ne fait donc
  // jamais confiance au seul client).
  async confirmBoostPayment(boostId: string, userId: string): Promise<void> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId, userId } });
    if (!boost) throw new BadRequestException('Boost introuvable');
    if (boost.status !== BoostStatus.PENDING) return;
    if (!boost.stripePaymentIntentId) throw new BadRequestException('Aucun paiement associé à ce boost');

    const pi = await this.stripe.paymentIntents.retrieve(boost.stripePaymentIntentId);
    if (pi.status !== 'succeeded') throw new BadRequestException('Paiement non confirmé');

    await this.boostsService.activate(boostId);
  }

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
      await this.usersRepo.increment({ id: order.creatorId }, 'totalEarnings', order.creatorAmount);
      await this.usersRepo.increment({ id: order.creatorId }, 'walletBalance', order.creatorAmount);
    }
  }
}
