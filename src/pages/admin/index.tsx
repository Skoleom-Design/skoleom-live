import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { AdminStats } from '../../shared/types/api';

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head><title>Admin — skoleomLive</title></Head>

      <div className="min-h-screen bg-surface text-white">
        <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Dashboard Admin</h1>
            <p className="text-xs text-gray-500">skoleomLive v2</p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Retour au feed
          </Link>
        </header>

        <main className="p-6 max-w-6xl mx-auto">
          {loading ? (
            <div className="text-gray-500">Chargement des stats...</div>
          ) : stats ? (
            <>
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Revenus du mois
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Revenus totaux"
                    value={`${stats.totalRevenue} €`}
                    sub="Commissions + boosts"
                    color="brand"
                  />
                  <StatCard
                    label="GMV"
                    value={`${stats.monthlyGMV} €`}
                    sub={`${stats.ordersCount} ventes`}
                    color="white"
                  />
                  <StatCard
                    label="Commissions"
                    value={`${stats.monthlyCommissions} €`}
                    sub="15% sur ventes capsules"
                    color="white"
                  />
                  <StatCard
                    label="Revenus Boost"
                    value={`${stats.monthlyBoostRevenue} €`}
                    sub="Campagnes publicitaires"
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
                    { href: '/admin/commissions', label: 'Voir les commissions', icon: '💰' },
                    { href: '/admin/boosts', label: 'Gérer les boosts', icon: '⚡' },
                    { href: '/admin/users', label: 'Utilisateurs', icon: '👥' },
                    { href: '/admin/posts', label: 'Modération posts', icon: '🎬' },
                    { href: '/admin/top-creators', label: 'Top créateurs', icon: '🏆' },
                  ].map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-4 bg-surface-card rounded-2xl border border-white/5 hover:border-brand/30 hover:bg-brand/5 transition-all"
                    >
                      <span className="text-2xl">{action.icon}</span>
                      <span className="text-sm font-medium">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="text-red-400">Erreur de chargement. Accès admin requis.</div>
          )}
        </main>
      </div>
    </>
  );
}
