import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  VolumeX,
  Volume2,
} from 'lucide-react';
import type { Post } from '../../../shared/types/api';
import { CapsuleDrawer } from '../Capsule/CapsuleDrawer';
import { BoostBadge } from '../Boost/BoostBadge';
import { CommentsDrawer } from './CommentsDrawer';
import { ShareModal } from './ShareModal';
import { api, ApiError, getToken } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  post: Post;
  liked?: boolean;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function InstaPostCard({ post, liked: likedProp = false }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [musicMuted, setMusicMuted] = useState(true);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [liked, setLiked] = useState(likedProp);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);

  async function handleLike() {
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

  const hasCapsules = post.capsules && post.capsules.length > 0;

  useEffect(() => {
    if (!mediaRef.current || !videoRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
        else videoRef.current?.pause();
      },
      { threshold: 0.1 },
    );
    observer.observe(mediaRef.current);
    return () => observer.disconnect();
  }, []);

  // Meme logique que la video : lecture automatique en muet des que le post entre dans le
  // cadre (autorise par tous les navigateurs, aucun son), coupee en sortant. Un tap sur la
  // pastille demasque le son — un vrai geste utilisateur, donc jamais bloque par le navigateur.
  useEffect(() => {
    if (!mediaRef.current || post.type !== 'photo' || !post.musicUrl) return;
    if (!musicAudioRef.current) {
      musicAudioRef.current = new Audio(post.musicUrl);
      musicAudioRef.current.loop = true;
      musicAudioRef.current.muted = true;
    }
    const audioEl = musicAudioRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) audioEl.play().catch(() => {});
        else audioEl.pause();
      },
      { threshold: 0.1 },
    );
    observer.observe(mediaRef.current);
    return () => {
      observer.disconnect();
      audioEl.pause();
    };
  }, [post.type, post.musicUrl]);

  function toggleMusicMute() {
    if (!musicAudioRef.current) return;
    const next = !musicAudioRef.current.muted;
    musicAudioRef.current.muted = next;
    if (!next) musicAudioRef.current.play().catch(() => {});
    setMusicMuted(next);
  }

  return (
    <article className="cosmic-modal mx-3 my-4 rounded-2xl overflow-hidden border border-white/[0.08]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-3">
        <Link href={`/profile/${post.creator.id}`} className="flex items-center gap-2.5 min-w-0">
          {post.creator.avatarUrl ? (
            <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 ${
              post.isBoosted
                ? 'ring-2 ring-[#a8ff35] ring-offset-1 ring-offset-black'
                : 'ring-1 ring-white/20'
            }`}>
              <img
                src={post.creator.avatarUrl}
                alt={post.creator.username}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#a8ff35] flex items-center justify-center text-xs font-bold text-black shrink-0">
              {post.creator.username[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight truncate">
              {post.creator.username}
            </p>
            {post.isBoosted && (
              <p className="text-[10px] text-white/40 leading-tight">{t('post.sponsored')}</p>
            )}
          </div>
        </Link>
        <button className="text-white/40 hover:text-white transition-colors p-1 ml-2">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* ── Media ── */}
      <div
        ref={mediaRef}
        id={`player-${post.id}`}
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: post.type === 'youtube' ? '9/16' : '4/5' }}
      >
        {post.type === 'video' ? (
          <>
            <video
              ref={videoRef}
              src={post.mediaUrl}
              poster={post.thumbnailUrl}
              className="w-full h-full object-cover"
              loop
              autoPlay
              playsInline
              preload="auto"
              muted={isMuted}
            />
            {/* mute toggle */}
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              {isMuted
                ? <VolumeX size={14} className="text-white" />
                : <Volume2 size={14} className="text-white" />
              }
            </button>
          </>
        ) : post.type === 'youtube' ? (
          <iframe
            src={`https://www.youtube.com/embed/${post.mediaUrl}?autoplay=1&mute=1&loop=1&playlist=${post.mediaUrl}&controls=0&playsinline=1&rel=0&modestbranding=1`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
            title={post.caption}
          />
        ) : (
          <img
            src={post.mediaUrl}
            alt={post.caption}
            className="w-full h-full object-cover"
          />
        )}

        {post.isBoosted && (
          <div className="absolute top-3 left-3 z-10">
            <BoostBadge />
          </div>
        )}

        {/* ── Capsule button — bottom right ── */}
        {hasCapsules && (
          <button
            onClick={() => setCapsuleOpen(true)}
            className="skoleom-capsule-btn skoleom-capsule-btn--breathe absolute bottom-3 right-3 z-10"
          >
            <img
              src="/skoleom-mark.png"
              alt="Skoleom"
              className="skoleom-capsule-btn-logo"
            />
            <span>{t('post.capsule')}</span>
          </button>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="px-3 pt-3 pb-1">
        <div className="inline-flex items-center gap-4 bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-4 py-2">
          <button
            onClick={handleLike}
            className="group"
            aria-label={t('post.likeAria')}
          >
            <Heart
              size={22}
              className={`transition-all duration-150 ${
                liked
                  ? 'text-red-500 fill-red-500 scale-110'
                  : 'text-white group-hover:text-white/70'
              }`}
            />
          </button>
          <span className="w-px h-4 bg-white/15" />
          <button onClick={() => setCommentsOpen(true)} className="group" aria-label={t('post.commentAria')}>
            <MessageCircle
              size={21}
              className="text-white group-hover:text-white/70 transition-colors"
            />
          </button>
          <span className="w-px h-4 bg-white/15" />
          <button onClick={() => setShareOpen(true)} className="group" aria-label={t('post.shareAria')}>
            <Send
              size={19}
              className="text-white group-hover:text-white/70 transition-colors -rotate-12"
            />
          </button>
        </div>
      </div>

      {/* ── Likes ── */}
      <div className="px-3 py-0.5">
        <p className="text-[13px] font-semibold text-white">
          {t('post.likesCount', { count: fmt(likeCount) })}
        </p>
      </div>

      {/* ── Caption ── */}
      {post.caption && (
        <div className="px-3 py-0.5">
          <p className="text-[13px] text-white leading-snug">
            <Link
              href={`/profile/${post.creator.id}`}
              className="font-semibold mr-1.5 hover:text-white/80"
            >
              {post.creator.username}
            </Link>
            <span className="text-white/80">{post.caption}</span>
          </p>
        </div>
      )}

      {/* ── Comments ── */}
      {commentCount > 0 && (
        <button onClick={() => setCommentsOpen(true)} className="px-3 py-0.5 block">
          <p className="text-[13px] text-white/40 hover:text-white/60 transition-colors">
            {t('post.viewComments', { count: fmt(commentCount), plural: commentCount > 1 ? 's' : '' })}
          </p>
        </button>
      )}

      {/* ── Tags ── */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-3 py-0.5 flex gap-1.5 flex-wrap">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/?q=${encodeURIComponent(tag)}`}
              className="text-[12px] text-[#a8ff35]/80 font-medium hover:text-[#a8ff35] hover:underline"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* ── Music — lecture uniquement pour les photos (une video a deja sa propre piste
          audio, geree par isMuted ci-dessus, pas de raison de superposer les deux). ── */}
      {post.musicName && (
        <div className="px-3 py-0.5 pb-3">
          {post.type === 'photo' && post.musicUrl ? (
            <button
              type="button"
              onClick={toggleMusicMute}
              className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors"
            >
              {musicMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
              🎵 {post.musicName}
            </button>
          ) : (
            <p className="text-[11px] text-white/35">🎵 {post.musicName}</p>
          )}
        </div>
      )}

      {hasCapsules && (
        <CapsuleDrawer
          capsules={post.capsules}
          open={capsuleOpen}
          onClose={() => setCapsuleOpen(false)}
        />
      )}

      <CommentsDrawer
        postId={post.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
      />

      <ShareModal
        postId={post.id}
        caption={post.caption}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </article>
  );
}
