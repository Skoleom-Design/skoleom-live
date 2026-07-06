export enum UserRole {
  CREATOR = 'creator',
  BUYER = 'buyer',
  ADMIN = 'admin',
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
