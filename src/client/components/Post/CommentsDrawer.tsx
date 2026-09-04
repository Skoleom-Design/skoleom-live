import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { X, Send, Trash2 } from 'lucide-react';
import type { Comment } from '../../../shared/types/api';
import { api, ApiError, getToken, getStoredUser } from '../../../shared/api/http';

interface Props {
  postId: string;
  postCreatorId: string;
  open: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

function timeAgo(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export function CommentsDrawer({ postId, postCreatorId, open, onClose, onCommentAdded, onCommentDeleted }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const myId = getStoredUser()?.id;
  const isPostOwner = myId === postCreatorId;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<Comment[]>(`/posts/${postId}/comments`)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [open, postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!getToken()) {
      router.push('/auth/login');
      return;
    }
    if (!text.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const comment = await api.post<Comment>(`/posts/${postId}/comments`, { text: text.trim() });
      setComments((prev) => [comment, ...prev]);
      setText('');
      onCommentAdded?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de l\'envoi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await api.delete(`/posts/${postId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la suppression.');
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg">
          <div
            className="cosmic-modal-glass backdrop-blur-2xl rounded-t-[24px] border-t border-x border-white/[0.06] overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            <div className="flex justify-center pt-3 pb-0 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/[0.06]">
              <h2 className="text-white font-bold text-[15px]">Commentaires</h2>
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-3 space-y-4">
              {loading ? (
                <p className="text-white/40 text-sm text-center py-6">Chargement...</p>
              ) : comments.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-6">Aucun commentaire pour le moment. Sois le premier !</p>
              ) : (
                comments.map((c) => {
                  const canDelete = c.user.id === myId || isPostOwner;
                  return (
                    <div key={c.id} className="group flex items-start gap-2.5">
                      {c.user.avatarUrl ? (
                        <img src={c.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#ffc94d] flex items-center justify-center text-xs font-bold text-black shrink-0">
                          {c.user.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-white leading-snug">
                          <span className="font-semibold mr-1.5">{c.user.username}</span>
                          <span className="text-white/80">{c.text}</span>
                        </p>
                        <p className="text-[11px] text-white/35 mt-0.5">{timeAgo(c.createdAt)}</p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          title="Supprimer ce commentaire"
                          className="shrink-0 text-white/25 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={submit} className="px-4 py-3 border-t border-white/[0.06] shrink-0">
              {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
              <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] rounded-full px-4 py-2.5">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 bg-transparent text-white text-[13px] placeholder-white/30 outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="text-[#ffc94d] hover:text-[#c3ff70] transition-colors disabled:opacity-30 shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
