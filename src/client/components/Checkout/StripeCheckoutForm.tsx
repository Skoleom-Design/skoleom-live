import { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

interface Props {
  clientSecret: string;
  submitLabel: string;
  onSuccess: () => void;
}

export function StripeCheckoutForm({ clientSecret, submitLabel, onSuccess }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const card = elements.getElement(CardElement);
    if (!card) return;

    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    if (stripeError) {
      setError(stripeError.message || 'Paiement refusé.');
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else {
      setError("Le paiement n'a pas pu être confirmé.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5">
        <CardElement
          options={{
            style: {
              base: {
                color: '#fff',
                fontSize: '14px',
                '::placeholder': { color: 'rgba(255,255,255,0.3)' },
              },
              invalid: { color: '#f87171' },
            },
          }}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? 'Traitement...' : submitLabel}
      </button>

      <p className="text-xs text-center text-white/30">Paiement sécurisé par Stripe</p>
    </form>
  );
}
