import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { Order } from '../../shared/types/api';

export default function AdminCommissions() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/admin/commissions?page=${page}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders);
        setTotal(data.total);
      });
  }, [page]);

  return (
    <>
      <Head><title>Commissions — Admin skoleomLive</title></Head>

      <div className="min-h-screen bg-surface text-white">
        <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">←</Link>
          <h1 className="text-lg font-bold">Commissions ({total})</h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/5">
                  <th className="pb-3 pr-4">Commande</th>
                  <th className="pb-3 pr-4">Capsule</th>
                  <th className="pb-3 pr-4">Montant</th>
                  <th className="pb-3 pr-4">Commission</th>
                  <th className="pb-3 pr-4">Créateur</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 pr-4">{order.capsule?.name || '—'}</td>
                    <td className="py-3 pr-4 font-semibold text-white">
                      {Number(order.amount).toFixed(2)} €
                    </td>
                    <td className="py-3 pr-4 text-brand font-semibold">
                      {Number(order.commissionAmount).toFixed(2)} €
                    </td>
                    <td className="py-3 pr-4 text-green-400">
                      +{Number(order.creatorAmount).toFixed(2)} €
                    </td>
                    <td className="py-3 text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
              disabled={orders.length < 20}
              className="px-4 py-2 rounded-xl bg-surface-card border border-white/10 text-sm disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
