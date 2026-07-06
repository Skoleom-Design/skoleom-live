import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Eye, ShoppingBag, Heart, TrendingUp } from 'lucide-react';
import type { Post, User } from '../../shared/types/api';

// ── Demo data ────────────────────────────────────────────────────────────────
const DEMO_USERS: Record<string, User & { bio: string }> = {
  u1: { id: 'u1', username: 'stylebylea', displayName: 'Léa Martin', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop', bio: 'Mode & lifestyle 🌸 Créatrice de contenu', totalEarnings: 1842 },
  u2: { id: 'u2', username: 'sophiaglow', displayName: 'Sophia K.', avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop', bio: 'Beauty & wellness 🧴 Skincare addict', totalEarnings: 3210 },
  u3: { id: 'u3', username: 'kicksbyomar', displayName: 'Omar B.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', bio: 'Sneakers & streetwear culture 👟', totalEarnings: 8140 },
  me: { id: 'me', username: 'monprofil', displayName: 'Mon Profil', avatarUrl: '', bio: 'Créateur skoleomLive', totalEarnings: 0 },
};

const DEMO_POSTS_BY_USER: Record<string, Post[]> = {
  u1: [
    { id: 'demo-1', caption: 'Nouvelle collection été ☀️', type: 'photo', mediaUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop', tags: ['mode'], viewCount: 14200, likeCount: 3840, isBoosted: true, creator: DEMO_USERS.u1, capsules: [{ id: 'cap-1', name: 'Robe Ibiza', description: '', price: 89.90, currency: 'EUR', imageUrl: '', images: [], stock: 12, soldCount: 5, commissionRate: 0.15, status: 'available' }, { id: 'cap-2', name: 'Chapeau paille', description: '', price: 34.50, currency: 'EUR', imageUrl: '', images: [], stock: 3, soldCount: 18, commissionRate: 0.15, status: 'available' }], createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'p2', caption: 'Outfit du jour 🌿', type: 'photo', mediaUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=600&fit=crop', tags: ['mode', 'outfit'], viewCount: 6700, likeCount: 1200, isBoosted: false, creator: DEMO_USERS.u1, capsules: [], createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'p3', caption: 'Shopping haul printemps 🌷', type: 'photo', mediaUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=600&fit=crop', tags: ['shopping'], viewCount: 9800, likeCount: 2300, isBoosted: false, creator: DEMO_USERS.u1, capsules: [{ id: 'cap-6', name: 'Sac tote lin', description: '', price: 45, currency: 'EUR', imageUrl: '', images: [], stock: 8, soldCount: 12, commissionRate: 0.15, status: 'available' }], createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
  ],
  u2: [
    { id: 'demo-2', caption: 'Routine skincare du matin 🧴', type: 'photo', mediaUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=600&fit=crop', tags: ['skincare'], viewCount: 8900, likeCount: 2100, isBoosted: false, creator: DEMO_USERS.u2, capsules: [{ id: 'cap-3', name: 'Sérum Vitamine C', description: '', price: 42, currency: 'EUR', imageUrl: '', images: [], stock: 0, soldCount: 94, commissionRate: 0.18, status: 'sold_out' }], createdAt: new Date(Date.now() - 86400000).toISOString() },
  ],
  u3: [
    { id: 'demo-3', caption: 'Sneakers edition limitée 🔥', type: 'photo', mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=600&fit=crop', tags: ['sneakers'], viewCount: 31000, likeCount: 9200, isBoosted: true, creator: DEMO_USERS.u3, capsules: [{ id: 'cap-5', name: 'Air Max Exclusif', description: '', price: 189, currency: 'EUR', imageUrl: '', images: [], stock: 7, soldCount: 43, commissionRate: 0.12, status: 'available' }], createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  ],
};

function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

type Tab = 'posts' | 'analytics';

export default function ProfilePage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [user, setUser] = useState<(User & { bio?: string }) | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const userId = id === 'me' ? 'me' : id;

    Promise.all([
      fetch(`/api/users/${userId}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/posts/creator/${userId}`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([userData, postsData]) => {
      setUser(userData || DEMO_USERS[userId] || null);
      setPosts(postsData || DEMO_POSTS_BY_USER[userId] || []);
    }).finally(() => setLoading(false));
  }, [id]);

  const totalViews = posts.reduce((s, p) => s + p.viewCount, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likeCount, 0);
  const totalSold = posts.reduce((s, p) => s + p.capsules.reduce((ss, c) => ss + c.soldCount, 0), 0);
  const totalRevenue = posts.reduce((s, p) => s + p.capsules.reduce((ss, c) => ss + c.price * c.soldCount * (1 - c.commissionRate), 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-surface"><div className="w-8 h-8 border-2 border-white/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return <div className="flex flex-col items-center justify-center h-screen bg-surface text-white gap-4"><p className="text-gray-400">Profil introuvable</p><Link href="/" className="text-brand text-sm">← Feed</Link></div>;
  }

  return (
    <>
      <Head><title>@{user.username} — skoleomLive</title></Head>

      <div className="min-h-screen bg-surface text-white">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-white/5 flex items-center gap-4 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <p className="text-sm font-bold text-white">@{user.username}</p>
            <p className="text-xs text-gray-500">{posts.length} post{posts.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* ── Profile card ────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-20 h-20 rounded-full object-cover border-2 border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-2xl font-bold text-white">
                {user.username[0].toUpperCase()}
              </div>
            )}
            <button className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition-colors">
              Suivre
            </button>
          </div>

          <p className="font-bold text-lg text-white">{user.displayName || user.username}</p>
          <p className="text-sm text-gray-400 mt-0.5">@{user.username}</p>
          {user.bio && <p className="text-sm text-white/80 mt-2 leading-relaxed">{user.bio}</p>}

          {/* Quick stats */}
          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="font-bold text-white">{fmt(totalViews)}</p>
              <p className="text-xs text-gray-400">vues</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-white">{fmt(totalLikes)}</p>
              <p className="text-xs text-gray-400">likes</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-white">{posts.length}</p>
              <p className="text-xs text-gray-400">posts</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-green-400">{totalSold}</p>
              <p className="text-xs text-gray-400">vendus</p>
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex border-b border-white/5 px-5">
          {(['posts', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
                tab === t
                  ? 'text-white border-brand'
                  : 'text-gray-500 border-transparent hover:text-white'
              }`}
            >
              {t === 'posts' ? '🎬 Posts' : '📊 Analytics'}
            </button>
          ))}
        </div>

        {/* ── Posts grid ──────────────────────────────────────────── */}
        {tab === 'posts' && (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {posts.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`} className="relative aspect-[9/16] bg-surface-card overflow-hidden group">
                <img src={post.thumbnailUrl || post.mediaUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />

                {post.isBoosted && (
                  <div className="absolute top-1.5 left-1.5">
                    <span className="text-[10px] bg-brand/80 text-white px-1.5 py-0.5 rounded-full font-semibold">⚡</span>
                  </div>
                )}

                {post.capsules.length > 0 && (
                  <div className="absolute top-1.5 right-1.5">
                    <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">🛍️ {post.capsules.length}</span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 text-[11px] text-white/80">
                    <Eye size={10} /> {fmt(post.viewCount)}
                    <Heart size={10} /> {fmt(post.likeCount)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Analytics tab ───────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div className="p-5 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-surface-card rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-blue-400" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Total vues</span>
                </div>
                <p className="text-2xl font-bold text-white">{fmt(totalViews)}</p>
              </div>
              <div className="bg-surface-card rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={16} className="text-brand" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Total likes</span>
                </div>
                <p className="text-2xl font-bold text-white">{fmt(totalLikes)}</p>
              </div>
              <div className="bg-surface-card rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag size={16} className="text-green-400" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Articles vendus</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{totalSold}</p>
              </div>
              <div className="bg-surface-card rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-yellow-400" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Revenus nets</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{totalRevenue.toFixed(0)} €</p>
              </div>
            </div>

            {/* Per-post analytics */}
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Par post</h3>
            <div className="space-y-3">
              {posts
                .sort((a, b) => b.viewCount - a.viewCount)
                .map((post) => {
                  const postSold = post.capsules.reduce((s, c) => s + c.soldCount, 0);
                  const postRevenue = post.capsules.reduce((s, c) => s + c.price * c.soldCount * (1 - c.commissionRate), 0);
                  const engagementRate = post.viewCount > 0 ? ((post.likeCount / post.viewCount) * 100).toFixed(1) : '0';

                  return (
                    <Link
                      key={post.id}
                      href={`/post/${post.id}`}
                      className="flex items-stretch gap-3 bg-surface-card rounded-2xl overflow-hidden border border-white/5 hover:border-brand/20 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 flex-shrink-0 relative">
                        <img src={post.thumbnailUrl || post.mediaUrl} alt={post.caption} className="w-full h-full object-cover" />
                        {post.isBoosted && (
                          <div className="absolute top-1 left-1">
                            <span className="text-[9px] bg-brand text-white px-1 py-0.5 rounded-full font-bold">⚡</span>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex-1 py-3 pr-3">
                        <p className="text-sm font-medium text-white line-clamp-1 mb-2">
                          {post.caption || 'Sans caption'}
                        </p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Eye size={12} className="text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-white font-semibold">{fmt(post.viewCount)}</span>
                            <span className="text-xs text-gray-500">vues</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Heart size={12} className="text-brand flex-shrink-0" />
                            <span className="text-xs text-white font-semibold">{fmt(post.likeCount)}</span>
                            <span className="text-xs text-gray-500">likes</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <ShoppingBag size={12} className="text-green-400 flex-shrink-0" />
                            <span className="text-xs text-green-400 font-semibold">{postSold}</span>
                            <span className="text-xs text-gray-500">vendu{postSold > 1 ? 's' : ''}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-yellow-400 flex-shrink-0" />
                            <span className="text-xs text-yellow-400 font-semibold">{engagementRate}%</span>
                            <span className="text-xs text-gray-500">eng.</span>
                          </div>
                        </div>

                        {postRevenue > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs text-gray-400">Revenus nets</span>
                            <span className="text-xs font-bold text-yellow-400">+{postRevenue.toFixed(2)} €</span>
                          </div>
                        )}

                        {post.capsules.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {post.capsules.map((c) => (
                              <span
                                key={c.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  c.status === 'sold_out'
                                    ? 'bg-red-400/10 text-red-400'
                                    : 'bg-brand/10 text-brand'
                                }`}
                              >
                                {c.name} · {c.soldCount} vente{c.soldCount > 1 ? 's' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
            </div>

            {posts.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-sm">
                Aucun post publié pour le moment.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
