import {
  Controller, Post, Body, Headers, RawBodyRequest, Request as Req,
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
