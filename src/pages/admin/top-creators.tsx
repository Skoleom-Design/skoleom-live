import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Film, Radio, Layers, Video } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import { Leaderboard, type RankedUser } from '../../client/components/Admin/Leaderboard';
import { api } from '../../shared/api/http';

interface RankedCreator extends RankedUser {
  revenue: number;
}

interface TopPoster extends RankedUser {
  postCount: number;
}

interface TopLiver extends RankedUser {
  liveCount: number;
}

type Tab = 'feed' | 'live' | 'posters' | 'livers';

const TABS: { key: Tab; label: string; icon: typeof Film }[] = [
  { key: 'feed', label: 'Revenus — Feed', icon: Film },
  { key: 'live', label: 'Revenus — Live', icon: Radio },
  { key: 'posters', label: 'Top posters', icon: Layers },
  { key: 'livers', label: 'Top livers', icon: Video },
];

export default function AdminTopCreators() {
  const [tab, setTab] = useState<Tab>('feed');
  const [feed, setFeed] = useState<RankedCreator[]>([]);
  const [live, setLive] = useState<RankedCreator[]>([]);
  const [posters, setPosters] = useState<TopPoster[]>([]);
  const [livers, setLivers] = useState<TopLiver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ feed: RankedCreator[]; live: RankedCreator[] }>('/admin/top-creators-by-channel?limit=20').catch(() => ({ feed: [], live: [] })),
      api.get<TopPoster[]>('/admin/top-posters?limit=20').catch(() => []),
      api.get<TopLiver[]>('/admin/top-livers?limit=20').catch(() => []),
    ]).then(([byChannel, topPosters, topLivers]) => {
      setFeed(byChannel.feed);
      setLive(byChannel.live);
      setPosters(topPosters);
      setLivers(topLivers);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Head><title>Top créateurs — Admin skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
        <header className="border-b border-white/5 px-6 py-4">
          <h1 className="text-lg font-bold">Top créateurs</h1>
        </header>

        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    active
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 max-w-3xl">
          {tab === 'feed' && (
            <Leaderboard
              icon={Film}
              subtitle="Revenus cumulés (ventes de capsules) sur le feed"
              items={feed}
              loading={loading}
              emptyLabel="Aucune vente depuis le feed pour le moment."
              renderValue={(c) => (
                <p className="text-sm font-bold text-brand">{Number(c.revenue).toFixed(2)} €</p>
              )}
            />
          )}

          {tab === 'live' && (
            <Leaderboard
              icon={Radio}
              subtitle="Revenus cumulés (ventes de capsules) en Live uniquement"
              items={live}
              loading={loading}
              emptyLabel="Aucune vente en Live pour le moment."
              renderValue={(c) => (
                <p className="text-sm font-bold text-red-400">{Number(c.revenue).toFixed(2)} €</p>
              )}
            />
          )}

          {tab === 'posters' && (
            <Leaderboard
              icon={Layers}
              subtitle="Nombre de posts publiés sur le feed"
              items={posters}
              loading={loading}
              emptyLabel="Aucun post pour le moment."
              renderValue={(p) => (
                <p className="text-sm font-bold text-white">{p.postCount} post{p.postCount > 1 ? 's' : ''}</p>
              )}
            />
          )}

          {tab === 'livers' && (
            <Leaderboard
              icon={Video}
              subtitle="Nombre de sessions live lancées"
              items={livers}
              loading={loading}
              emptyLabel="Aucun live lancé pour le moment."
              renderValue={(l) => (
                <p className="text-sm font-bold text-red-400">{l.liveCount} live{l.liveCount > 1 ? 's' : ''}</p>
              )}
            />
          )}
        </div>
        </main>
      </div>
    </>
  );
}
