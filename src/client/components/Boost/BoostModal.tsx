import { useState, useEffect } from 'react';
import { Zap, Eye, Wallet, Users } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/http';

type Scope = 'post' | 'account';

interface Props {
  post?: { id: string; caption?: string };
  open: boolean;
  onClose: () => void;
}

const OBJECTIVES = [
  { key: 'views', label: 'Vues', icon: Eye, desc: 'Maximise les vues sur ton contenu' },
  { key: 'sales', label: 'Ventes', icon: Wallet, desc: 'Optimise pour les achats de capsules' },
  { key: 'followers', label: 'Abonnés', icon: Users, desc: 'Augmente ton audience' },
];

const DURATIONS = [
  { days: 1, label: '1 jour' },
  { days: 3, label: '3 jours' },
  { days: 7, label: '1 semaine' },
  { days: 30, label: '1 mois' },
];

export function BoostModal({ post, open, onClose }: Props) {
  const [scope, setScope] = useState<Scope>(post ? 'post' : 'account');
  const [objective, setObjective] = useState('views');
  const [duration, setDuration] = useState(3);
  const [pricing, setPricing] = useState<Record<Scope, Record<number, number>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope(post ? 'post' : 'account');
    api.get<Record<Scope, Record<number, number>>>('/boosts/pricing')
      .then(setPricing)
      .catch(() => setError('Impossible de charger les tarifs.'));
  }, [open, post]);

  if (!open) return null;

  const price = pricing?.[scope]?.[duration];

  async function handleBoost() {
    setLoading(true);
    setError(null);
    try {
      const boost = await api.post('/boosts', {
        scope,
        postId: scope === 'post' ? post!.id : undefined,
        objective,
        durationDays: duration,
      });
      const { clientSecret } = await api.post('/payments/boost/intent', { boostId: boost.id });
      window.location.href = `/checkout/boost/${boost.id}?client_secret=${clientSecret}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la création du boost');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-surface-card rounded-t-3xl md:rounded-3xl p-6 animate-slide-up">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Zap size={18} className="text-brand" />
          Booster
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          {scope === 'post' ? post?.caption?.slice(0, 60) || 'Ce post' : 'Tous tes posts actifs'}
        </p>

        {post && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Portée</p>
            <div className="flex gap-2">
              {([
                { key: 'post' as Scope, label: 'Ce post' },
                { key: 'account' as Scope, label: 'Tout mon compte' },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={`flex-1 px-4 py-2 rounded-xl text-sm border transition-colors ${
                    scope === s.key
                      ? 'border-brand bg-brand/10 text-brand font-semibold'
                      : 'border-white/10 text-gray-300 hover:border-white/20'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Objectif</p>
          <div className="space-y-2">
            {OBJECTIVES.map((obj) => {
              const active = objective === obj.key;
              return (
                <button
                  key={obj.key}
                  onClick={() => setObjective(obj.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    active ? 'border-brand bg-brand/10' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    active ? 'bg-brand/20' : 'bg-white/[0.06]'
                  }`}>
                    <obj.icon size={17} className={active ? 'text-brand' : 'text-gray-300'} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{obj.label}</p>
                    <p className="text-xs text-gray-400">{obj.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Durée</p>
          <div className="grid grid-cols-2 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.days}
                onClick={() => setDuration(d.days)}
                className={`px-4 py-2.5 rounded-xl text-sm border transition-colors ${
                  duration === d.days
                    ? 'border-brand bg-brand/10 text-brand font-semibold'
                    : 'border-white/10 text-gray-300 hover:border-white/20'
                }`}
              >
                <span className="block">{d.label}</span>
                <span className="block text-xs opacity-70">
                  {pricing?.[scope]?.[d.days] != null ? `${pricing[scope][d.days].toFixed(2)} €` : '…'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleBoost}
          disabled={loading || price == null}
          className="w-full py-3.5 bg-brand hover:bg-brand-dark text-black font-semibold rounded-2xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Traitement...' : price != null ? `Booster pour ${price.toFixed(2)} €` : 'Chargement…'}
        </button>
      </div>
    </div>
  );
}
