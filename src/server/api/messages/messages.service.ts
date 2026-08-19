import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface ConversationSummary {
  id: string;
  otherUser: { id: string; username: string; displayName?: string; avatarUrl?: string };
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private msgRepo: Repository<Message>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private realtimeGateway: RealtimeGateway,
  ) {}

  // Range toujours la paire dans le meme ordre — sinon (A,B) et (B,A) créeraient deux
  // conversations distinctes pour les mêmes deux personnes.
  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async getOrCreateConversation(userId: string, otherUserId: string): Promise<Conversation> {
    if (userId === otherUserId) throw new BadRequestException("Tu ne peux pas t'envoyer un message à toi-même.");

    const other = await this.usersRepo.findOne({ where: { id: otherUserId } });
    if (!other) throw new NotFoundException('Utilisateur introuvable');

    const [userAId, userBId] = this.canonicalPair(userId, otherUserId);
    let conv = await this.convRepo.findOne({ where: { userAId, userBId } });
    if (!conv) {
      conv = await this.convRepo.save(this.convRepo.create({ userAId, userBId }));
    }
    return conv;
  }

  async assertParticipant(conversationId: string, userId: string): Promise<Conversation> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv || (conv.userAId !== userId && conv.userBId !== userId)) {
      throw new NotFoundException('Conversation introuvable');
    }
    return conv;
  }

  async getConversations(userId: string): Promise<ConversationSummary[]> {
    const convs = await this.convRepo.find({
      where: [{ userAId: userId }, { userBId: userId }],
      order: { lastMessageAt: 'DESC' },
    });

    return Promise.all(convs.map(async (conv) => {
      const other = conv.userAId === userId ? conv.userB : conv.userA;
      const unreadCount = await this.msgRepo.count({
        where: { conversationId: conv.id, read: false, senderId: Not(userId) },
      });
      return {
        id: conv.id,
        otherUser: { id: other.id, username: other.username, displayName: other.displayName, avatarUrl: other.avatarUrl },
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
        unreadCount,
      };
    }));
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    await this.assertParticipant(conversationId, userId);
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async sendMessage(conversationId: string, senderId: string, text: string): Promise<Message> {
    const conv = await this.assertParticipant(conversationId, senderId);
    const trimmed = text?.trim().slice(0, 2000);
    if (!trimmed) throw new BadRequestException('Message vide.');

    const saved = await this.msgRepo.save(this.msgRepo.create({ conversationId, senderId, text: trimmed }));
    await this.convRepo.update(conversationId, { lastMessageText: trimmed, lastMessageAt: saved.createdAt });

    const recipientId = conv.userAId === senderId ? conv.userBId : conv.userAId;
    this.realtimeGateway.emitToUser(recipientId, 'dm:message', saved);
    return saved;
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);
    await this.msgRepo.update({ conversationId, read: false, senderId: Not(userId) }, { read: true });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const convs = await this.convRepo.find({ where: [{ userAId: userId }, { userBId: userId }] });
    if (!convs.length) return { count: 0 };
    const counts = await Promise.all(
      convs.map((c) => this.msgRepo.count({ where: { conversationId: c.id, read: false, senderId: Not(userId) } })),
    );
    return { count: counts.reduce((s, c) => s + c, 0) };
  }
}
