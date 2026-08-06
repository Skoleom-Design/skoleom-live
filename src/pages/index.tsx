import { useEffect, useState } from 'react';
import Head from 'next/head';
import { InstaPostCard } from '../client/components/Post/InstaPostCard';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { AppGateScreen } from '../client/components/AppGate/AppGateScreen';
import type { Post } from '../shared/types/api';
import { api, getToken } from '../shared/api/http';
import { useLanguage } from '../client/i18n/LanguageContext';

const DEMO_POSTS: Post[] = [
  {
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
    creator: {
      id: 'u1',
      username: 'stylebylea',
      displayName: 'Léa Martin',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      bio: 'Mode & lifestyle',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-1',
        name: 'Robe Ibiza',
        description: 'Légère et colorée, parfaite pour l\'été. Tissu 100% lin.',
        price: 89.90,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300&h=300&fit=crop',
        images: [],
        stock: 12,
        soldCount: 5,
        commissionRate: 0.15,
        status: 'available',
      },
      {
        id: 'cap-2',
        name: 'Chapeau paille',
        description: 'Artisanal, taille unique.',
        price: 34.50,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1572307480813-ceb0e59d8325?w=300&h=300&fit=crop',
        images: [],
        stock: 3,
        soldCount: 18,
        commissionRate: 0.15,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    caption: 'Mon setup skincare du matin — routine complète en 5 étapes 🧴',
    type: 'video',
    mediaUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=720&h=1280&fit=crop',
    tags: ['skincare', 'beauté', 'routine'],
    viewCount: 8900,
    likeCount: 2100,
    isBoosted: false,
    musicName: 'Good Days — SZA',
    creator: {
      id: 'u2',
      username: 'sophiaglow',
      displayName: 'Sophia K.',
      avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop',
      bio: 'Beauty & wellness',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-3',
        name: 'Sérum Vitamine C',
        description: 'Éclat intense, anti-taches, formule concentrée 20%.',
        price: 42.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=300&fit=crop',
        images: [],
        stock: 0,
        soldCount: 94,
        commissionRate: 0.18,
        status: 'sold_out',
      },
      {
        id: 'cap-4',
        name: 'Crème hydratante',
        description: 'Sans parfum, pour peaux sensibles.',
        price: 28.90,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=300&h=300&fit=crop',
        images: [],
        stock: 27,
        soldCount: 41,
        commissionRate: 0.15,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    caption: 'Sneakers edition limitée — drop exclusif skoleomLive 🔥',
    type: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=720&h=1280&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=720&h=1280&fit=crop',
    tags: ['sneakers', 'streetwear', 'drop'],
    viewCount: 31000,
    likeCount: 9200,
    isBoosted: true,
    creator: {
      id: 'u3',
      username: 'kicksbyomar',
      displayName: 'Omar B.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      bio: 'Sneakers & culture',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-5',
        name: 'Air Max Exclusif',
        description: 'Coloris unique, édition limitée à 50 paires.',
        price: 189.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop',
        images: [],
        stock: 7,
        soldCount: 43,
        commissionRate: 0.12,
        status: 'available',
        variants: [{ name: 'Pointure', options: ['40', '41', '42', '43', '44', '45'] }],
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-6',
    caption: "Déco appartement — comment j'ai transformé mon salon pour 200€ 🏠✨",
    type: 'video',
    mediaUrl: 'https://download.samplelib.com/mp4/sample-15s.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=720&h=1280&fit=crop',
    tags: ['déco', 'intérieur', 'diy'],
    viewCount: 11800,
    likeCount: 4300,
    isBoosted: false,
    musicName: 'Golden Hour — JVKE',
    creator: {
      id: 'u6',
      username: 'maisonbylina',
      displayName: 'Lina R.',
      avatarUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop',
      bio: 'Déco & DIY',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-7',
        name: 'Vase Céramique Blanc',
        description: 'Fait main, design minimaliste. Hauteur 30cm.',
        price: 45.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&h=300&fit=crop',
        images: [],
        stock: 8,
        soldCount: 15,
        commissionRate: 0.15,
        status: 'available',
      },
      {
        id: 'cap-8',
        name: 'Bougie Soja Vanille',
        description: '40h de combustion, cire naturelle, parfum doux.',
        price: 22.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1602607140002-9e2bc40e72a2?w=300&h=300&fit=crop',
        images: [],
        stock: 24,
        soldCount: 67,
        commissionRate: 0.15,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-7',
    caption: 'Ma sélection bijoux du moment — minimaliste et élégant ✨',
    type: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=720&h=1280&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=720&h=1280&fit=crop',
    tags: ['bijoux', 'mode', 'minimaliste'],
    viewCount: 7400,
    likeCount: 2200,
    isBoosted: false,
    creator: {
      id: 'u7',
      username: 'jewelsbyamina',
      displayName: 'Amina S.',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
      bio: 'Bijoux & accessoires',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-9',
        name: 'Collier Lune Or',
        description: 'Plaqué or 18k, chaîne fine, pendentif lune. Longueur 45cm.',
        price: 38.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=300&h=300&fit=crop',
        images: [],
        stock: 14,
        soldCount: 29,
        commissionRate: 0.15,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-8',
    caption: 'Session surf au coucher du soleil — rien de mieux 🏄',
    type: 'video',
    mediaUrl: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=720&h=1280&fit=crop',
    tags: ['surf', 'sport', 'lifestyle'],
    viewCount: 44000,
    likeCount: 12300,
    isBoosted: true,
    musicName: 'Summer — Calvin Harris',
    creator: {
      id: 'u8',
      username: 'wavesbylukas',
      displayName: 'Lukas D.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      bio: 'Surf & ocean life',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-10',
        name: 'Board Shortboard 6\'2',
        description: 'Shape progression, idéale débutants/intermédiaires. Inclus leash.',
        price: 349.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=300&h=300&fit=crop',
        images: [],
        stock: 4,
        soldCount: 11,
        commissionRate: 0.10,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-11',
    caption: 'Aesthetic matinal — mon café oat latte et mon journal 📓',
    type: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=720&h=1280&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=720&h=1280&fit=crop',
    tags: ['café', 'lifestyle', 'morning'],
    viewCount: 9100,
    likeCount: 3400,
    isBoosted: false,
    creator: {
      id: 'u11',
      username: 'morningbyjulie',
      displayName: 'Julie P.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      bio: 'Lifestyle & wellness',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-13',
        name: 'Journal cuir A5',
        description: 'Couverture cuir végétal, papier 120g, 200 pages. Made in France.',
        price: 32.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop',
        images: [],
        stock: 35,
        soldCount: 54,
        commissionRate: 0.15,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-12',
    caption: 'Unboxing exclusif — la montre qui fait parler 🕐',
    type: 'video',
    mediaUrl: 'https://download.samplelib.com/mp4/sample-20s.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=720&h=1280&fit=crop',
    tags: ['montre', 'luxe', 'unboxing'],
    viewCount: 21000,
    likeCount: 5700,
    isBoosted: false,
    musicName: 'Starboy — The Weeknd',
    creator: {
      id: 'u12',
      username: 'watchesbykarim',
      displayName: 'Karim A.',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
      bio: 'Montres & horlogerie',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-14',
        name: 'Montre Acier Automatique',
        description: 'Mouvement automatique, verre saphir, étanche 50m. Bracelet milanais.',
        price: 245.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
        images: [],
        stock: 6,
        soldCount: 17,
        commissionRate: 0.10,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-14',
    caption: 'En studio — nouvelle chanson en cours d\'enregistrement 🎵',
    type: 'video',
    mediaUrl: 'https://download.samplelib.com/mp4/sample-30s.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=720&h=1280&fit=crop',
    tags: ['musique', 'studio', 'création'],
    viewCount: 28000,
    likeCount: 7900,
    isBoosted: false,
    musicName: 'En cours d\'enregistrement…',
    creator: {
      id: 'u14',
      username: 'studiobynathan',
      displayName: 'Nathan V.',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
      bio: 'Musique & production',
      totalEarnings: 0,
    },
    capsules: [
      {
        id: 'cap-16',
        name: 'Micro Condensateur USB',
        description: 'Cardioïde, 24bit/96kHz, filtre pop inclus. Plug & play.',
        price: 79.00,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=300&h=300&fit=crop',
        images: [],
        stock: 11,
        soldCount: 44,
        commissionRate: 0.13,
        status: 'available',
      },
    ],
    createdAt: new Date().toISOString(),
  },
];


/* ── Feed page ──────────────────────────────────────────────── */
export default function FeedPage() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>(DEMO_POSTS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeed();
    if (getToken()) {
      api.get<Post[]>('/posts/liked/me')
        .then((liked) => setLikedIds(new Set(liked.map((p) => p.id))))
        .catch(() => {});
    }
  }, []);

  async function loadFeed() {
    setLoading(true);
    try {
      const data = await api.get<{ posts: Post[]; total: number }>(`/posts/feed?page=${page}&limit=10`);
      setApiError(false);
      if (data.posts?.length) {
        setPosts((prev) => {
          const existingIds = new Set(
            prev.filter((p) => !p.id.startsWith('demo-')).map((p) => p.id),
          );
          const fresh = data.posts.filter((p: Post) => !existingIds.has(p.id));
          const withoutDemo = prev.filter((p) => !p.id.startsWith('demo-'));
          return [...withoutDemo, ...fresh];
        });
        setPage((p) => p + 1);
      }
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>skoleomLive — Discover & Shop</title>
        <meta name="description" content="Shoppable social feed" />
      </Head>

      <AppGateScreen />

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        {/* Center feed */}
        <main
          className="flex-1 overflow-y-auto scrollbar-hide"
          onScroll={(e) => {
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 600;
            if (nearBottom && !loading) loadFeed();
          }}
        >
          <div className="max-w-[470px] mx-auto">
            {apiError && (
              <div className="mx-3 mt-3 px-4 py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs text-center">
                {t('feed.backendUnavailable')}
              </div>
            )}
            {posts.map((post) => (
              <InstaPostCard key={post.id} post={post} liked={likedIds.has(post.id)} />
            ))}

            {loading && (
              <div className="flex items-center justify-center h-16 text-white/30 text-sm">
                {t('common.loading')}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
