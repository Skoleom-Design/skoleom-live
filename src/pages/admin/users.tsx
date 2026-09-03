import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Ban, Check, CheckCircle2, Coins, Plus, Zap, Search, Trash2, RotateCcw, XCircle, SlidersHorizontal, ArchiveX } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import { UserDetailModal } from '../../client/components/Admin/UserDetailModal';
import { GrantBoostModal } from '../../client/components/Admin/GrantBoostModal';
import { api, ApiError } from '../../shared/api/http';

type Toast = { kind: 'success' | 'error'; text: string };

// Case a cocher maison — le rendu natif du navigateur (petit, gris, hors charte) detonnait sur
// fond sombre. Bouton carre + coche brand, memes codes visuels que le reste de l'admin.
function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        checked ? 'bg-brand border-brand' : 'border-white/20 bg-black/20 hover:border-white/40'
      }`}
    >
      {checked && <Check size={13} strokeWidth={3} className="text-black" />}
    </button>
  );
}

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
  isOnline: boolean;
}

// Rafraichit juste assez souvent pour que le statut "en ligne" reste a peu pres a jour sans
// action de l'admin — meme principe que le polling des notifications dans Sidebar.tsx.
const PRESENCE_POLL_MS = 20_000;

const SORT_OPTIONS = [
  { value: 'createdAt:DESC', label: 'Inscription (récent → ancien)' },
  { value: 'createdAt:ASC', label: 'Inscription (ancien → récent)' },
  { value: 'username:ASC', label: 'Pseudo (A → Z)' },
  { value: 'username:DESC', label: 'Pseudo (Z → A)' },
  { value: 'walletBalance:DESC', label: 'Solde wallet (haut → bas)' },
  { value: 'walletBalance:ASC', label: 'Solde wallet (bas → haut)' },
  { value: 'totalEarnings:DESC', label: 'Revenus (haut → bas)' },
  { value: 'totalEarnings:ASC', label: 'Revenus (bas → haut)' },
] as const;

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
  const [sort, setSort] = useState<string>('createdAt:DESC');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [onlineFilter, setOnlineFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [trashed, setTrashed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Un compte admin ne peut ni etre selectionne ni faire l'objet d'une action groupee — meme
  // garde-fou que les boutons individuels (voir toggleActive/trashUser).
  const selectableUsers = users.filter((u) => u.role !== 'admin');
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((u) => selected.has(u.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(selectableUsers.map((u) => u.id));
    });
  }

  function toggleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeFilterCount = [roleFilter, statusFilter, planFilter, onlineFilter].filter(Boolean).length
    + (sort !== 'createdAt:DESC' ? 1 : 0);

  useEffect(() => {
    setSelected(new Set());
    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
  }, [page, search, sort, roleFilter, statusFilter, planFilter, onlineFilter, trashed]);

  useEffect(() => {
    const interval = setInterval(load, PRESENCE_POLL_MS);
    return () => clearInterval(interval);
  }, [page, search, sort, roleFilter, statusFilter, planFilter, onlineFilter, trashed]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Ferme le panneau de filtres au clic en dehors — evite d'avoir a re-cliquer sur le bouton pour le refermer.
  useEffect(() => {
    if (!filtersOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [filtersOpen]);

  function load() {
    setLoading(true);
    const [sortBy, sortDir] = sort.split(':');
    const params = new URLSearchParams({ page: String(page), limit: '20', sortBy, sortDir });
    if (search.trim()) params.set('search', search.trim());
    if (trashed) {
      params.set('trashed', 'true');
    } else {
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('isActive', statusFilter);
      if (planFilter) params.set('plan', planFilter);
      if (onlineFilter) params.set('isOnline', onlineFilter);
    }
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

  function switchView(nextTrashed: boolean) {
    setTrashed(nextTrashed);
    setPage(1);
    setFiltersOpen(false);
    setSelected(new Set());
  }

  // Actions groupees — reutilise les memes endpoints que les boutons par ligne, appeles en
  // parallele. Une action qui echoue pour un compte (ex: droits) n'empeche pas les autres de
  // passer ; le toast final resume les deux comptes.
  async function bulkAction(action: 'activate' | 'deactivate' | 'trash' | 'restore' | 'permanent') {
    const targets = users.filter((u) => selected.has(u.id));
    if (targets.length === 0) return;
    if (action === 'permanent' && !window.confirm(
      `Supprimer définitivement ${targets.length} compte(s) ? Tous leurs posts, capsules, commandes et messages seront aussi supprimés. Cette action est irréversible.`,
    )) {
      return;
    }

    setBulkLoading(true);
    const results = await Promise.allSettled(targets.map((u) => {
      switch (action) {
        case 'activate': return api.patch(`/admin/users/${u.id}/status`, { isActive: true });
        case 'deactivate': return api.patch(`/admin/users/${u.id}/status`, { isActive: false });
        case 'trash': return api.delete(`/admin/users/${u.id}`);
        case 'restore': return api.patch(`/admin/users/${u.id}/restore`, {});
        case 'permanent': return api.delete(`/admin/users/${u.id}/permanent`);
      }
    }));
    const succeededIds = targets.filter((_, i) => results[i].status === 'fulfilled').map((u) => u.id);
    const failedCount = results.length - succeededIds.length;

    if (action === 'activate' || action === 'deactivate') {
      setUsers((prev) => prev.map((u) => (succeededIds.includes(u.id) ? { ...u, isActive: action === 'activate' } : u)));
    } else {
      setUsers((prev) => prev.filter((u) => !succeededIds.includes(u.id)));
      setTotal((prev) => prev - succeededIds.length);
    }
    setSelected(new Set());
    setBulkLoading(false);
    setToast(
      failedCount > 0
        ? { kind: 'error', text: `${succeededIds.length} compte(s) mis à jour, ${failedCount} échec(s).` }
        : { kind: 'success', text: `${succeededIds.length} compte(s) mis à jour.` },
    );
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

  // Corbeille — supprimer retire le compte de la liste courante (il n'apparaît que sous l'onglet
  // Corbeille), restaurer/vider ne s'utilisent que depuis cet onglet donc on retire la ligne.
  async function trashUser(u: AdminUser) {
    try {
      await api.delete(`/admin/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setTotal((prev) => prev - 1);
      setToast({ kind: 'success', text: `${u.username} déplacé vers la corbeille.` });
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : 'Échec de la suppression.' });
    }
  }

  async function restoreUser(u: AdminUser) {
    try {
      await api.patch(`/admin/users/${u.id}/restore`, {});
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setTotal((prev) => prev - 1);
      setToast({ kind: 'success', text: `${u.username} restauré.` });
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : 'Échec de la restauration.' });
    }
  }

  async function permanentlyDeleteUser(u: AdminUser) {
    if (!window.confirm(`Supprimer définitivement le compte de ${u.username} ? Tous ses posts, capsules, commandes et messages seront aussi supprimés. Cette action est irréversible.`)) {
      return;
    }
    try {
      await api.delete(`/admin/users/${u.id}/permanent`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setTotal((prev) => prev - 1);
      setToast({ kind: 'success', text: `${u.username} supprimé définitivement.` });
    } catch (err) {
      setToast({ kind: 'error', text: err instanceof ApiError ? err.message : 'Échec de la suppression.' });
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

        <main className="flex-1 overflow-y-auto scrollbar-hide pb-16 md:pb-0">
        <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {trashed ? 'Corbeille' : 'Utilisateurs'} ({total})
          </h1>
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

        <div className="px-6 pt-4 flex items-center gap-2 max-w-6xl mx-auto">
          {!trashed && (
            <div className="relative" ref={filtersRef}>
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                  filtersOpen || activeFilterCount > 0
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-white/10 text-gray-300 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={14} />
                Filtres
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-brand text-black text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {filtersOpen && (
                <div className="absolute z-20 top-full mt-2 left-0 w-72 bg-surface-card border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl">
                  <div>
                    <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Trier par</label>
                    <select
                      value={sort}
                      onChange={(e) => { setPage(1); setSort(e.target.value); }}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/50"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Rôle</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/50"
                    >
                      <option value="">Tous les rôles</option>
                      <option value="creator">Créateur</option>
                      <option value="buyer">Acheteur</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Statut</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/50"
                    >
                      <option value="">Tous les statuts</option>
                      <option value="true">Actif</option>
                      <option value="false">Suspendu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Plan</label>
                    <select
                      value={planFilter}
                      onChange={(e) => { setPage(1); setPlanFilter(e.target.value); }}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/50"
                    >
                      <option value="">Tous les plans</option>
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                      <option value="ultra">Ultra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Connexion</label>
                    <select
                      value={onlineFilter}
                      onChange={(e) => { setPage(1); setOnlineFilter(e.target.value); }}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/50"
                    >
                      <option value="">Tous</option>
                      <option value="true">En ligne</option>
                      <option value="false">Hors ligne</option>
                    </select>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { setPage(1); setRoleFilter(''); setStatusFilter(''); setPlanFilter(''); setOnlineFilter(''); setSort('createdAt:DESC'); }}
                      className="w-full text-center text-xs text-gray-400 hover:text-white underline pt-1"
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => switchView(!trashed)}
            title={trashed ? 'Retour à la liste' : 'Corbeille'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              trashed
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-white/10 text-gray-300 hover:text-white'
            }`}
          >
            {trashed ? <ArchiveX size={14} /> : <Trash2 size={14} />}
            Corbeille
          </button>

          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto bg-surface-card border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-sm text-white font-medium">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
              <div className="w-px h-4 bg-white/10 mx-1" />
              {trashed ? (
                <>
                  <button
                    onClick={() => bulkAction('restore')}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw size={13} /> Restaurer
                  </button>
                  <button
                    onClick={() => bulkAction('permanent')}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <XCircle size={13} /> Supprimer déf.
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => bulkAction('deactivate')}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  >
                    <Ban size={13} /> Suspendre
                  </button>
                  <button
                    onClick={() => bulkAction('activate')}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle2 size={13} /> Réactiver
                  </button>
                  <button
                    onClick={() => bulkAction('trash')}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} /> Corbeille
                  </button>
                </>
              )}
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-white transition-colors px-1">
                Désélectionner
              </button>
            </div>
          )}
        </div>

        <div className="p-6 max-w-6xl mx-auto">
          {loading ? (
            <div className="text-gray-500">Chargement...</div>
          ) : users.length === 0 ? (
            <div className="text-gray-500">{trashed ? 'Corbeille vide.' : 'Aucun utilisateur.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                    <th className="pb-2.5 pr-2 w-8">
                      <Checkbox checked={allSelected} onChange={toggleSelectAll} />
                    </th>
                    <th className="pb-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider">Utilisateur</th>
                    {!trashed && <th className="pb-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider">Rôle &amp; statut</th>}
                    {!trashed && <th className="pb-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider">Plan</th>}
                    <th className="pb-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-right">Wallet</th>
                    <th className="pb-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-right">Revenus</th>
                    <th className="pb-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wider">Inscrit</th>
                    <th className="pb-2.5 text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-white/5 transition-colors ${selected.has(u.id) ? 'bg-brand/[0.04]' : ''}`}>
                      <td className="py-2.5 pr-2">
                        <Checkbox checked={selected.has(u.id)} onChange={() => toggleSelectOne(u.id)} disabled={u.role === 'admin'} />
                      </td>
                      <td className="py-2.5 pr-3 max-w-[220px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${u.isOnline ? 'bg-green-400' : 'bg-gray-600'}`}
                            title={u.isOnline ? 'En ligne' : 'Hors ligne'}
                          />
                          <Link href={`/profile/${u.id}`} className="font-semibold text-white hover:underline truncate">
                            {u.displayName || u.username}
                          </Link>
                        </div>
                        <p className="text-[11px] text-gray-500 pl-3.5 truncate">@{u.username}</p>
                        <p className="text-[11px] text-gray-600 pl-3.5 truncate" title={u.email}>{u.email}</p>
                      </td>
                      {!trashed && (
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-gray-300 text-[11px] font-medium capitalize">
                              {u.role}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium ${
                                u.isActive ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                              }`}
                            >
                              {u.isActive ? 'Actif' : 'Suspendu'}
                            </span>
                          </div>
                        </td>
                      )}
                      {!trashed && (
                        <td className="py-2.5 pr-3">
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
                      )}
                      <td className="py-2.5 pr-3 text-white text-right tabular-nums whitespace-nowrap">
                        {Number(u.walletBalance).toFixed(2)} €
                      </td>
                      <td className="py-2.5 pr-3 text-brand font-semibold text-right tabular-nums whitespace-nowrap">
                        {Number(u.totalEarnings).toFixed(2)} €
                      </td>
                      <td className="py-2.5 pr-3 text-gray-400 whitespace-nowrap tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-2.5">
                        {trashed ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => restoreUser(u)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
                            >
                              <RotateCcw size={13} /> Restaurer
                            </button>
                            <button
                              onClick={() => permanentlyDeleteUser(u)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <XCircle size={13} /> Supprimer définitivement
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleActive(u)}
                              disabled={u.role === 'admin'}
                              title={u.isActive ? 'Suspendre ce compte' : 'Réactiver ce compte'}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30 ${
                                u.isActive
                                  ? 'border-red-400/30 text-red-400 hover:bg-red-400/10'
                                  : 'border-green-400/30 text-green-400 hover:bg-green-400/10'
                              }`}
                            >
                              {u.isActive ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                            </button>
                            <button
                              onClick={() => { setCreditTarget(u.id); setCreditAmount('10'); setError(''); }}
                              title="Créditer le wallet"
                              className="w-7 h-7 rounded-lg flex items-center justify-center border border-brand/30 text-brand hover:bg-brand/10 transition-colors"
                            >
                              <Coins size={13} />
                            </button>
                            <button
                              onClick={() => setBoostTarget(u)}
                              title="Offrir un boost"
                              className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors"
                            >
                              <Zap size={13} />
                            </button>
                            <button
                              onClick={() => setDetailTarget(u.id)}
                              title="Voir le détail"
                              className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/15 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              onClick={() => trashUser(u)}
                              disabled={u.role === 'admin'}
                              title="Mettre à la corbeille"
                              className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/15 text-gray-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
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
