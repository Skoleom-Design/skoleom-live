export enum UserRole {
  CREATOR = 'creator',
  BUYER = 'buyer',
  ADMIN = 'admin',
}

export enum UserPlan {
  FREE = 'free',
  PREMIUM = 'premium',
  ULTRA = 'ultra',
}

export enum PostType {
  VIDEO = 'video',
  PHOTO = 'photo',
}

export enum PostStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  MODERATED = 'moderated',
}

export enum CapsuleStatus {
  AVAILABLE = 'available',
  SOLD_OUT = 'sold_out',
  ARCHIVED = 'archived',
}

export enum CapsuleCondition {
  NEW_WITH_TAG = 'neuf_avec_etiquette',
  NEW_WITHOUT_TAG = 'neuf_sans_etiquette',
  VERY_GOOD = 'tres_bon_etat',
  GOOD = 'bon_etat',
  SATISFACTORY = 'satisfaisant',
}

export enum CapsuleCategory {
  CLOTHING = 'vetement',
  SHOES = 'chaussures',
  ACCESSORY = 'accessoire',
  OTHER = 'objet',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  DELIVERED = 'delivered',
  REFUNDED = 'refunded',
}

export enum BoostStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum BoostObjective {
  VIEWS = 'views',
  SALES = 'sales',
  FOLLOWERS = 'followers',
}

export enum BoostScope {
  POST = 'post',
  ACCOUNT = 'account',
}

export enum LiveStatus {
  LIVE = 'live',
  ENDED = 'ended',
}
