import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Search, Eye, EyeOff, Trash2, RotateCcw, XCircle } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import type { Post } from '../../shared/types/api';
import { api } from '../../shared/api/http';

type PostStatus = 'active' | 'archived' | 'moderated' | 'deleted';
type AdminPost = Post & { status: PostStatus };
type FilterKey = '' | 'active' | 'hidden' | 'trash';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'active', label: 'Affiché' },
  { key: 'hidden', label: 'Caché' },
  { key: 'trash', label: 'Corbeille' },
];

// modéré et archivé ont le même effet réel (post retiré du feed) — on les affiche
// tous les deux comme "Caché" pour éviter la confusion entre les deux statuts.
function isHidden(status: PostStatus) {
  return status !== 'active';
}

export default function AdminPosts() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterKey>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString() ? `?${params.toString()}` : '';
      api
        .get<{ posts: AdminPost[]; total: number }>(`/admin/posts${query}`)
        .then((data) => {
          setPosts(data.posts);
          setTotal(data.total);
        })
        .catch(() => {
          setPosts([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(debounce);
  }, [filter, search]);

  async function moderate(id: string, status: PostStatus) {
    try {
      await api.patch(`/admin/posts/${id}/moderate`, { status });
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch {
      // le statut affiché reste inchangé si la requête échoue
    }
  }

  // Corbeille — supprimer retire le post de la liste courante (il n'apparaît que sous l'onglet
  // Corbeille), restaurer/vider ne s'utilisent que depuis cet onglet donc on retire la ligne.
  async function moveToTrash(id: string) {
    try {
      await api.delete(`/admin/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
    } catch {
      // rien de local à annuler, la ligne reste affichée si la requête échoue
    }
  }

  async function restore(id: string) {
    try {
      await api.patch(`/admin/posts/${id}/restore`, {});
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
    } catch {
      // idem
    }
  }

  async function permanentlyDelete(id: string) {
    if (!window.confirm('Supprimer définitivement ce post ? Ses commentaires et boosts seront aussi effacés. Cette action est irréversible.')) {
      return;
    }
    try {
      await api.delete(`/admin/posts/${id}/permanent`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
    } catch {
      // idem
    }
  }

  return (
    <>
      <Head><title>Modération posts — Admin skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide pb-16 md:pb-0">
        <header className="border-b border-white/5 px-6 py-4">
          <h1 className="text-lg font-bold">Modération des posts ({total})</h1>
        </header>

        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    filter === f.key
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative ml-auto w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un post ou @pseudo..."
                className="w-full bg-surface-card border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand/50"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-gray-500">Chargement...</div>
          ) : posts.length === 0 ? (
            <div className="text-gray-500">Aucun post.</div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const inTrash = post.status === 'deleted';
                const hidden = isHidden(post.status);
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-4 p-4 bg-surface-card rounded-2xl border border-white/5"
                  >
                    <div className="w-14 h-14 rounded-xl bg-black/40 overflow-hidden flex-shrink-0">
                      {post.type === 'video' ? (
                        <video src={post.mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : (
                        <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/post/${post.id}`} className="text-sm font-semibold text-white hover:underline truncate block">
                        {post.caption || 'Sans caption'}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        @{post.creator?.username || 'inconnu'} ·{' '}
                        <span className={inTrash ? 'text-red-400' : hidden ? 'text-gray-400' : 'text-green-400'}>
                          {inTrash ? 'Dans la corbeille' : hidden ? 'Caché' : 'Affiché'}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {inTrash ? (
                        <>
                          <button
                            onClick={() => restore(post.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
                          >
                            <RotateCcw size={13} /> Restaurer
                          </button>
                          <button
                            onClick={() => permanentlyDelete(post.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <XCircle size={13} /> Supprimer définitivement
                          </button>
                        </>
                      ) : (
                        <>
                          {hidden ? (
                            <button
                              onClick={() => moderate(post.id, 'active')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
                            >
                              <Eye size={13} /> Afficher
                            </button>
                          ) : (
                            <button
                              onClick={() => moderate(post.id, 'moderated')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
                            >
                              <EyeOff size={13} /> Cacher
                            </button>
                          )}
                          <button
                            onClick={() => moveToTrash(post.id)}
                            title="Mettre à la corbeille"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/15 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </main>
      </div>
    </>
  );
}
