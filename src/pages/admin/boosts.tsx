import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Plus, X, Check } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import { GrantBoostModal } from '../../client/components/Admin/GrantBoostModal';
import type { Boost } from '../../shared/types/api';
import { api, ApiError } from '../../shared/api/http';

type Toast = { kind: 'success' | 'error'; text: string };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-yellow-400' },
  active: { label: 'Actif', color: 'text-green-400' },
  completed: { label: 'Terminé', color: 'text-gray-400' },
  cancelled: { label: 'Annulé', color: 'text-red-400' },
};

const FILTERS = ['', 'active', 'completed', 'cancelled'] as const;

function fmt(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminBoosts() {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('');
  const [loading, setLoading] = useState(true);
  const [grantOpen, setGrantOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    load();
  }, [filter]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function load() {
    setLoading(true);
    const query = filter ? `?status=${filter}` : '';
    api
      .get<{ boosts: Boost[]; total: number }>(`/admin/boosts${query}`)
      .then((data) => {
        setBoosts(data.boosts);
        setTotal(data.total);
      })
      .catch(() => {
        setBoosts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }

  async function cancelBoost(boost: Boost) {
    try {
      await api.patch(`/admin/boosts/${boost.id}/cancel`, {});
      setToast({ kind: 'success', text: `Boost de ${boost.user.username} retiré.` });
      load();
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : "Échec du retrait." });
    }
  }

  async function approveBoost(boost: Boost) {
    const wasCancelled = boost.status === 'cancelled';
    try {
      await api.patch(`/admin/boosts/${boost.id}/approve`, {});
      setToast({
        kind: 'success',
        text: wasCancelled
          ? `Boost de ${boost.user.username} réactivé.`
          : `Boost de ${boost.user.username} approuvé et activé.`,
      });
      load();
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : "Échec de l'action." });
    }
  }

  return (
    <>
      <Head><title>Boosts — Admin skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide pb-16 md:pb-0">
        <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Campagnes Boost ({total})</h1>
          <button
            onClick={() => setGrantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-[#f59e0b] hover:bg-[#d98a08] text-black transition-colors"
          >
            <Plus size={14} /> Offrir un boost
          </button>
        </header>

        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex gap-2 mb-6">
            {FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                  filter === s
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {s === '' ? 'Tous' : STATUS_LABELS[s]?.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-gray-500">Chargement...</div>
          ) : boosts.length === 0 ? (
            <div className="text-gray-500">Aucun boost.</div>
          ) : (
            <div className="space-y-3">
              {boosts.map((boost) => {
                const s = STATUS_LABELS[boost.status] || { label: boost.status, color: 'text-white' };
                const canCancel = boost.status === 'active' || boost.status === 'pending';
                return (
                  <div
                    key={boost.id}
                    className="flex items-center justify-between p-4 bg-surface-card rounded-2xl border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      {boost.user?.avatarUrl ? (
                        <img src={boost.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center font-bold text-black text-sm">
                          {boost.user?.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {boost.user?.displayName || boost.user?.username || 'Utilisateur inconnu'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          @{boost.user?.username} · Pris le {fmt(boost.createdAt)} · {boost.durationDays}j · {boost.objective}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-sm font-bold text-brand">{Number(boost.budget).toFixed(2)} €</p>
                        <p className="text-xs text-gray-400">{boost.impressions} impressions</p>
                      </div>
                      <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                      {(boost.status === 'pending' || boost.status === 'cancelled') && (
                        <button
                          onClick={() => approveBoost(boost)}
                          title={boost.status === 'cancelled' ? 'Revenir sur le retrait et réactiver' : 'Approuver et activer ce boost'}
                          className="w-8 h-8 rounded-lg flex items-center justify-center border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => cancelBoost(boost)}
                          title="Retirer ce boost"
                          className="w-8 h-8 rounded-lg flex items-center justify-center border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <X size={14} />
                        </button>
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

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-xl border text-sm font-medium shadow-lg ${
            toast.kind === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {toast.text}
        </div>
      )}

      {grantOpen && (
        <GrantBoostModal
          onClose={() => setGrantOpen(false)}
          onGranted={(info) => {
            setToast({ kind: 'success', text: `Boost de ${info.durationDays}j offert à ${info.username}.` });
            load();
          }}
        />
      )}
    </>
  );
}
