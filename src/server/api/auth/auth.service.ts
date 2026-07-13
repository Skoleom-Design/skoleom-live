import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { UserPlan } from '../../../shared/types/entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(email: string, username: string, password: string, plan?: UserPlan) {
    const exists = await this.usersRepo.findOne({ where: [{ email }, { username }] });
    if (exists) throw new ConflictException('Email or username already taken');

    const hashed = await bcrypt.hash(password, 12);
    const user = this.usersRepo.create({ email, username, password: hashed, plan });
    const saved = await this.usersRepo.save(user);
    const { password: _, ...result } = saved;
    return { user: result, token: this.jwtService.sign({ sub: saved.id, role: saved.role }) };
  }

  async login(identifier: string, password: string) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :identifier OR user.username = :identifier', { identifier })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password: _, ...result } = user;
    return { user: result, token: this.jwtService.sign({ sub: user.id, role: user.role }) };
  }

  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { password: _, ...result } = user;
    return result;
  }
}
