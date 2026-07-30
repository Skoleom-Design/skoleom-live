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

export enum WalletTransactionType {
  TOPUP = 'topup',
  WITHDRAWAL = 'withdrawal',
  CAPSULE_PURCHASE = 'capsule_purchase',
  CAPSULE_SALE_PENDING = 'capsule_sale_pending',
  CAPSULE_SALE_RELEASED = 'capsule_sale_released',
  GIFT_SENT = 'gift_sent',
  GIFT_RECEIVED = 'gift_received',
  ADMIN_CREDIT = 'admin_credit',
  BOOST_PURCHASE = 'boost_purchase',
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

export enum LiveMode {
  LIVE = 'live',
  AUCTION = 'auction',
}

export enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
}
