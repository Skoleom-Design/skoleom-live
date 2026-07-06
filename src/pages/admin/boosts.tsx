import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { Boost } from '../../shared/types/api';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-yellow-400' },
  active: { label: 'Actif', color: 'text-green-400' },
  completed: { label: 'Terminé', color: 'text-gray-400' },
  cancelled: { label: 'Annulé', color: 'text-red-400' },
};

export default function AdminBoosts() {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const query = filter ? `?status=${filter}` : '';
    fetch(`/api/admin/boosts${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setBoosts(data.boosts);
        setTotal(data.total);
      });
  }, [filter]);

  return (
    <>
      <Head><title>Boosts — Admin skoleomLive</title></Head>

      <div className="min-h-screen bg-surface text-white">
        <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">←</Link>
          <h1 className="text-lg font-bold">Campagnes Boost ({total})</h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto">
          <div className="flex gap-2 mb-6">
            {['', 'pending', 'active', 'completed'].map((s) => (
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

          <div className="space-y-3">
            {boosts.map((boost) => {
              const s = STATUS_LABELS[boost.status] || { label: boost.status, color: 'text-white' };
              return (
                <div
                  key={boost.id}
                  className="flex items-center justify-between p-4 bg-surface-card rounded-2xl border border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {boost.post?.caption?.slice(0, 40) || 'Post sans caption'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Objectif: {boost.objective} · {boost.durationDays}j
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-sm font-bold text-brand">{Number(boost.budget).toFixed(2)} €</p>
                      <p className="text-xs text-gray-400">{boost.impressions} impressions</p>
                    </div>
                    <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}
