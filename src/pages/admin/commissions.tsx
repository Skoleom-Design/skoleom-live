import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Info, Search, X } from 'lucide-react';
import { AdminSidebar } from '../../client/components/Layout/AdminSidebar';
import type { Order } from '../../shared/types/api';
import { api } from '../../shared/api/http';

function fmtDate(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-white text-right">{value}</span>
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const addr = order.shippingAddress;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide bg-surface-card border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-base">Détail de la commande</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Commande</p>
            <DetailRow label="ID" value={<span className="font-mono">{order.id}</span>} />
            <DetailRow label="Statut" value={order.status} />
            <DetailRow label="Date" value={fmtDate(order.createdAt)} />
            <DetailRow label="Variante" value={order.selectedVariant} />
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Acheteur</p>
            <DetailRow label="Nom" value={order.buyer?.displayName || order.buyer?.username} />
            <DetailRow label="Pseudo" value={order.buyer?.username ? `@${order.buyer.username}` : undefined} />
            <DetailRow label="Email" value={order.buyer?.email} />
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Créateur</p>
            <DetailRow label="Nom" value={order.creator?.displayName || order.creator?.username} />
            <DetailRow label="Pseudo" value={order.creator?.username ? `@${order.creator.username}` : undefined} />
            <DetailRow label="Email" value={order.creator?.email} />
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Capsule</p>
            <DetailRow label="Nom" value={order.capsule?.name} />
            <DetailRow label="Description" value={order.capsule?.description} />
          </div>

          {addr && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Livraison</p>
              <DetailRow label="Destinataire" value={addr.fullName} />
              <DetailRow label="Adresse" value={`${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}`} />
              <DetailRow label="Ville" value={`${addr.postalCode} ${addr.city}`} />
              <DetailRow label="Pays" value={addr.country} />
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Montants</p>
            <DetailRow label="Montant total" value={`${Number(order.amount).toFixed(2)} €`} />
            <DetailRow label="Commission plateforme" value={`${Number(order.commissionAmount).toFixed(2)} €`} />
            <DetailRow label="Part créateur" value={`${Number(order.creatorAmount).toFixed(2)} €`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCommissions() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      api
        .get<{ orders: Order[]; total: number }>(`/admin/commissions?${params.toString()}`)
        .then((data) => {
          setOrders(data.orders);
          setTotal(data.total);
        })
        .catch(() => {
          setOrders([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(debounce);
  }, [page, search]);

  return (
    <>
      <Head><title>Commissions — Admin skoleomLive</title></Head>

      <div className="flex h-screen bg-surface text-white overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
        <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Commissions ({total})</h1>
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Commande, capsule, @pseudo, date (AAAA-MM-JJ)..."
              className="w-full bg-surface-card border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand/50"
            />
          </div>
        </header>

        <div className="p-6 max-w-5xl mx-auto">
          {loading ? (
            <div className="text-gray-500">Chargement...</div>
          ) : orders.length === 0 ? (
            <div className="text-gray-500">Aucune commande.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                    <th className="pb-3 pr-4">Commande</th>
                    <th className="pb-3 pr-4">Capsule</th>
                    <th className="pb-3 pr-4">Montant</th>
                    <th className="pb-3 pr-4">Commission</th>
                    <th className="pb-3 pr-4">Créateur</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3"></th>
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
                      <td className="py-3 pr-4 text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => setDetailOrder(order)}
                          title="Voir le détail"
                          className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/15 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Info size={13} />
                        </button>
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
              disabled={orders.length < 20}
              className="px-4 py-2 rounded-xl bg-surface-card border border-white/10 text-sm disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </div>
        </main>
      </div>

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}
    </>
  );
}
