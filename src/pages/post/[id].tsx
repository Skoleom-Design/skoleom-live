import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageCircle, Share2, VolumeX, Volume2, Music } from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { CapsuleDrawer } from '../../client/components/Capsule/CapsuleDrawer';
import { BoostBadge } from '../../client/components/Boost/BoostBadge';
import { CommentsDrawer } from '../../client/components/Post/CommentsDrawer';
import { ShareModal } from '../../client/components/Post/ShareModal';
import type { Post } from '../../shared/types/api';
import { api, ApiError, getToken } from '../../shared/api/http';

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
  const [likePending, setLikePending] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [playing, setPlaying] = useState(true);

  const fetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // Le double-montage StrictMode (dev) rejouerait sinon cet effet une 2e fois pour le meme id,
    // ce qui compterait la vue en double cote serveur (l'incrementation est un effet de bord de
    // ce GET) — cette ref (qui survit au double-montage) garantit une seule requete par post.
    if (fetchedIdRef.current === id) return;
    fetchedIdRef.current = id;
    api
      .get<Post>(`/posts/${id}`)
      .then((data) => setPost(data || null))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!post) return;
    setLikeCount(post.likeCount);
    setCommentCount(post.commentCount ?? 0);
    if (!getToken()) return;
    api
      .get<Post[]>('/posts/liked/me')
      .then((liked) => setLiked(liked.some((p) => p.id === post.id)))
      .catch(() => {});
  }, [post]);

  async function handleLike() {
    if (!post) return;
    if (!getToken()) {
      router.push('/auth/login');
      return;
    }
    if (likePending) return;
    setLikePending(true);
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(`/posts/${post.id}/like`);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/auth/login');
    } finally {
      setLikePending(false);
    }
  }

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
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-white/50 text-sm">
          <p>Post introuvable</p>
          <Link href="/" className="text-[#ffc94d] underline">← Retour au feed</Link>
        </main>
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

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 pb-20 md:pb-6">
          <div className="w-full max-w-md mx-auto">
            <button
              onClick={() => router.back()}
              className="mb-4 w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={16} className="text-white/70" />
            </button>

            {/* Un vrai cadre "carte" — comme les posts affichés sur Explorer — avec une bordure
                colorée bien visible (au lieu d'un simple border-white/[0.08] qui se fond dans le
                fond noir et ne ressort pas). */}
            <article className="cosmic-modal rounded-2xl overflow-hidden border border-[#ffc94d]/30 shadow-glow-lime-sm">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-3">
                <Link href={`/profile/${post.creator.id}`} className="flex items-center gap-2.5 min-w-0">
                  {post.creator.avatarUrl ? (
                    <img src={post.creator.avatarUrl} alt={post.creator.username} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#ffc94d] flex items-center justify-center text-xs font-bold text-black shrink-0">
                      {post.creator.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white leading-tight truncate">{post.creator.username}</p>
                    {post.creator.displayName && (
                      <p className="text-[11px] text-white/40 leading-tight truncate">{post.creator.displayName}</p>
                    )}
                  </div>
                </Link>
                {post.isBoosted && <BoostBadge />}
              </div>

              {/* Media */}
              <div className="relative w-full aspect-[4/5] bg-black overflow-hidden">
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

                {post.type === 'video' && (
                  <button
                    onClick={() => setMuted((m) => !m)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                  >
                    {muted
                      ? <VolumeX size={16} className="text-white" />
                      : <Volume2 size={16} className="text-white" />
                    }
                  </button>
                )}

                {hasCapsules && (
                  <button
                    onClick={() => setCapsuleOpen(true)}
                    className="skoleom-capsule-btn skoleom-capsule-btn--breathe absolute bottom-3 right-3 z-10"
                  >
                    <img src="/skoleom-mark.png" alt="Skoleom" className="skoleom-capsule-btn-logo" />
                    <span>Capsule</span>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pt-3 pb-1">
                <div className="inline-flex items-center gap-4 bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-4 py-2">
                  <button onClick={handleLike} className="group" aria-label="J'aime">
                    <Heart
                      size={22}
                      className={`transition-all duration-150 ${liked ? 'text-red-500 fill-red-500 scale-110' : 'text-white group-hover:text-white/70'}`}
                    />
                  </button>
                  <span className="w-px h-4 bg-white/15" />
                  <button onClick={() => setCommentsOpen(true)} className="group" aria-label="Commenter">
                    <MessageCircle size={21} className="text-white group-hover:text-white/70 transition-colors" />
                  </button>
                  <span className="w-px h-4 bg-white/15" />
                  <button onClick={() => setShareOpen(true)} className="group" aria-label="Partager">
                    <Share2 size={19} className="text-white group-hover:text-white/70 transition-colors -rotate-12" />
                  </button>
                </div>
              </div>

              {/* Likes */}
              <div className="px-3 py-0.5">
                <p className="text-[13px] font-semibold text-white">{formatCount(likeCount)} j&apos;aime{likeCount > 1 ? 's' : ''}</p>
              </div>

              {/* Caption */}
              {post.caption && (
                <div className="px-3 py-0.5">
                  <p className="text-[13px] text-white leading-snug">
                    <Link href={`/profile/${post.creator.id}`} className="font-semibold mr-1.5 hover:text-white/80">
                      {post.creator.username}
                    </Link>
                    <span className="text-white/80">{post.caption}</span>
                  </p>
                </div>
              )}

              {/* Comments */}
              {commentCount > 0 && (
                <button onClick={() => setCommentsOpen(true)} className="px-3 py-0.5 block">
                  <p className="text-[13px] text-white/40 hover:text-white/60 transition-colors">
                    Voir les {formatCount(commentCount)} commentaire{commentCount > 1 ? 's' : ''}
                  </p>
                </button>
              )}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="px-3 py-0.5 flex gap-1.5 flex-wrap">
                  {post.tags.map((tag) => (
                    <span key={tag} className="text-[12px] text-[#ffc94d]/80 font-medium">#{tag}</span>
                  ))}
                </div>
              )}

              {/* Music + stats */}
              <div className="px-3 py-0.5 pb-3 flex items-center justify-between">
                {post.musicName ? (
                  <p className="text-[11px] text-white/35">🎵 {post.musicName}</p>
                ) : <span />}
                <p className="text-[11px] text-white/30">
                  {formatCount(post.viewCount)} vues{totalSold > 0 ? ` · ${totalSold} vendu${totalSold > 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </article>
          </div>
        </main>
      </div>

      <CommentsDrawer
        postId={post.id}
        postCreatorId={post.creator.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
        onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
      />

      <ShareModal
        postId={post.id}
        caption={post.caption}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {hasCapsules && (
        <CapsuleDrawer capsules={post.capsules} open={capsuleOpen} onClose={() => setCapsuleOpen(false)} />
      )}
    </>
  );
}
