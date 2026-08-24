import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search, Loader2, Radio, Gavel, BadgeCheck, Lock } from 'lucide-react';
import { InstaPostCard } from '../client/components/Post/InstaPostCard';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { AppGateScreen } from '../client/components/AppGate/AppGateScreen';
import { BoostBadge } from '../client/components/Boost/BoostBadge';
import type { Post } from '../shared/types/api';
import { api, getToken } from '../shared/api/http';
import { useLanguage } from '../client/i18n/LanguageContext';

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
}

interface LiveResult {
  id: string;
  title?: string;
  mode: 'live' | 'auction';
  creator: { username: string };
  isPrivate?: boolean;
}

const PAGE_SIZE = 30;

/* ── Feed + recherche (fusionnés — voir barre de recherche en haut) ──────── */
export default function FeedPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [lives, setLives] = useState<LiveResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.q;
    if (typeof q === 'string') setQuery(q);
  }, [router.isReady, router.query.q]);

  async function loadFeed() {
    setLoadingMore(true);
    try {
      const data = await api.get<{ posts: Post[]; total: number }>(`/posts/feed?page=${page}&limit=${PAGE_SIZE}`);
      if (data.posts?.length) {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = data.posts.filter((p) => !existingIds.has(p.id));
          setHasMore((prev.length + fresh.length) < data.total);
          return [...prev, ...fresh];
        });
        setPage((p) => p + 1);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFeed();
    api.get<LiveResult[]>('/lives/active').then(setLives).catch(() => {});
    if (getToken()) {
      api.get<Post[]>('/posts/liked/me')
        .then((liked) => setLikedIds(new Set(liked.map((p) => p.id))))
        .catch(() => {});
    }
  }, []);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  // Recherche debattue cote serveur (username/displayName) — pas de match local possible,
  // contrairement aux posts/lives deja charges en entier.
  useEffect(() => {
    if (!trimmedQuery) { setUsers([]); return; }
    const timeout = setTimeout(() => {
      api.get<UserResult[]>(`/users/search?q=${encodeURIComponent(trimmedQuery)}`)
        .then(setUsers)
        .catch(() => setUsers([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const filteredPosts = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.caption?.toLowerCase().includes(q) ||
        p.creator?.username.toLowerCase().includes(q) ||
        p.creator?.displayName?.toLowerCase().includes(q) ||
        p.tags?.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [posts, trimmedQuery]);

  const filteredLives = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return [];
    return lives.filter(
      (l) => l.title?.toLowerCase().includes(q) || l.creator.username.toLowerCase().includes(q),
    );
  }, [lives, trimmedQuery]);

  return (
    <>
      <Head>
        <title>skoleomLive — Discover & Shop</title>
        <meta name="description" content="Shoppable social feed" />
      </Head>

      <AppGateScreen />

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main
          className="flex-1 overflow-y-auto scrollbar-hide"
          onScroll={(e) => {
            if (isSearching || loading || loadingMore || !hasMore) return;
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 600;
            if (nearBottom) loadFeed();
          }}
        >
          <div className={`mx-auto pb-16 md:pb-8 px-4 pt-6 transition-all ${isSearching ? 'max-w-[1100px]' : 'max-w-[470px] px-0'}`}>
            <div className={`relative mb-6 ${isSearching ? '' : 'px-4'}`}>
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" style={isSearching ? undefined : { left: '1.75rem' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('explore.searchPlaceholder')}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-full pl-11 pr-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
              />
            </div>

            {isSearching ? (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Colonne gauche — comptes puis lives */}
                <div className="w-full md:w-[280px] shrink-0 space-y-6">
                  <section>
                    <h2 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">{t('explore.accounts')}</h2>
                    {users.length === 0 ? (
                      <p className="text-white/25 text-xs">{t('explore.noAccounts')}</p>
                    ) : (
                      <div className="space-y-1">
                        {users.map((u) => (
                          <Link
                            key={u.id}
                            href={`/profile/${u.id}`}
                            className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.05] transition-colors"
                          >
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0">
                                {u.username[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-white text-[13px] font-semibold truncate">{u.displayName || u.username}</p>
                                {u.isVerified && <BadgeCheck size={13} className="text-[#a8ff35] shrink-0" />}
                              </div>
                              <p className="text-white/35 text-xs truncate">@{u.username}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h2 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">{t('explore.lives')}</h2>
                    {filteredLives.length === 0 ? (
                      <p className="text-white/25 text-xs">{t('explore.noLives')}</p>
                    ) : (
                      <div className="space-y-1">
                        {filteredLives.map((l) => (
                          <Link
                            key={l.id}
                            href={`/live/${l.id}`}
                            className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.05] transition-colors"
                          >
                            <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                              {l.mode === 'auction' ? (
                                <Gavel size={14} className="text-red-400" />
                              ) : (
                                <Radio size={14} className="text-red-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-[13px] font-semibold truncate flex items-center gap-1.5">
                                {l.title || (l.mode === 'auction' ? t('sidebar.auction') : t('sidebar.live'))}
                                {l.isPrivate && <Lock size={10} className="text-white/40 shrink-0" />}
                              </p>
                              <p className="text-white/35 text-xs truncate">@{l.creator.username}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Colonne droite — resultats posts */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">{t('explore.posts')}</h2>
                  {filteredPosts.length === 0 ? (
                    <p className="text-center text-white/30 text-sm py-16">{t('explore.noResults')}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {filteredPosts.map((post) => (
                        <Link
                          key={post.id}
                          href={`/post/${post.id}`}
                          className={`relative aspect-square bg-white/[0.04] overflow-hidden group ${
                            post.isBoosted ? 'ring-2 ring-[#a8ff35]/60' : ''
                          }`}
                        >
                          {post.thumbnailUrl || post.type === 'photo' ? (
                            <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
                          )}
                          {post.isBoosted && (
                            <div className="absolute top-1.5 left-1.5 z-10">
                              <BoostBadge />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-white/30" size={24} />
              </div>
            ) : (
              <>
                {posts.map((post) => (
                  <InstaPostCard key={post.id} post={post} liked={likedIds.has(post.id)} />
                ))}
                {loadingMore && (
                  <div className="flex items-center justify-center h-16 text-white/30 text-sm">
                    {t('common.loading')}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
