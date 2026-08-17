import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { UserRole, UserPlan } from '../../../shared/types/entities';
import { Post } from '../posts/post.entity';
import { Order } from '../orders/order.entity';
import { Boost } from '../boosts/boost.entity';
import { DecimalColumnTransformer } from '../../common/decimal.transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // select: false — sinon le hash fuite via les relations eager (ex: Post.creator) dans les reponses API.
  // nullable — un compte cree via "Se connecter avec Google" n'a pas de mot de passe local.
  @Column({ select: false, nullable: true })
  password: string;

  // Identifiant Google (claim `sub`) — nul pour un compte email/mot de passe classique.
  @Column({ nullable: true })
  googleId: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.CREATOR })
  role: UserRole;

  // Étiquette d'abonnement affichée sur le profil — purement cosmétique, aucune limite n'est appliquée côté serveur.
  @Column({ type: 'simple-enum', enum: UserPlan, default: UserPlan.FREE })
  plan: UserPlan;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalColumnTransformer })
  totalEarnings: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalColumnTransformer })
  walletBalance: number;

  // Gains d'une vente encaissée mais pas encore débloqués — libérés vers walletBalance
  // seulement quand la commande passe au statut "delivered".
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalColumnTransformer })
  pendingBalance: number;

  @Column({ nullable: true })
  stripeAccountId: string;

  @Column({ nullable: true })
  instagramUserId: string;

  @Column({ nullable: true })
  instagramUsername: string;

  // select: false — meme raison que le hash de mot de passe : un token d'acces ne doit pas fuiter via les relations eager.
  @Column({ nullable: true, select: false })
  instagramAccessToken: string;

  @Column({ nullable: true })
  instagramTokenExpiresAt: Date;

  // Centres d'intérêt choisis à l'onboarding (slugs, voir client/constants/interests.ts) —
  // utilisés pour faire remonter les posts au tag correspondant dans le feed.
  @Column({ type: 'simple-array', default: '' })
  interests: string[];

  @Column({ default: false })
  hasOnboarded: boolean;

  @OneToMany(() => Post, (post) => post.creator)
  posts: Post[];

  @OneToMany(() => Order, (order) => order.buyer)
  orders: Order[];

  @OneToMany(() => Boost, (boost) => boost.user)
  boosts: Boost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}