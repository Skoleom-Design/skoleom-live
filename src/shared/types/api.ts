export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  totalEarnings: number;
  email?: string;
}

export interface Post {
  id: string;
  caption: string;
  type: 'video' | 'photo' | 'youtube';
  mediaUrl: string;
  thumbnailUrl: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount?: number;
  isBoosted: boolean;
  musicName?: string;
  creator: User;
  capsules: Capsule[];
  createdAt: string;
}

export interface Comment {
  id: string;
  text: string;
  user: User;
  createdAt: string;
}

export type CapsuleCondition =
  | 'neuf_avec_etiquette'
  | 'neuf_sans_etiquette'
  | 'tres_bon_etat'
  | 'bon_etat'
  | 'satisfaisant';

export type CapsuleCategory = 'vetement' | 'chaussures' | 'accessoire' | 'objet';

export interface Capsule {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
  images: string[];
  stock: number;
  soldCount: number;
  commissionRate: number;
  condition?: CapsuleCondition;
  category?: CapsuleCategory;
  size?: string;
  colors?: string[];
  variants?: { name: string; options: string[]; price?: number }[];
  status: 'available' | 'sold_out' | 'archived';
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
}

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'delivered' | 'refunded';
  amount: number;
  commissionAmount: number;
  creatorAmount: number;
  currency: string;
  capsule: Capsule;
  buyer?: User;
  creator?: User;
  selectedVariant?: string;
  shippingAddress?: {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
}

export interface Boost {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  objective: 'views' | 'sales' | 'followers';
  scope: 'post' | 'account';
  budget: number;
  spent: number;
  durationDays: number;
  impressions: number;
  clicks: number;
  conversions: number;
  post: Post;
  user: { id: string; username: string; displayName?: string; avatarUrl?: string };
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  periodGMV: string;
  periodCommissions: string;
  periodBoostRevenue: string;
  periodGiftRevenue: string;
  totalRevenue: string;
  pendingBoosts: number;
  ordersCount: number;
}
