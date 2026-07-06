import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Heart,
  MessageCircle,
  Share2,
  VolumeX,
  Music,
  Expand,
} from 'lucide-react';
import type { Post } from '../../../shared/types/api';
import { CapsuleDrawer } from '../Capsule/CapsuleDrawer';
import { BoostBadge } from '../Boost/BoostBadge';

interface Props {
  post: Post;
}

export function PostCard({ post }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const hasCapsules = post.capsules && post.capsules.length > 0;

  useEffect(() => {
    if (!cardRef.current || !videoRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.7 },
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative h-screen w-full snap-start snap-always flex items-center justify-center bg-black"
    >
      {post.type === 'video' ? (
        <video
          ref={videoRef}
          src={post.mediaUrl}
          className="video-fill"
          loop
          playsInline
          muted={isMuted}
          onClick={() => setIsMuted((m) => !m)}
        />
      ) : (
        <img src={post.mediaUrl} alt={post.caption} className="video-fill" />
      )}

      {post.isBoosted && (
        <div className="absolute top-4 left-4 z-10">
          <BoostBadge />
        </div>
      )}

      {/* Mute indicator */}
      {isMuted && post.type === 'video' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-black/40 rounded-full p-3">
            <VolumeX size={32} className="text-white/60" />
          </div>
        </div>
      )}

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        <div className="flex items-end justify-between gap-4">

          {/* Left: creator info + caption */}
          <div className="flex-1 min-w-0 pb-2">
            <Link
              href={`/profile/${post.creator.id}`}
              className="flex items-center gap-2 mb-2"
            >
              {post.creator.avatarUrl ? (
                <img
                  src={post.creator.avatarUrl}
                  alt={post.creator.username}
                  className="w-9 h-9 rounded-full object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-bold text-white">
                  {post.creator.username[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold text-white">
                @{post.creator.username}
              </span>
            </Link>

            {post.caption && (
              <p className="text-sm text-white/90 line-clamp-2 leading-snug">
                {post.caption}
              </p>
            )}

            {post.musicName && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-white/60">
                <Music size={12} />
                <span className="truncate">{post.musicName}</span>
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs text-brand/90 font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-col items-center gap-5 pb-2">
            {/* Like */}
            <button
              onClick={() => setLiked((l) => !l)}
              className="flex flex-col items-center gap-1 group"
            >
              <Heart
                size={28}
                className={`transition-all active:scale-125 ${
                  liked
                    ? 'text-brand fill-brand'
                    : 'text-white group-hover:text-brand/70'
                }`}
              />
              <span className="text-xs text-white/80 font-medium">
                {post.likeCount + (liked ? 1 : 0)}
              </span>
            </button>

            {/* Comments */}
            <button className="flex flex-col items-center gap-1 group">
              <MessageCircle
                size={28}
                className="text-white group-hover:text-white/70 transition-colors"
              />
              <span className="text-xs text-white/80 font-medium">0</span>
            </button>

            {/* Share */}
            <button className="flex flex-col items-center gap-1 group">
              <Share2
                size={26}
                className="text-white group-hover:text-white/70 transition-colors"
              />
              <span className="text-xs text-white/80 font-medium">
                {post.likeCount}
              </span>
            </button>

            {/* Voir le post */}
            <button
              onClick={() => router.push(`/post/${post.id}`)}
              className="flex flex-col items-center gap-1 group"
            >
              <Expand
                size={24}
                className="text-white group-hover:text-white/70 transition-colors"
              />
              <span className="text-xs text-white/80 font-medium">Voir</span>
            </button>

            {/* Capsule */}
            {hasCapsules && (
              <button
                onClick={() => setCapsuleOpen(true)}
                className="skoleom-capsule-btn skoleom-capsule-btn--breathe"
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
        </div>
      </div>

      {hasCapsules && (
        <CapsuleDrawer
          capsules={post.capsules}
          open={capsuleOpen}
          onClose={() => setCapsuleOpen(false)}
        />
      )}
    </div>
  );
}
