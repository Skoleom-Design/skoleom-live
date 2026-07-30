import { Controller, Get, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMine(@Request() req) {
    return this.ordersService.getForUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/buyer-stats')
  getBuyerStats(@Request() req) {
    return this.ordersService.getBuyerStats(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/deliver')
  markDelivered(@Param('id') id: string, @Request() req) {
    return this.paymentsService.markOrderDelivered(id, req.user.id);
  }
}
