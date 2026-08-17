import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Gift } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import { Leaderboard, type RankedUser } from '../../client/components/Admin/Leaderboard';
import { api } from '../../shared/api/http';

interface TopDonor extends RankedUser {
  totalSent: number;
  giftCount: number;
}

export default function AdminTopDonors() {
  const [donors, setDonors] = useState<TopDonor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TopDonor[]>('/admin/top-donors?limit=20')
      .then(setDonors)
      .catch(() => setDonors([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head><title>Top donateurs — Admin skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide pb-16 md:pb-0">
        <header className="border-b border-white/5 px-6 py-4">
          <h1 className="text-lg font-bold">Top donateurs de cadeaux</h1>
        </header>

        <div className="p-6 max-w-3xl mx-auto">
          <Leaderboard
            icon={Gift}
            subtitle="Montant total de cadeaux envoyés en Live"
            items={donors}
            loading={loading}
            emptyLabel="Aucun cadeau envoyé pour le moment."
            renderValue={(d) => (
              <div className="text-right">
                <p className="text-sm font-bold text-[#f59e0b]">{Number(d.totalSent).toFixed(2)} €</p>
                <p className="text-[11px] text-gray-500">{d.giftCount} cadeau{d.giftCount > 1 ? 'x' : ''}</p>
              </div>
            )}
          />
        </div>
        </main>
      </div>
    </>
  );
}
