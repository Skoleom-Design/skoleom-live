import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Eye, Heart, Send } from 'lucide-react';
import type { Post, User } from '../../shared/types/api';
import { api, getToken } from '../../shared/api/http';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { useLanguage } from '../../client/i18n/LanguageContext';

function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = router.query as { id: string };

  const [user, setUser] = useState<(User & { bio?: string; plan?: string }) | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingSelf, setCheckingSelf] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [messagePending, setMessagePending] = useState(false);

  // On redirige vers /profile/me si l'utilisateur consulte son propre profil — cette page
  // ne doit montrer que ce qu'un visiteur externe a le droit de voir.
  useEffect(() => {
    if (!id) return;
    if (!getToken()) { setCheckingSelf(false); return; }
    api.get<{ id: string }>('/auth/me')
      .then((me) => {
        if (me.id === id) router.replace('/profile/me');
        else setCheckingSelf(false);
      })
      .catch(() => setCheckingSelf(false));
  }, [id, router]);

  useEffect(() => {
    if (!id || checkingSelf) return;

    Promise.all([
      api.get<User>(`/users/${id}`).catch(() => null),
      api.get<Post[]>(`/posts/creator/${id}`).catch(() => []),
    ]).then(([userData, postsData]) => {
      setUser(userData);
      setFollowing(!!userData?.isFollowing);
      setPosts(postsData || []);
    }).finally(() => setLoading(false));
  }, [id, checkingSelf]);

  async function toggleFollow() {
    if (!getToken()) { router.push('/auth/login'); return; }
    if (followPending || !user) return;
    setFollowPending(true);
    try {
      if (following) {
        await api.delete(`/follows/${id}`);
        setFollowing(false);
        setUser((u) => u && { ...u, followersCount: Math.max(0, (u.followersCount ?? 1) - 1) });
      } else {
        await api.post(`/follows/${id}`);
        setFollowing(true);
        setUser((u) => u && { ...u, followersCount: (u.followersCount ?? 0) + 1 });
      }
    } catch {
      // Echec silencieux — l'etat local n'a pas changé, le bouton reste dans son etat precedent.
    } finally {
      setFollowPending(false);
    }
  }

  async function sendMessage() {
    if (!getToken()) { router.push('/auth/login'); return; }
    if (messagePending) return;
    setMessagePending(true);
    try {
      const conv = await api.post<{ id: string }>(`/messages/conversations/with/${id}`);
      router.push(`/messages/${conv.id}`);
    } catch {
      setMessagePending(false);
    }
  }

  if (loading || checkingSelf) {
    return (
      <div className="flex h-screen cosmic-bg items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#a8ff35] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen cosmic-bg items-center justify-center text-white gap-4 flex-col">
        <p className="text-white/50 text-sm">Profil introuvable</p>
        <Link href="/" className="text-[#a8ff35] text-sm">← Retour au feed</Link>
      </div>
    );
  }

  return (
    <>
      <Head><title>@{user.username} — skoleomLive</title></Head>

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[700px] mx-auto px-4 py-8 pb-20 md:pb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft size={16} /> Retour
            </button>

            {/* ── Profile header ── */}
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-black shrink-0 bg-gradient-to-br from-[#a8ff35] to-[#6fe600] overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  (user.displayName || user.username)[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-[20px] font-extrabold text-white">{user.displayName || user.username}</h1>
                  <span className="text-[11px] text-white/40">@{user.username}</span>
                </div>
                {user.bio && <p className="text-[13px] text-white/45 mb-3 leading-relaxed">{user.bio}</p>}
                <div className="flex gap-5">
                  <div>
                    <span className="text-white font-bold text-[14px]">{posts.length}</span>{' '}
                    <span className="text-white/40 text-[12px]">post{posts.length > 1 ? 's' : ''}</span>
                  </div>
                  <div>
                    <span className="text-white font-bold text-[14px]">{fmt(user.followersCount ?? 0)}</span>{' '}
                    <span className="text-white/40 text-[12px]">{t('profile.followers')}</span>
                  </div>
                  <div>
                    <span className="text-white font-bold text-[14px]">{fmt(user.followingCount ?? 0)}</span>{' '}
                    <span className="text-white/40 text-[12px]">{t('profile.followingCount')}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 shrink-0">
                <button
                  onClick={toggleFollow}
                  disabled={followPending}
                  className={`px-5 py-2 rounded-full text-[13px] font-semibold transition-all disabled:opacity-60 ${
                    following
                      ? 'border border-white/15 text-white hover:bg-white/5'
                      : 'btn-skoleom hover:shadow-glow-lime-sm'
                  }`}
                >
                  {following ? t('profile.following') : t('profile.follow')}
                </button>
                <button
                  onClick={sendMessage}
                  disabled={messagePending}
                  className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-semibold border border-white/15 text-white hover:bg-white/5 transition-all disabled:opacity-60"
                >
                  <Send size={13} /> {t('profile.sendMessage')}
                </button>
              </div>
            </div>

            {/* ── Posts grid ── */}
            {posts.length === 0 ? (
              <div className="text-center py-16 text-white/40 text-sm">
                Aucun post publié pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="relative aspect-square rounded-lg overflow-hidden group bg-white/5"
                  >
                    <img
                      src={post.thumbnailUrl || post.mediaUrl}
                      alt={post.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {post.capsules && post.capsules.length > 0 && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                          🛍️ {post.capsules.length}
                        </span>
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
          </div>
        </main>
      </div>
    </>
  );
}
