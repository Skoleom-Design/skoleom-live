import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getConversations(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.id);
  }

  @Post('conversations/with/:userId')
  getOrCreateConversation(@Request() req, @Param('userId') userId: string) {
    return this.messagesService.getOrCreateConversation(req.user.id, userId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Request() req, @Param('id') id: string) {
    return this.messagesService.getMessages(id, req.user.id);
  }

  @Post('conversations/:id/messages')
  sendMessage(@Request() req, @Param('id') id: string, @Body() dto: { text: string }) {
    return this.messagesService.sendMessage(id, req.user.id, dto.text);
  }

  @Patch('conversations/:id/read')
  markRead(@Request() req, @Param('id') id: string) {
    return this.messagesService.markRead(id, req.user.id);
  }
}
