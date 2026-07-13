import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Ban, CheckCircle2, Coins, Plus, Zap, Search } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import { UserDetailModal } from '../../client/components/Admin/UserDetailModal';
import { GrantBoostModal } from '../../client/components/Admin/GrantBoostModal';
import { api, ApiError } from '../../shared/api/http';

type Toast = { kind: 'success' | 'error'; text: string };

type PlanKey = 'free' | 'premium' | 'ultra';

interface AdminUser {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  role: string;
  isActive: boolean;
  plan: PlanKey;
  walletBalance: number;
  totalEarnings: number;
  createdAt: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creditTarget, setCreditTarget] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('10');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [boostTarget, setBoostTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
  }, [page, search]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    api
      .get<{ users: AdminUser[]; total: number }>(`/admin/users?${params.toString()}`)
      .then((data) => {
        setUsers(data.users);
        setTotal(data.total);
      })
      .catch(() => {
        setUsers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }

  async function toggleActive(u: AdminUser) {
    const nextActive = !u.isActive;
    try {
      await api.patch(`/admin/users/${u.id}/status`, { isActive: nextActive });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: nextActive } : x)));
      setToast({ kind: 'success', text: nextActive ? `${u.username} réactivé.` : `${u.username} suspendu.` });
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : "Échec de l'action." });
    }
  }

  async function changePlan(u: AdminUser, plan: PlanKey) {
    try {
      await api.patch(`/admin/users/${u.id}/plan`, { plan });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, plan } : x)));
      setToast({ kind: 'success', text: `Plan de ${u.username} changé en ${plan}.` });
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : "Échec du changement de plan." });
    }
  }

  async function submitCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditTarget) return;
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) {
      setError('Montant invalide.');
      return;
    }
    try {
      const res = await api.post<{ walletBalance: number }>(`/admin/users/${creditTarget}/credit`, { amount });
      setUsers((prev) => prev.map((x) => (x.id === creditTarget ? { ...x, walletBalance: res.walletBalance } : x)));
      setToast({ kind: 'success', text: `Wallet crédité de ${amount.toFixed(2)} €.` });
      setCreditTarget(null);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }

  return (
    <>
      <Head><title>Utilisateurs — Admin skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
        <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Utilisateurs ({total})</h1>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Rechercher un @pseudo, email..."
              className="w-full bg-surface-card border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand/50"
            />
          </div>
        </header>

        <div className="p-6 max-w-6xl mx-auto">
          {loading ? (
            <div className="text-gray-500">Chargement...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                    <th className="pb-3 pr-4">Utilisateur</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Rôle</th>
                    <th className="pb-3 pr-4">Statut</th>
                    <th className="pb-3 pr-4">Plan</th>
                    <th className="pb-3 pr-4">Wallet</th>
                    <th className="pb-3 pr-4">Revenus</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4">
                        <Link href={`/profile/${u.id}`} className="font-semibold text-white hover:underline">
                          {u.displayName || u.username}
                        </Link>
                        <p className="text-xs text-gray-500">@{u.username}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                      <td className="py-3 pr-4 text-gray-300">{u.role}</td>
                      <td className="py-3 pr-4">
                        <span className={u.isActive ? 'text-green-400' : 'text-red-400'}>
                          {u.isActive ? 'Actif' : 'Suspendu'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={u.plan}
                          onChange={(e) => changePlan(u, e.target.value as PlanKey)}
                          disabled={u.role === 'admin'}
                          className="bg-surface-card border border-white/10 rounded-lg px-2 py-1 text-xs text-white disabled:opacity-40"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                          <option value="ultra">Ultra</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4 text-white">
                        {Number(u.walletBalance).toFixed(2)} €
                      </td>
                      <td className="py-3 pr-4 text-brand font-semibold">
                        {Number(u.totalEarnings).toFixed(2)} €
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={u.role === 'admin'}
                            title={u.isActive ? 'Suspendre ce compte' : 'Réactiver ce compte'}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30 ${
                              u.isActive
                                ? 'border-red-400/30 text-red-400 hover:bg-red-400/10'
                                : 'border-green-400/30 text-green-400 hover:bg-green-400/10'
                            }`}
                          >
                            {u.isActive ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                          <button
                            onClick={() => { setCreditTarget(u.id); setCreditAmount('10'); setError(''); }}
                            title="Créditer le wallet"
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-brand/30 text-brand hover:bg-brand/10 transition-colors"
                          >
                            <Coins size={14} />
                          </button>
                          <button
                            onClick={() => setBoostTarget(u)}
                            title="Offrir un boost"
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors"
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            onClick={() => setDetailTarget(u.id)}
                            title="Voir le détail"
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/15 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-surface-card border border-white/10 text-sm disabled:opacity-40"
            >
              ← Précédent
            </button>
            <span className="text-gray-500 text-sm self-center">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={users.length < 20}
              className="px-4 py-2 rounded-xl bg-surface-card border border-white/10 text-sm disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
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

      {creditTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-surface-card border border-white/10 rounded-2xl p-5">
            <h2 className="text-white font-bold text-base mb-4">Créditer le wallet</h2>
            <form onSubmit={submitCredit} className="space-y-4">
              <input
                type="number"
                step="0.01"
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand/50"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreditTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-black font-semibold text-sm transition-colors"
                >
                  Créditer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {boostTarget && (
        <GrantBoostModal
          target={boostTarget}
          onClose={() => setBoostTarget(null)}
          onGranted={(info) => setToast({ kind: 'success', text: `Boost de ${info.durationDays}j offert à ${info.username}.` })}
        />
      )}

      {detailTarget && (
        <UserDetailModal userId={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </>
  );
}
