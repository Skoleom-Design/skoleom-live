import { useEffect, useState } from 'react';
import Head from 'next/head';
import { InstaPostCard } from '../client/components/Post/InstaPostCard';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { AppGateScreen } from '../client/components/AppGate/AppGateScreen';
import type { Post } from '../shared/types/api';
import { api, getToken } from '../shared/api/http';
import { useLanguage } from '../client/i18n/LanguageContext';

/* ── Feed page ──────────────────────────────────────────────── */
export default function FeedPage() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
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
      if (data.posts?.length) {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = data.posts.filter((p: Post) => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });
        setPage((p) => p + 1);
      }
    } catch {
      // silencieux — on garde les posts deja charges plutot que d'afficher une erreur
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
          <div className="max-w-[470px] mx-auto pb-16 md:pb-0">
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
