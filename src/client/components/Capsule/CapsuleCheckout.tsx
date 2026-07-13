import { useState } from 'react';
import type { Capsule } from '../../../shared/types/api';
import { api, ApiError, getToken } from '../../../shared/api/http';

interface Props {
  capsule: Capsule;
  onBack: () => void;
}

export function CapsuleCheckout({ capsule, onBack }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      if (!getToken()) {
        window.location.href = '/auth/login';
        return;
      }

      const { clientSecret, orderId } = await api.post('/payments/capsule/intent', {
        capsuleId: capsule.id,
        selectedVariant: selectedVariant || undefined,
      });
      window.location.href = `/checkout/${orderId}?client_secret=${clientSecret}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur de paiement');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
      >
        ← Retour
      </button>

      <div className="flex gap-4 mb-5">
        <div className="w-20 h-20 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
          {capsule.imageUrl ? (
            <img src={capsule.imageUrl} alt={capsule.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
          )}
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{capsule.name}</h3>
          {capsule.description && (
            <p className="text-sm text-gray-400 mt-1">{capsule.description}</p>
          )}
          <p className="text-brand font-bold text-lg mt-2">
            {capsule.price.toFixed(2)} {capsule.currency}
          </p>
        </div>
      </div>

      {capsule.variants && capsule.variants.length > 0 && (
        <div className="mb-5">
          {capsule.variants.map((variant) => (
            <div key={variant.name} className="mb-3">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">{variant.name}</p>
              <div className="flex flex-wrap gap-2">
                {variant.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedVariant(opt)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                      ${selectedVariant === opt
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-white/10 text-gray-300 hover:border-white/30'
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full py-3.5 bg-brand hover:bg-brand-dark text-black font-semibold rounded-2xl transition-colors disabled:opacity-50"
      >
        {loading ? 'Traitement...' : `Acheter · ${capsule.price.toFixed(2)} ${capsule.currency}`}
      </button>

      <p className="text-xs text-center text-gray-500 mt-3">
        Paiement sécurisé par Stripe
      </p>
    </div>
  );
}
