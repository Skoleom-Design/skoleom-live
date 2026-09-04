import { useRef } from 'react';
import { Heart } from 'lucide-react';

export interface VideoItem {
  id: string;
  mediaUrl: string;
  thumbnail: string;
  username: string;
  likes: string;
  hasCapsule: boolean;
}

function VideoCard({ item }: { item: VideoItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function onEnter() {
    videoRef.current?.play().catch(() => {});
  }
  function onLeave() {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer bg-[#341839] group"
      style={{ aspectRatio: '9/16' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <video
        ref={videoRef}
        src={item.mediaUrl}
        poster={item.thumbnail}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loop
        muted
        playsInline
        preload="none"
      />

      {/* gradient bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />

      {/* capsule badge */}
      {item.hasCapsule && (
        <div className="absolute top-2 right-2 z-10">
          <span
            className="skoleom-capsule-btn"
            style={{ padding: '3px 8px 3px 5px', fontSize: '10px', gap: '4px' }}
          >
            <img
              src="/skoleom-mark.png"
              alt=""
              style={{ width: '13px', height: '13px', objectFit: 'contain' }}
            />
            Capsule
          </span>
        </div>
      )}

      {/* info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none">
        <p className="text-white text-[11px] font-bold truncate leading-tight">
          @{item.username}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Heart size={9} className="text-white/60" />
          <span className="text-white/60 text-[10px] font-medium">{item.likes}</span>
        </div>
      </div>

      {/* play overlay on hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function VideoShelf({ items }: { items: VideoItem[] }) {
  return (
    <section className="mt-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-t border-white/[0.06]">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-white/35">
            Vidéos pour toi
          </p>
        </div>
        <button className="text-[12px] text-[#0066FF] font-semibold hover:text-[#4488ff] transition-colors">
          Voir tout →
        </button>
      </div>

      {/* 3-col grid */}
      <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-10">
        {items.map((item) => (
          <VideoCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
