import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, Play, Images } from 'lucide-react';
import type { InstagramMedia } from '../../../shared/types/api';
import { api, ApiError } from '../../../shared/api/http';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

type Phase = 'loading' | 'connect' | 'media' | 'importing' | 'unavailable';

function InstagramIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={size} height={size} className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function InstagramImportModal({ open, onClose, onImported }: Props) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSelected(new Set());
    setPhase('loading');

    api
      .get<{ connected: boolean; username?: string }>('/instagram/status')
      .then((status) => {
        if (!status.connected) {
          setPhase('connect');
          return;
        }
        return api
          .get<InstagramMedia[]>('/instagram/media')
          .then((list) => {
            setMedia(list);
            setPhase('media');
          });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
        setPhase('unavailable');
      });
  }, [open]);

  async function handleConnect() {
    setError('');
    try {
      const { authorizeUrl } = await api.post<{ authorizeUrl: string }>('/instagram/authorize');
      window.location.href = authorizeUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setPhase('unavailable');
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setPhase('importing');
    setError('');
    try {
      const res = await api.post<{ imported: number; failed: { id: string; reason: string }[] }>('/instagram/import', {
        mediaIds: Array.from(selected),
      });
      onImported(res.imported);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'import.");
      setPhase('media');
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="cosmic-modal w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div className="flex items-center gap-2">
            <InstagramIcon size={18} className="text-[#ffc94d]" />
            <h2 className="text-white font-bold text-base">Importer depuis Instagram</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {phase === 'loading' && (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-white/30" />
            </div>
          )}

          {phase === 'connect' && (
            <div className="text-center py-6 space-y-4">
              <p className="text-white/60 text-sm">
                Connecte ton compte Instagram professionnel pour importer tes posts directement dans skoleomLive.
              </p>
              <button
                onClick={handleConnect}
                className="btn-skoleom mx-auto flex items-center gap-2 px-5 py-3 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] transition-all"
              >
                <InstagramIcon size={16} /> Connecter mon compte Instagram
              </button>
            </div>
          )}

          {phase === 'unavailable' && (
            <div className="text-center py-6">
              <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                {error || "L'intégration Instagram n'est pas disponible pour le moment."}
              </p>
            </div>
          )}

          {(phase === 'media' || phase === 'importing') && (
            <>
              {media.length === 0 ? (
                <p className="text-center text-white/30 text-sm py-10">Aucun post trouvé sur ce compte Instagram.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {media.map((m) => {
                    const isSelected = selected.has(m.id);
                    const thumb = m.thumbnailUrl || (m.mediaType !== 'VIDEO' ? m.mediaUrl : undefined);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggle(m.id)}
                        disabled={phase === 'importing'}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected ? 'border-[#ffc94d]' : 'border-transparent'
                        }`}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <Play size={18} className="text-white/30" />
                          </div>
                        )}
                        {m.mediaType === 'VIDEO' && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                            <Play size={10} className="text-white fill-white" />
                          </div>
                        )}
                        {m.mediaType === 'CAROUSEL_ALBUM' && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                            <Images size={10} className="text-white" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-[#ffc94d] flex items-center justify-center">
                              <Check size={13} strokeWidth={3} className="text-black" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20 mt-4">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {(phase === 'media' || phase === 'importing') && media.length > 0 && (
          <button
            onClick={handleImport}
            disabled={selected.size === 0 || phase === 'importing'}
            className="btn-skoleom w-full mt-4 py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-40 gap-2 shrink-0"
          >
            {phase === 'importing'
              ? <Loader2 size={16} className="animate-spin" />
              : `Importer${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
