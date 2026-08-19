import { useEffect, useState } from 'react';
import { X, Calendar, Wallet, TrendingUp, Zap, History, CreditCard, Gift as GiftIcon, MessageCircle } from 'lucide-react';
import { api } from '../../../shared/api/http';

interface DetailUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  email: string;
  role: string;
  plan: string;
  isActive: boolean;
  walletBalance: number;
  totalEarnings: number;
  createdAt: string;
}

interface DetailBoost {
  id: string;
  status: string;
  objective: string;
  budget: number;
  durationDays: number;
  createdAt: string;
}

interface DetailLog {
  id: string;
  action: 'plan_change' | 'status_change' | 'credit' | 'boost_grant';
  admin: { username: string };
  details: Record<string, unknown>;
  createdAt: string;
}

interface DetailGiftSent {
  id: string;
  giftType: string;
  amount: number;
  receiver: { username: string; displayName?: string };
  createdAt: string;
}

interface DetailMessageSent {
  id: string;
  text: string;
  createdAt: string;
  recipient: { id: string; username: string; displayName?: string };
}

interface UserDetail {
  user: DetailUser;
  boosts: DetailBoost[];
  logs: DetailLog[];
  giftsSent: DetailGiftSent[];
  messagesSent: DetailMessageSent[];
}

function fmt(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function logLabel(log: DetailLog): string {
  const by = `par ${log.admin?.username ?? '?'}`;
  if (log.action === 'plan_change') {
    return `Plan changé de ${log.details.from} vers ${log.details.to} — ${by}`;
  }
  if (log.action === 'status_change') {
    return `${log.details.to ? 'Compte réactivé' : 'Compte suspendu'} — ${by}`;
  }
  if (log.action === 'credit') {
    return `Wallet crédité de ${Number(log.details.amount).toFixed(2)} € — ${by}`;
  }
  if (log.action === 'boost_grant') {
    return `Boost offert (${log.details.objective}, ${log.details.durationDays}j) — ${by}`;
  }
  return log.action;
}

export function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserDetail>(`/admin/users/${userId}/detail`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-hide bg-surface-card border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-base">Détail utilisateur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-gray-500 text-sm">Chargement...</div>
        ) : !detail ? (
          <div className="text-red-400 text-sm">Impossible de charger ce profil.</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              {detail.user.avatarUrl ? (
                <img src={detail.user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center font-bold text-black text-lg">
                  {detail.user.username[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-white font-semibold">{detail.user.displayName || detail.user.username}</p>
                <p className="text-xs text-gray-400">@{detail.user.username} · {detail.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar size={13} />
              Membre depuis {fmt(detail.user.createdAt)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wide mb-1">
                  <Wallet size={12} /> Wallet
                </div>
                <p className="text-white font-bold">{Number(detail.user.walletBalance).toFixed(2)} €</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wide mb-1">
                  <TrendingUp size={12} /> Revenus
                </div>
                <p className="text-brand font-bold">{Number(detail.user.totalEarnings).toFixed(2)} €</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <Zap size={13} /> Boosts pris ({detail.boosts.length})
              </div>
              {detail.boosts.length === 0 ? (
                <p className="text-gray-500 text-xs">Aucun boost pour le moment.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.boosts.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 border border-white/5 text-xs">
                      <span className="text-gray-300">{fmt(b.createdAt)} · {b.objective} · {b.durationDays}j</span>
                      <span className="text-brand font-semibold">{Number(b.budget).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <CreditCard size={13} /> Abonnement — actuellement <span className="text-white normal-case font-bold">{detail.user.plan}</span>
              </div>
              {(() => {
                const planLogs = detail.logs.filter((l) => l.action === 'plan_change');
                return planLogs.length === 0 ? (
                  <p className="text-gray-500 text-xs">Aucun changement de plan enregistré.</p>
                ) : (
                  <div className="space-y-1.5">
                    {planLogs.map((log) => (
                      <div key={log.id} className="bg-black/30 rounded-lg px-3 py-2 border border-white/5 text-xs text-gray-300">
                        <span className="text-gray-500 mr-2">{fmt(log.createdAt)}</span>
                        {String(log.details.from)} → {String(log.details.to)}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <GiftIcon size={13} /> Cadeaux achetés ({detail.giftsSent.length})
              </div>
              {detail.giftsSent.length === 0 ? (
                <p className="text-gray-500 text-xs">Aucun cadeau envoyé pour le moment.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.giftsSent.map((g) => (
                    <div key={g.id} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 border border-white/5 text-xs">
                      <span className="text-gray-300">
                        {fmt(g.createdAt)} · {g.giftType} → @{g.receiver?.username ?? '?'}
                      </span>
                      <span className="text-[#f59e0b] font-semibold">{Number(g.amount).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <MessageCircle size={13} /> Messages envoyés ({detail.messagesSent.length})
              </div>
              {detail.messagesSent.length === 0 ? (
                <p className="text-gray-500 text-xs">Aucun message envoyé pour le moment.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-hide">
                  {detail.messagesSent.map((m) => (
                    <div key={m.id} className="bg-black/30 rounded-lg px-3 py-2 border border-white/5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-400">
                          à <span className="text-white font-medium">@{m.recipient.username}</span>
                        </span>
                        <span className="text-gray-500 shrink-0 ml-2">{fmt(m.createdAt)}</span>
                      </div>
                      <p className="text-gray-300 break-words">{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <History size={13} /> Historique admin ({detail.logs.length})
              </div>
              {detail.logs.length === 0 ? (
                <p className="text-gray-500 text-xs">Aucune action admin sur ce compte.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.logs.map((log) => (
                    <div key={log.id} className="bg-black/30 rounded-lg px-3 py-2 border border-white/5 text-xs text-gray-300">
                      <span className="text-gray-500 mr-2">{fmt(log.createdAt)}</span>
                      {logLabel(log)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
