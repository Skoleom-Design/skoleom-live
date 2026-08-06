import { useEffect, useState } from 'react';
import { QrCode, Sparkles } from 'lucide-react';
import { getToken } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';

const DISMISS_KEY = 'skoleom:app-gate-dismissed';

export function AppGateScreen() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Les utilisateurs déjà connectés (retour sur l'app) passent directement au feed —
    // cet écran ne sert qu'à accueillir les nouveaux visiteurs, une seule fois.
    if (getToken() || localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] cosmic-bg flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#a8ff35]/10 border border-[#a8ff35]/20 flex items-center justify-center mx-auto mb-6">
          <img src="/skoleom-mark.png" alt="" className="w-9 h-9 object-contain" />
        </div>

        <h1 className="display-text text-gradient text-4xl mb-3">{t('appGate.title')}</h1>
        <p className="text-white/50 text-sm px-2 mb-8">{t('appGate.subtitle')}</p>

        <div className="relative inline-block mb-6">
          <div className="w-40 h-40 rounded-3xl bg-white flex items-center justify-center shadow-glow-lime">
            <QrCode size={104} strokeWidth={1.2} className="text-black/85" />
          </div>
          <div className="absolute -top-2.5 -right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#a8ff35] text-black text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
            <Sparkles size={11} />
            {t('appGate.comingSoon')}
          </div>
        </div>

        <p className="text-white/35 text-xs mb-8">{t('appGate.scanHint')}</p>

        <button
          type="button"
          onClick={dismiss}
          className="btn-skoleom-outline w-full py-3.5 rounded-full text-sm active:scale-[0.98]"
        >
          {t('appGate.continueOnWeb')}
        </button>
      </div>
    </div>
  );
}
