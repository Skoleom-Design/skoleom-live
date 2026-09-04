import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Check } from 'lucide-react';
import { StripeCheckoutForm } from '../../client/components/Checkout/StripeCheckoutForm';
import { api, ApiError } from '../../shared/api/http';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PK
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK)
  : null;

export default function CapsuleCheckoutPage() {
  const router = useRouter();
  const { client_secret, orderId } = router.query;
  const [success, setSuccess] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  async function handlePaymentSuccess() {
    try {
      if (typeof orderId === 'string') await api.post(`/payments/order/${orderId}/confirm`, {});
      setSuccess(true);
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : "Le paiement a réussi mais la confirmation a échoué — contacte le support.");
    }
  }

  return (
    <>
      <Head>
        <title>Paiement — skoleomLive</title>
      </Head>

      <div className="min-h-screen bg-[#1c0c21] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <Check size={24} className="text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-white">Paiement confirmé</h1>
              <p className="text-white/45 text-sm">Votre commande a bien été enregistrée.</p>
              <Link
                href="/"
                className="btn-skoleom block w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime transition-all"
              >
                Retour au feed
              </Link>
            </div>
          ) : !stripePromise ? (
            <p className="text-center text-white/45 text-sm">
              Paiement indisponible — configuration Stripe manquante.
            </p>
          ) : typeof client_secret !== 'string' ? (
            <p className="text-center text-white/45 text-sm">Chargement du paiement…</p>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-6 text-center">Finaliser l'achat</h1>
              {confirmError && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20 mb-4">
                  {confirmError}
                </p>
              )}
              <Elements stripe={stripePromise} options={{ clientSecret: client_secret }}>
                <StripeCheckoutForm
                  clientSecret={client_secret}
                  submitLabel="Payer"
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            </>
          )}
        </div>
      </div>
    </>
  );
}
