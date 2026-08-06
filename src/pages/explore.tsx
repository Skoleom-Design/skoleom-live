import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search, Loader2, Radio, Gavel, BadgeCheck } from 'lucide-react';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { BoostBadge } from '../client/components/Boost/BoostBadge';
import type { Post } from '../shared/types/api';
import { api } from '../shared/api/http';

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
}

export default function ExplorePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [lives, setLives] = useState<LiveResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.q;
    if (typeof q === 'string') setQuery(q);
  }, [router.isReady, router.query.q]);

  useEffect(() => {
    api
      .get<{ posts: Post[] }>('/posts/feed?page=1&limit=50')
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
    api.get<LiveResult[]>('/lives/active').then(setLives).catch(() => {});
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
        p.tags?.some((t) => t.toLowerCase().includes(q)),
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
        <title>Rechercher — skoleomLive</title>
      </Head>

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className={`mx-auto px-4 py-8 ${isSearching ? 'max-w-[1100px]' : 'max-w-[900px]'}`}>
            <div className="relative mb-6">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un créateur, un tag, une légende..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-full pl-11 pr-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-white/30" size={24} />
              </div>
            ) : isSearching ? (
              <div className="flex gap-6">
                {/* Left column — comptes puis lives */}
                <div className="w-[280px] shrink-0 space-y-6">
                  <section>
                    <h2 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">Comptes</h2>
                    {users.length === 0 ? (
                      <p className="text-white/25 text-xs">Aucun compte trouvé.</p>
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
                    <h2 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">Lives</h2>
                    {filteredLives.length === 0 ? (
                      <p className="text-white/25 text-xs">Aucun live en cours.</p>
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
                              <p className="text-white text-[13px] font-semibold truncate">
                                {l.title || (l.mode === 'auction' ? 'Enchère' : 'Live')}
                              </p>
                              <p className="text-white/35 text-xs truncate">@{l.creator.username}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Right column — feed */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2.5">Feed</h2>
                  {filteredPosts.length === 0 ? (
                    <p className="text-center text-white/30 text-sm py-16">Aucun résultat.</p>
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
            ) : filteredPosts.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-16">Aucun résultat.</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
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
        </main>
      </div>
    </>
  );
}
