import {
  Controller, Post, Body, Param, Headers, RawBodyRequest, Request as Req,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('capsule/intent')
  createCapsuleIntent(
    @Req() req,
    @Body() body: { capsuleId: string; selectedVariant?: string },
  ) {
    return this.paymentsService.createCapsulePaymentIntent(
      body.capsuleId,
      req.user.id,
      body.selectedVariant,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('boost/intent')
  createBoostIntent(@Req() req, @Body() body: { boostId: string }) {
    return this.paymentsService.createBoostPaymentIntent(body.boostId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('boost/:id/confirm')
  confirmBoostPayment(@Req() req, @Param('id') id: string) {
    return this.paymentsService.confirmBoostPayment(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('order/:id/confirm')
  confirmOrderPayment(@Req() req, @Param('id') id: string) {
    return this.paymentsService.confirmOrderPayment(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet/topup')
  createWalletTopup(@Req() req, @Body() body: { amount: number }) {
    return this.paymentsService.createWalletTopupIntent(req.user.id, body.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet/withdraw')
  withdrawWallet(@Req() req, @Body() body: { amount: number }) {
    return this.paymentsService.withdrawFromWallet(req.user.id, body.amount);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('No raw body');
    await this.paymentsService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
