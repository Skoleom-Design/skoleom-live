export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  totalEarnings: number;
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
  isBoosted: boolean;
  musicName?: string;
  creator: User;
  capsules: Capsule[];
  createdAt: string;
}

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
  variants?: { name: string; options: string[]; price?: number }[];
  status: 'available' | 'sold_out' | 'archived';
}

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'delivered' | 'refunded';
  amount: number;
  commissionAmount: number;
  creatorAmount: number;
  currency: string;
  capsule: Capsule;
  createdAt: string;
}

export interface Boost {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  objective: 'views' | 'sales' | 'followers';
  budget: number;
  spent: number;
  durationDays: number;
  impressions: number;
  clicks: number;
  conversions: number;
  post: Post;
  startedAt?: string;
  endedAt?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  monthlyGMV: string;
  monthlyCommissions: string;
  monthlyBoostRevenue: string;
  totalRevenue: string;
  pendingBoosts: number;
  ordersCount: number;
}
