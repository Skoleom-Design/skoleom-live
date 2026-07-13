import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DollarSign, Zap, Users, Film, Trophy, Home, Video } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import type { AdminStats } from '../../shared/types/api';
import { api } from '../../shared/api/http';

type Period = 'day' | 'month' | 'quarter' | 'year';

const PERIODS: { key: Period; label: string; heading: string }[] = [
  { key: 'day', label: 'Jour', heading: 'Revenus du jour' },
  { key: 'month', label: 'Mois', heading: 'Revenus du mois' },
  { key: 'quarter', label: 'Trimestre', heading: 'Revenus du trimestre' },
  { key: 'year', label: 'Année', heading: "Revenus de l'année" },
];

function StatCard({ label, value, sub, color = 'brand' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-surface-card rounded-2xl p-5 border border-white/5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color === 'brand' ? 'text-brand' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminStats>(`/admin/stats?period=${period}`)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [period]);

  const heading = PERIODS.find((p) => p.key === period)!.heading;

  return (
    <>
      <Head><title>Admin — skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
        <header className="border-b border-white/5 px-6 py-4">
          <h1 className="text-lg font-bold">Dashboard Admin</h1>
          <p className="text-xs text-gray-500">skoleomLive v2</p>
        </header>

        <div className="p-6 max-w-6xl mx-auto">
          {loading && !stats ? (
            <div className="text-gray-500">Chargement des stats...</div>
          ) : stats ? (
            <>
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                    {heading}
                  </h2>
                  <div className="flex gap-2">
                    {PERIODS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                          period === p.key
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <StatCard
                    label="Revenus totaux"
                    value={`${stats.totalRevenue} €`}
                    sub="Ce que la plateforme encaisse : commissions + boosts + part cadeaux"
                    color="brand"
                  />
                  <StatCard
                    label="GMV"
                    value={`${stats.periodGMV} €`}
                    sub={`Valeur brute des ${stats.ordersCount} ventes (avant commission)`}
                    color="white"
                  />
                  <StatCard
                    label="Commissions"
                    value={`${stats.periodCommissions} €`}
                    sub="15% sur ventes capsules"
                    color="white"
                  />
                  <StatCard
                    label="Revenus Boost"
                    value={`${stats.periodBoostRevenue} €`}
                    sub="Campagnes publicitaires"
                    color="white"
                  />
                  <StatCard
                    label="Revenus cadeaux"
                    value={`${stats.periodGiftRevenue} €`}
                    sub="50% des cadeaux envoyés en Live"
                    color="white"
                  />
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Plateforme
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Utilisateurs" value={stats.totalUsers} color="white" />
                  <StatCard label="Posts actifs" value={stats.totalPosts} color="white" />
                  <StatCard
                    label="Boosts en attente"
                    value={stats.pendingBoosts}
                    sub="À valider"
                    color={stats.pendingBoosts > 0 ? 'brand' : 'white'}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Actions rapides
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { href: '/', label: 'Voir le feed', icon: Home },
                    { href: '/live', label: 'Voir les lives', icon: Video },
                    { href: '/admin/commissions', label: 'Voir les commissions', icon: DollarSign },
                    { href: '/admin/boosts', label: 'Gérer les boosts', icon: Zap },
                    { href: '/admin/users', label: 'Utilisateurs', icon: Users },
                    { href: '/admin/posts', label: 'Modération posts', icon: Film },
                    { href: '/admin/top-creators', label: 'Top créateurs', icon: Trophy },
                  ].map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-4 bg-surface-card rounded-2xl border border-white/5 hover:border-brand/30 hover:bg-brand/5 transition-all"
                    >
                      <action.icon size={20} className="text-brand shrink-0" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="text-red-400">Erreur de chargement. Accès admin requis.</div>
          )}
        </div>
        </main>
      </div>
    </>
  );
}
