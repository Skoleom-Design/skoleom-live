import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { QrCode, Sparkles, LogIn } from 'lucide-react';
import { getToken } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';

const DISMISS_KEY = 'skoleom:app-gate-dismissed';

export function AppGateScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Les utilisateurs déjà connectés (retour sur l'app) passent directement au feed —
    // cet écran ne sert qu'à accueillir les nouveaux visiteurs, une seule fois.
    if (getToken() || localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  function continueAsGuest() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] cosmic-bg flex flex-col items-center justify-center px-6 py-10 overflow-y-auto animate-fade-in">
      {/* Orbes d'ambiance — meme traitement que le reste de l'app */}
      <div className="cosmic-orb w-64 h-64 bg-[#a8ff35]/[0.08] -top-16 -left-16 animate-float" style={{ animationDelay: '0s' }} />
      <div className="cosmic-orb w-56 h-56 bg-[#00ffff]/[0.06] bottom-0 right-0 animate-float" style={{ animationDelay: '-4s' }} />

      <div className="relative w-full max-w-sm text-center my-auto">
        <div className="relative w-fit flex flex-col items-center gap-2.5 rounded-[28px] bg-[#a8ff35]/10 border border-[#a8ff35]/20 px-9 py-6 mx-auto mb-5">
          <div className="absolute inset-0 rounded-[28px] bg-skoleom-gradient-warm opacity-20 blur-xl animate-pulse-glow" />
          <img src="/skoleom-mark.png" alt="" className="relative w-16 h-16 object-contain" />
          <p className="relative text-[26px] leading-none">
            <span className="font-semibold text-white">skoleom</span>
            <span className="font-extrabold text-[#a8ff35]">Live</span>
          </p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-8">{t('appGate.tagline')}</p>
        <p className="text-white/50 text-sm px-2 mb-10 leading-relaxed">{t('appGate.welcomeSubtitle')}</p>

        <div className="space-y-2.5 mb-10">
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] gap-2"
          >
            <LogIn size={16} /> {t('appGate.login')}
          </button>
          <button
            type="button"
            onClick={continueAsGuest}
            className="btn-skoleom-outline w-full py-3.5 rounded-full text-sm active:scale-[0.98]"
          >
            {t('appGate.continueAsGuest')}
          </button>
        </div>

        {/* App mobile — teaser secondaire, pas l'action principale de cet ecran */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
          <div className="relative w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0">
            <QrCode size={30} strokeWidth={1.3} className="text-black/85" />
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#a8ff35] flex items-center justify-center">
              <Sparkles size={9} className="text-black" />
            </div>
          </div>
          <p className="text-left text-white/40 text-[11.5px] leading-snug">
            {t('appGate.title')}
            <span className="block text-white/25">{t('appGate.scanHint')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
