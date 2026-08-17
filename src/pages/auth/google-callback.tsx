import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { setSession } from '../../shared/api/http';
import { useLanguage } from '../../client/i18n/LanguageContext';
import { InterestsGate } from '../../client/components/Onboarding/InterestsGate';

// Point d'arrivee apres le redirect Google -> backend -> ici. Le backend encode {user, token}
// en base64url dans `data` (meme forme que la reponse JSON de /auth/login) plutot que de nous
// laisser refaire un appel API — plus simple, pas de sequencement token-puis-fetch a gerer.
export default function GoogleCallbackPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.googleError) {
      router.replace('/auth/login?googleError=1');
      return;
    }

    const raw = router.query.data;
    if (typeof raw !== 'string') {
      router.replace('/auth/login?googleError=1');
      return;
    }

    try {
      const { user, token } = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
      setSession(token, user);
      // Meme regle que l'inscription classique (voir auth/login.tsx) — un compte tout juste
      // cree (via Google ici) passe par le choix des centres d'interet avant le Studio.
      if (!user.hasOnboarded && user.role !== 'admin') {
        setShowOnboarding(true);
      } else {
        router.replace(user.role === 'admin' ? '/admin' : '/');
      }
    } catch {
      router.replace('/auth/login?googleError=1');
    }
  }, [router.isReady, router.query.data, router.query.googleError]);

  if (showOnboarding) {
    return <InterestsGate onDone={() => router.push('/studio')} />;
  }

  return (
    <>
      <Head><title>skoleomLive</title></Head>
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[#a8ff35] rounded-full animate-spin" />
          <p className="text-white/40 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    </>
  );
}
