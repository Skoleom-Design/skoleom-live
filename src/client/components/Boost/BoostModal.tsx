import { useState } from 'react';
import type { Post } from '../../../shared/types/api';

interface Props {
  post: Post;
  open: boolean;
  onClose: () => void;
}

const OBJECTIVES = [
  { key: 'views', label: 'Vues', icon: '👁️', desc: 'Maximise les vues sur ton contenu' },
  { key: 'sales', label: 'Ventes', icon: '💰', desc: 'Optimise pour les achats de capsules' },
  { key: 'followers', label: 'Abonnés', icon: '👥', desc: 'Augmente ton audience' },
];

const BUDGETS = [5, 10, 20, 50, 100];
const DURATIONS = [1, 3, 7, 14];

export function BoostModal({ post, open, onClose }: Props) {
  const [objective, setObjective] = useState('views');
  const [budget, setBudget] = useState(10);
  const [duration, setDuration] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleBoost() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/boosts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: post.id, objective, budget, durationDays: duration }),
      });

      if (!res.ok) throw new Error('Erreur lors de la création du boost');

      const boost = await res.json();

      const payRes = await fetch('/api/payments/boost/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ boostId: boost.id }),
      });

      const { clientSecret } = await payRes.json();
      window.location.href = `/checkout/boost/${boost.id}?client_secret=${clientSecret}`;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-surface-card rounded-t-3xl md:rounded-3xl p-6 animate-slide-up">
        <h2 className="text-lg font-bold mb-1">⚡ Booster ce post</h2>
        <p className="text-sm text-gray-400 mb-5">
          {post.caption?.slice(0, 60) || 'Ton post'}
        </p>

        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Objectif</p>
          <div className="space-y-2">
            {OBJECTIVES.map((obj) => (
              <button
                key={obj.key}
                onClick={() => setObjective(obj.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  objective === obj.key
                    ? 'border-brand bg-brand/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <span className="text-xl">{obj.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{obj.label}</p>
                  <p className="text-xs text-gray-400">{obj.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Budget (€)</p>
          <div className="flex gap-2 flex-wrap">
            {BUDGETS.map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                  budget === b
                    ? 'border-brand bg-brand/10 text-brand font-semibold'
                    : 'border-white/10 text-gray-300 hover:border-white/20'
                }`}
              >
                {b} €
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Durée</p>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                  duration === d
                    ? 'border-brand bg-brand/10 text-brand font-semibold'
                    : 'border-white/10 text-gray-300'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleBoost}
          disabled={loading}
          className="w-full py-3.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-2xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Traitement...' : `Booster pour ${budget} € · ${duration} jour${duration > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
