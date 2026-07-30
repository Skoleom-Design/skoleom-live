import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { UserRole } from '../../../shared/types/entities';

// Compte admin de démo (admin / admin) — cree au demarrage s'il n'existe pas encore, pour donner
// un acces immediat au dashboard admin sans manipulation manuelle de la base.
@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    const exists = await this.usersRepo.findOne({ where: { username: 'admin' } });
    if (exists) return;

    const hashed = await bcrypt.hash('admin', 12);
    const admin = this.usersRepo.create({
      email: 'admin@gmail.com',
      username: 'admin',
      password: hashed,
      role: UserRole.ADMIN,
    });
    await this.usersRepo.save(admin);
    this.logger.log('Compte admin créé (identifiant: admin / mot de passe: admin)');
  }
}
