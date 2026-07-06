import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  VolumeX,
  Volume2,
} from 'lucide-react';
import type { Post } from '../../../shared/types/api';
import { CapsuleDrawer } from '../Capsule/CapsuleDrawer';
import { BoostBadge } from '../Boost/BoostBadge';

interface Props {
  post: Post;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function InstaPostCard({ post }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);

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

  return (
    <article className="border-b border-white/[0.06] mb-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-3">
        <Link href={`/profile/${post.creator.id}`} className="flex items-center gap-2.5 min-w-0">
          {post.creator.avatarUrl ? (
            <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 ${
              post.isBoosted
                ? 'ring-2 ring-[#0066FF] ring-offset-1 ring-offset-black'
                : 'ring-1 ring-white/20'
            }`}>
              <img
                src={post.creator.avatarUrl}
                alt={post.creator.username}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0066FF] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {post.creator.username[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight truncate">
              {post.creator.username}
            </p>
            {post.isBoosted && (
              <p className="text-[10px] text-white/40 leading-tight">Sponsorisé</p>
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
            <span>Capsule</span>
          </button>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center px-3 pt-3 pb-1 gap-1">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setLiked((l) => !l)}
            className="group p-0.5"
            aria-label="J'aime"
          >
            <Heart
              size={26}
              className={`transition-all duration-150 ${
                liked
                  ? 'text-red-500 fill-red-500 scale-110'
                  : 'text-white group-hover:text-white/70'
              }`}
            />
          </button>
          <button className="group p-0.5" aria-label="Commenter">
            <MessageCircle
              size={25}
              className="text-white group-hover:text-white/70 transition-colors"
            />
          </button>
          <button className="group p-0.5" aria-label="Partager">
            <Send
              size={23}
              className="text-white group-hover:text-white/70 transition-colors -rotate-12"
            />
          </button>
        </div>
        <button
          onClick={() => setSaved((s) => !s)}
          className="p-0.5"
          aria-label="Enregistrer"
        >
          <Bookmark
            size={24}
            className={`transition-all ${
              saved ? 'text-white fill-white' : 'text-white/80 hover:text-white'
            }`}
          />
        </button>
      </div>

      {/* ── Likes ── */}
      <div className="px-3 py-0.5">
        <p className="text-[13px] font-semibold text-white">
          {fmt(post.likeCount + (liked ? 1 : 0))} j&apos;aime
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

      {/* ── Tags ── */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-3 py-0.5 flex gap-1.5 flex-wrap">
          {post.tags.map((tag) => (
            <span key={tag} className="text-[12px] text-[#0066FF]/80 font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Music ── */}
      {post.musicName && (
        <div className="px-3 py-0.5 pb-3">
          <p className="text-[11px] text-white/35">🎵 {post.musicName}</p>
        </div>
      )}

      {hasCapsules && (
        <CapsuleDrawer
          capsules={post.capsules}
          open={capsuleOpen}
          onClose={() => setCapsuleOpen(false)}
        />
      )}
    </article>
  );
}
