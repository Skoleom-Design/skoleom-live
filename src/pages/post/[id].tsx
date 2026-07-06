import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageCircle, Share2, VolumeX, Volume2, Music } from 'lucide-react';
import { CapsuleDrawer } from '../../client/components/Capsule/CapsuleDrawer';
import { BoostBadge } from '../../client/components/Boost/BoostBadge';
import type { Post } from '../../shared/types/api';

// Demo posts repris du feed pour la démo
const DEMO_POSTS: Record<string, Post> = {
  'demo-1': {
    id: 'demo-1',
    caption: 'Nouvelle collection été — des pièces légères et colorées pour la saison ☀️',
    type: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=720&h=1280&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=720&h=1280&fit=crop',
    tags: ['mode', 'été', 'collection'],
    viewCount: 14200,
    likeCount: 3840,
    isBoosted: true,
    musicName: 'Mood — 24kGoldn',
    creator: { id: 'u1', username: 'stylebylea', displayName: 'Léa Martin', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', bio: 'Mode & lifestyle', totalEarnings: 0 },
    capsules: [
      { id: 'cap-1', name: 'Robe Ibiza', description: "Légère et colorée, parfaite pour l'été. Tissu 100% lin.", price: 89.90, currency: 'EUR', imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300&h=300&fit=crop', images: [], stock: 12, soldCount: 5, commissionRate: 0.15, status: 'available' },
      { id: 'cap-2', name: 'Chapeau paille', description: 'Artisanal, taille unique.', price: 34.50, currency: 'EUR', imageUrl: 'https://images.unsplash.com/photo-1572307480813-ceb0e59d8325?w=300&h=300&fit=crop', images: [], stock: 3, soldCount: 18, commissionRate: 0.15, status: 'available' },
    ],
    createdAt: new Date().toISOString(),
  },
  'demo-2': {
    id: 'demo-2',
    caption: 'Mon setup skincare du matin — routine complète en 5 étapes 🧴',
    type: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=720&h=1280&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=720&h=1280&fit=crop',
    tags: ['skincare', 'beauté', 'routine'],
    viewCount: 8900, likeCount: 2100, isBoosted: false, musicName: 'Good Days — SZA',
    creator: { id: 'u2', username: 'sophiaglow', displayName: 'Sophia K.', avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop', bio: 'Beauty & wellness', totalEarnings: 0 },
    capsules: [
      { id: 'cap-3', name: 'Sérum Vitamine C', description: 'Éclat intense, anti-taches, formule concentrée 20%.', price: 42.00, currency: 'EUR', imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=300&fit=crop', images: [], stock: 0, soldCount: 94, commissionRate: 0.18, status: 'sold_out' },
      { id: 'cap-4', name: 'Crème hydratante', description: 'Sans parfum, pour peaux sensibles.', price: 28.90, currency: 'EUR', imageUrl: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=300&h=300&fit=crop', images: [], stock: 27, soldCount: 41, commissionRate: 0.15, status: 'available' },
    ],
    createdAt: new Date().toISOString(),
  },
  'demo-3': {
    id: 'demo-3',
    caption: 'Sneakers edition limitée — drop exclusif skoleomLive 🔥',
    type: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=720&h=1280&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=720&h=1280&fit=crop',
    tags: ['sneakers', 'streetwear', 'drop'],
    viewCount: 31000, likeCount: 9200, isBoosted: true,
    creator: { id: 'u3', username: 'kicksbyomar', displayName: 'Omar B.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', bio: 'Sneakers & culture', totalEarnings: 0 },
    capsules: [{ id: 'cap-5', name: 'Air Max Exclusif', description: 'Coloris unique, édition limitée à 50 paires.', price: 189.00, currency: 'EUR', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop', images: [], stock: 7, soldCount: 43, commissionRate: 0.12, status: 'available', variants: [{ name: 'Pointure', options: ['40', '41', '42', '43', '44', '45'] }] }],
    createdAt: new Date().toISOString(),
  },
};

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function PostDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const videoRef = useRef<HTMLVideoElement>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!id) return;
    // Try API, fall back to demo
    fetch(`/api/posts/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setPost(data || DEMO_POSTS[id] || null))
      .catch(() => setPost(DEMO_POSTS[id] || null))
      .finally(() => setLoading(false));
  }, [id]);

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4">
        <p className="text-gray-400">Post introuvable</p>
        <Link href="/" className="text-brand text-sm">← Retour au feed</Link>
      </div>
    );
  }

  const hasCapsules = post.capsules && post.capsules.length > 0;
  const totalSold = post.capsules?.reduce((s, c) => s + c.soldCount, 0) ?? 0;

  return (
    <>
      <Head>
        <title>{post.creator.username} — skoleomLive</title>
      </Head>

      <div className="relative h-screen w-full bg-black overflow-hidden flex">
        {/* ── Media ─────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          {post.type === 'video' ? (
            <video
              ref={videoRef}
              src={post.mediaUrl}
              className="absolute inset-0 w-full h-full object-cover"
              loop
              playsInline
              autoPlay
              muted={muted}
              onClick={togglePlay}
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt={post.caption}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Pause overlay */}
          {!playing && post.type === 'video' && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlay}
            >
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1" />
              </div>
            </div>
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>

            <div className="flex items-center gap-2">
              {post.isBoosted && <BoostBadge />}
              {post.type === 'video' && (
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                >
                  {muted
                    ? <VolumeX size={16} className="text-white" />
                    : <Volume2 size={16} className="text-white" />
                  }
                </button>
              )}
            </div>
          </div>

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10">
            {/* Creator */}
            <Link href={`/profile/${post.creator.id}`} className="flex items-center gap-3 mb-3">
              {post.creator.avatarUrl ? (
                <img src={post.creator.avatarUrl} alt={post.creator.username} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center font-bold text-white">
                  {post.creator.username[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">@{post.creator.username}</p>
                {post.creator.displayName && (
                  <p className="text-xs text-white/60">{post.creator.displayName}</p>
                )}
              </div>
            </Link>

            {post.caption && (
              <p className="text-sm text-white/90 leading-relaxed mb-3">{post.caption}</p>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-xs text-brand font-medium">#{tag}</span>
                ))}
              </div>
            )}

            {post.musicName && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Music size={12} />
                <span>{post.musicName}</span>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
              <span className="text-xs text-white/50">{formatCount(post.viewCount)} vues</span>
              <span className="text-xs text-white/50">{formatCount(post.likeCount)} likes</span>
              {totalSold > 0 && (
                <span className="text-xs text-green-400 font-medium">{totalSold} vendu{totalSold > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar actions ──────────────────────────────── */}
        <div className="hidden md:flex flex-col items-center justify-end gap-6 w-20 pb-8 bg-black/20">
          <button
            onClick={() => setLiked((l) => !l)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <Heart
              size={30}
              className={`transition-all ${liked ? 'text-brand fill-brand' : 'text-white group-hover:text-brand/70'}`}
            />
            <span className="text-xs text-white/70">{formatCount(post.likeCount + (liked ? 1 : 0))}</span>
          </button>

          <button className="flex flex-col items-center gap-1.5 group">
            <MessageCircle size={30} className="text-white group-hover:text-white/70" />
            <span className="text-xs text-white/70">0</span>
          </button>

          <button className="flex flex-col items-center gap-1.5 group">
            <Share2 size={28} className="text-white group-hover:text-white/70" />
            <span className="text-xs text-white/70">Partager</span>
          </button>
        </div>

        {/* ── Mobile bottom actions ──────────────────────────────── */}
        <div className="absolute bottom-0 right-4 flex md:hidden flex-col items-center gap-5 pb-32 z-20">
          <button onClick={() => setLiked((l) => !l)} className="flex flex-col items-center gap-1">
            <Heart size={28} className={liked ? 'text-brand fill-brand' : 'text-white'} />
            <span className="text-xs text-white/70">{formatCount(post.likeCount + (liked ? 1 : 0))}</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <MessageCircle size={28} className="text-white" />
            <span className="text-xs text-white/70">0</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <Share2 size={26} className="text-white" />
            <span className="text-xs text-white/70">Partager</span>
          </button>
        </div>

        {/* ── Capsule panel ──────────────────────────────────────── */}
        {hasCapsules && (
          <div className="hidden md:flex flex-col w-80 bg-surface-card border-l border-white/5 overflow-y-auto scrollbar-hide">
            <div className="p-5 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">🛍️ Capsules ({post.capsules.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">{totalSold} article{totalSold > 1 ? 's' : ''} vendu{totalSold > 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 space-y-3">
              {post.capsules.map((capsule) => (
                <div key={capsule.id} className="bg-surface-elevated rounded-2xl overflow-hidden">
                  {capsule.imageUrl && (
                    <img src={capsule.imageUrl} alt={capsule.name} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white">{capsule.name}</p>
                    {capsule.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{capsule.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-brand font-bold">{capsule.price.toFixed(2)} {capsule.currency}</span>
                      {capsule.status === 'sold_out' ? (
                        <span className="text-xs text-red-400 font-medium">Épuisé</span>
                      ) : (
                        <span className="text-xs text-gray-400">{capsule.stock} restant{capsule.stock > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {capsule.variants && capsule.variants.length > 0 && (
                      <div className="mt-2">
                        {capsule.variants.map((v) => (
                          <div key={v.name} className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">{v.name}</p>
                            <div className="flex flex-wrap gap-1">
                              {v.options.map((opt) => (
                                <span key={opt} className="px-2 py-0.5 rounded-lg bg-white/5 text-xs text-gray-300 border border-white/10">{opt}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {capsule.status !== 'sold_out' && (
                      <button className="w-full mt-3 py-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-xl transition-colors">
                        Acheter · {capsule.price.toFixed(2)} €
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile capsule drawer */}
        {hasCapsules && (
          <>
            <button
              onClick={() => setCapsuleOpen(true)}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 md:hidden z-20 skoleom-capsule-btn skoleom-capsule-btn--breathe"
            >
              <span>🛍️</span>
              <span>{post.capsules.length} article{post.capsules.length > 1 ? 's' : ''}</span>
            </button>
            <CapsuleDrawer capsules={post.capsules} open={capsuleOpen} onClose={() => setCapsuleOpen(false)} />
          </>
        )}
      </div>
    </>
  );
}
