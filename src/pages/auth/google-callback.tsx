import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { setSession, getStoredUser, getToken, type SessionUser } from '../../shared/api/http';
import { useLanguage } from '../../client/i18n/LanguageContext';
import { InterestsGate } from '../../client/components/Onboarding/InterestsGate';
import { GoogleProfileSetup } from '../../client/components/Onboarding/GoogleProfileSetup';

type Step = 'loading' | 'profile' | 'interests';

// Point d'arrivee apres le redirect Google -> backend -> ici. Le backend encode {user, token}
// en base64url dans `data` (meme forme que la reponse JSON de /auth/login) plutot que de nous
// laisser refaire un appel API — plus simple, pas de sequencement token-puis-fetch a gerer.
export default function GoogleCallbackPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('loading');

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
      // cree (via Google ici) passe par la personnalisation du profil puis les centres d'interet
      // avant le Studio. Le pseudo genere automatiquement (voir auth.service.ts) n'a jamais ete
      // choisi a la main comme dans l'inscription classique, d'ou l'etape "profile" en plus ici.
      if (!user.hasOnboarded && user.role !== 'admin') {
        setStep('profile');
      } else {
        router.replace(user.role === 'admin' ? '/admin' : '/');
      }
    } catch {
      router.replace('/auth/login?googleError=1');
    }
  }, [router.isReady, router.query.data, router.query.googleError]);

  if (step === 'profile') {
    const user = getStoredUser() as SessionUser;
    return (
      <GoogleProfileSetup
        initialUsername={user.username}
        googleAvatarUrl={user.avatarUrl}
        onDone={({ username, avatarUrl }) => {
          setSession(getToken() || '', { ...user, username, avatarUrl });
          setStep('interests');
        }}
      />
    );
  }

  if (step === 'interests') {
    return <InterestsGate onDone={() => router.push('/studio')} />;
  }

  return (
    <>
      <Head><title>skoleomLive</title></Head>
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[#ffc94d] rounded-full animate-spin" />
          <p className="text-white/40 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    </>
  );
}
