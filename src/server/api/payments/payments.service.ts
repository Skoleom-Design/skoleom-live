import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Boost } from '../boosts/boost.entity';
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

      if (orderId) {
        await this.ordersRepo.update(orderId, { status: OrderStatus.PAID });
        const order = await this.ordersRepo.findOne({ where: { id: orderId } });
        if (order) {
          await this.usersRepo.increment(
            { id: order.creatorId },
            'totalEarnings',
            order.creatorAmount,
          );
        }
      }

      if (boostId) {
        await this.boostsRepo.update(boostId, {
          status: BoostStatus.ACTIVE,
          startedAt: new Date(),
        });
      }
    }
  }
}
