import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Zap, TrendingUp, Wallet } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/http';

type Scope = 'post' | 'account';

interface Props {
  post?: { id: string; caption?: string };
  open: boolean;
  onClose: () => void;
}

interface MyBoost {
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  scope: Scope;
  post?: { id: string };
}

const DURATIONS = [
  { days: 1, label: '1 jour' },
  { days: 3, label: '3 jours' },
  { days: 7, label: '1 semaine' },
  { days: 30, label: '1 mois' },
];

export function BoostModal({ post, open, onClose }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(post ? 'post' : 'account');
  const [duration, setDuration] = useState(3);
  const [pricing, setPricing] = useState<Record<Scope, Record<number, number>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [myBoosts, setMyBoosts] = useState<MyBoost[]>([]);

  useEffect(() => {
    if (!open) return;
    setScope(post ? 'post' : 'account');
    setConfirming(false);
    api.get<Record<Scope, Record<number, number>>>('/boosts/pricing')
      .then(setPricing)
      .catch(() => setError('Impossible de charger les tarifs.'));
    // Solde a jour (pas celui en cache) pour savoir, avant meme de tenter le paiement, si on
    // doit proposer "Confirmer" ou directement "Recharger mon wallet".
    api.get<{ walletBalance: number }>('/auth/me')
      .then((me) => setWalletBalance(Number(me.walletBalance)))
      .catch(() => setWalletBalance(null));
    // Pour bloquer proactivement le bouton si ce post/ce compte a deja un boost en cours,
    // plutot que de laisser l'utilisateur aller jusqu'au paiement pour decouvrir l'erreur
    // (voir la meme regle cote serveur dans BoostsService.create).
    api.get<MyBoost[]>('/boosts/my').then(setMyBoosts).catch(() => setMyBoosts([]));
  }, [open, post]);

  const hasExistingBoost = myBoosts.some((b) =>
    (b.status === 'pending' || b.status === 'active')
    && (scope === 'post' ? b.scope === 'post' && b.post?.id === post?.id : b.scope === 'account'),
  );

  // Un changement de portée/durée invalide la confirmation en cours — on ne veut pas
  // confirmer un montant qui ne correspond plus a ce qui est affiche.
  useEffect(() => {
    setConfirming(false);
  }, [scope, duration]);

  if (!open) return null;

  const price = pricing?.[scope]?.[duration];
  const insufficientBalance = price != null && walletBalance != null && walletBalance < price;

  function goToWallet() {
    onClose();
    router.push('/profile/me?tab=wallet');
  }

  async function handleBoost() {
    setLoading(true);
    setError(null);
    try {
      const boost = await api.post('/boosts', {
        scope,
        postId: scope === 'post' ? post!.id : undefined,
        durationDays: duration,
      });
      // Simule le paiement via le wallet (deja reel) — pas de Stripe, le boost s'active
      // immediatement des que le solde est debite.
      await api.post(`/payments/boost/${boost.id}/wallet-pay`, {});
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.message.includes('Solde insuffisant')) {
        onClose();
        router.push('/profile/me?tab=wallet');
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Erreur lors de la création du boost');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="cosmic-modal w-full max-w-md overflow-hidden rounded-t-3xl md:rounded-3xl p-6 animate-slide-up">
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

        {hasExistingBoost && (
          <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3.5 py-2.5 mb-3">
            {scope === 'post'
              ? 'Ce post a déjà un boost en cours — attends qu\'il se termine avant d\'en relancer un.'
              : 'Ton compte a déjà un boost en cours — attends qu\'il se termine avant d\'en relancer un.'}
          </p>
        )}

        {confirming ? (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ffc94d]/25 to-[#22c55e]/10 border border-[#ffc94d]/30 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <TrendingUp size={26} className="text-[#ffc94d]" />
            </div>
            <p className="text-white font-bold text-[17px] mb-1.5">
              Tu es sur le point de booster tes ventes !
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              <strong className="text-white">{price?.toFixed(2)} €</strong> seront débités de ton wallet pour{' '}
              <strong className="text-white">{DURATIONS.find((d) => d.days === duration)?.label}</strong> de mise en avant
              {scope === 'post' ? ' sur ce post' : ' sur tout ton compte'}.
            </p>

            {insufficientBalance ? (
              <div className="space-y-3">
                <p className="text-xs text-red-400">
                  Solde insuffisant — {walletBalance?.toFixed(2)} € disponible sur ton wallet.
                </p>
                <button
                  onClick={goToWallet}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand hover:bg-brand-dark text-black font-bold rounded-2xl transition-colors"
                >
                  <Wallet size={16} /> Recharger mon wallet
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="w-full py-2.5 text-gray-400 text-sm hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                  className="flex-1 py-3.5 text-gray-400 text-sm font-semibold hover:text-white transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleBoost}
                  disabled={loading}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-[#ffc94d] to-[#ff5470] text-black font-bold rounded-2xl shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.97] transition-all disabled:opacity-50 disabled:shadow-none animate-pulse-glow"
                >
                  {loading ? 'Traitement...' : 'Oui, je fonce ! ⚡'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={price == null || hasExistingBoost}
            className="w-full py-3.5 bg-brand hover:bg-brand-dark text-black font-semibold rounded-2xl transition-colors disabled:opacity-50"
          >
            {price != null ? `Booster pour ${price.toFixed(2)} €` : 'Chargement…'}
          </button>
        )}
      </div>
    </div>
  );
}
