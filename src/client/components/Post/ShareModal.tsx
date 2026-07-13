import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2, Check, Share as ShareIcon } from 'lucide-react';
import { api } from '../../../shared/api/http';

interface Props {
  postId: string;
  caption?: string;
  open: boolean;
  onClose: () => void;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M17.6 6.3A8.9 8.9 0 0 0 12 4a8.9 8.9 0 0 0-7.7 13.4L3 20l2.7-1.2A8.9 8.9 0 1 0 17.6 6.3ZM12 18.4a7 7 0 0 1-3.6-1l-.3-.1-2.7.7.7-2.6-.2-.3A7 7 0 1 1 12 18.4Zm3.8-5.2c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.6.8-.1.1-.2.1-.4 0-.2-.1-.9-.3-1.7-1-.6-.6-1-1.3-1.2-1.5-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.3c0-.1-.5-1.2-.6-1.6-.2-.4-.3-.4-.5-.4h-.4c-.1 0-.4 0-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.1 1.6 2.5 3.9 3.4.5.2.9.4 1.3.5.5.2 1 .1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.4.2-.8.1-1Z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.9 2.3h3.3l-7.2 8.2 8.5 11.2h-6.6l-5.2-6.8-5.9 6.8H2.4l7.7-8.8L2 2.3h6.8l4.7 6.2ZM17.7 19.6h1.8L7.4 4.2H5.5Z"/>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="m21.9 4.3-3.1 15.2c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8L18 6.5c.4-.3-.1-.5-.6-.2L7.1 12.9l-4.7-1.5c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3Z"/>
    </svg>
  );
}

export function ShareModal({ postId, caption, open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;

  const url = `${window.location.origin}/post/${postId}`;
  const text = caption ? `${caption} — via skoleomLive` : 'Regarde ça sur skoleomLive';

  function track() {
    api.post(`/posts/${postId}/share`, {}).catch(() => {});
  }

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      track();
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function openShare(shareUrl: string) {
    track();
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=600');
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'skoleomLive', text, url });
        track();
      } catch {
        // annulé par l'utilisateur — rien à faire
      }
    }
  }

  const options = [
    {
      label: 'WhatsApp',
      icon: <WhatsAppIcon />,
      color: 'bg-[#25D366]/15 text-[#25D366]',
      onClick: () => openShare(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`),
    },
    {
      label: 'X',
      icon: <XIcon />,
      color: 'bg-white/10 text-white',
      onClick: () => openShare(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`),
    },
    {
      label: 'Telegram',
      icon: <TelegramIcon />,
      color: 'bg-[#26A5E4]/15 text-[#26A5E4]',
      onClick: () => openShare(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`),
    },
    {
      label: 'Facebook',
      icon: <span className="text-lg font-bold">f</span>,
      color: 'bg-[#1877F2]/15 text-[#1877F2]',
      onClick: () => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
    },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg">
          <div className="relative bg-[#0d0d0f]/97 backdrop-blur-2xl rounded-t-[24px] border-t border-x border-white/[0.06] overflow-hidden">
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <h2 className="text-white font-bold text-[15px]">Partager</h2>
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              {typeof navigator !== 'undefined' && !!navigator.share && (
                <button
                  onClick={nativeShare}
                  className="w-full flex items-center justify-center gap-2 mb-4 py-3 rounded-full bg-[#a8ff35] text-black font-semibold text-sm hover:brightness-95 transition-all"
                >
                  <ShareIcon size={16} />
                  Partager via...
                </button>
              )}

              <div className="grid grid-cols-4 gap-3 mb-5">
                {options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={opt.onClick}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${opt.color} group-hover:scale-105 transition-transform`}>
                      {opt.icon}
                    </div>
                    <span className="text-[11px] text-white/70">{opt.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={copyLink}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              >
                {copied ? (
                  <Check size={16} className="text-[#a8ff35] shrink-0" />
                ) : (
                  <Link2 size={16} className="text-white/60 shrink-0" />
                )}
                <span className="text-sm text-white/80 truncate flex-1 text-left">{url}</span>
                <span className="text-xs font-semibold text-white/50 shrink-0">
                  {copied ? 'Copié !' : 'Copier'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
