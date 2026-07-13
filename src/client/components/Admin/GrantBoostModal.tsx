import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/http';

type BoostObjectiveKey = 'views' | 'sales' | 'followers';

const BOOST_DURATIONS = [1, 3, 7, 30] as const;
const BOOST_OBJECTIVES: { key: BoostObjectiveKey; label: string }[] = [
  { key: 'views', label: 'Vues' },
  { key: 'sales', label: 'Ventes' },
  { key: 'followers', label: 'Abonnés' },
];

interface TargetUser {
  id: string;
  username: string;
  displayName?: string;
}

export function GrantBoostModal({
  target,
  onClose,
  onGranted,
}: {
  target?: TargetUser | null;
  onClose: () => void;
  onGranted: (info: { username: string; durationDays: number }) => void;
}) {
  const [selected, setSelected] = useState<TargetUser | null>(target ?? null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TargetUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [duration, setDuration] = useState(7);
  const [objective, setObjective] = useState<BoostObjectiveKey>('views');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selected || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const debounce = setTimeout(() => {
      api
        .get<{ users: TargetUser[] }>(`/admin/users?search=${encodeURIComponent(query.trim())}&limit=8`)
        .then((data) => setResults(data.users))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/users/${selected.id}/boost`, { durationDays: duration, objective });
      onGranted({ username: selected.username, durationDays: duration });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'octroi du boost.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-surface-card border border-white/10 rounded-2xl p-5">
        <h2 className="text-white font-bold text-base mb-1">Offrir un boost</h2>

        {!selected ? (
          <>
            <p className="text-xs text-gray-400 mb-3">Cherche un utilisateur à qui offrir un boost.</p>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="@pseudo, email..."
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand/50"
              />
            </div>
            {searching ? (
              <p className="text-xs text-gray-500">Recherche...</p>
            ) : results.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelected(u)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-white hover:bg-white/5 transition-colors"
                  >
                    <span className="font-semibold">{u.displayName || u.username}</span>
                    <span className="text-gray-500 text-xs">@{u.username}</span>
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <p className="text-xs text-gray-500">Aucun résultat.</p>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs text-gray-400">
              à <span className="text-white font-semibold">@{selected.username}</span> — appliqué immédiatement, sans passer par un paiement.
              {!target && (
                <button type="button" onClick={() => setSelected(null)} className="ml-2 text-brand hover:underline">
                  changer
                </button>
              )}
            </p>

            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5 uppercase tracking-wide">Objectif</label>
              <div className="flex gap-2">
                {BOOST_OBJECTIVES.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setObjective(o.key)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      objective === o.key
                        ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]'
                        : 'border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5 uppercase tracking-wide">Durée</label>
              <div className="flex gap-2">
                {BOOST_DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      duration === d
                        ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]'
                        : 'border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {d}j
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d98a08] text-black font-semibold text-sm transition-colors disabled:opacity-60"
              >
                Offrir
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
