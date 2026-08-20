import { useState } from 'react';
import { api } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';
import { INTEREST_TOPICS, MIN_INTERESTS_REQUIRED } from '../../constants/interests';

interface InterestsGateProps {
  onDone: () => void;
}

export function InterestsGate({ onDone }: InterestsGateProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  async function submit(interests: string[]) {
    setSaving(true);
    try {
      await api.patch('/users/me/interests', { interests });
    } catch {
      // Onboarding cosmétique — un échec réseau ne doit jamais bloquer l'entrée dans l'app.
    } finally {
      onDone();
    }
  }

  const canContinue = selected.size >= MIN_INTERESTS_REQUIRED;

  return (
    <div className="cosmic-bg min-h-screen flex flex-col items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-fit flex flex-col items-center gap-2 rounded-2xl bg-[#a8ff35]/10 border border-[#a8ff35]/20 px-6 py-4 mx-auto mb-4">
            <img src="/skoleom-mark.png" alt="" className="w-8 h-8 object-contain" />
            <p className="text-lg leading-none">
              <span className="font-semibold text-white">skoleom</span>
              <span className="font-extrabold text-[#a8ff35]">Live</span>
            </p>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('onboarding.title')}</h1>
          <p className="text-white/45 text-sm px-2">
            {t('onboarding.subtitle', { min: MIN_INTERESTS_REQUIRED })}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {INTEREST_TOPICS.map(({ slug, emoji, image3d }) => {
            const active = selected.has(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggle(slug)}
                className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border text-sm font-medium transition-all active:scale-[0.96] ${
                  active
                    ? 'bg-[#a8ff35]/12 border-[#a8ff35]/50 text-white shadow-glow-lime-sm'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.07]'
                }`}
              >
                <img src={image3d} alt={emoji} className="w-9 h-9 object-contain drop-shadow-lg" loading="lazy" />
                <span>{t(`onboarding.interests.${slug}`)}</span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-white/30 mb-4">
          {t('onboarding.selectedCount', { count: selected.size })}
        </p>

        <button
          type="button"
          disabled={!canContinue || saving}
          onClick={() => submit(Array.from(selected))}
          className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-40 gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            t('onboarding.continueButton')
          )}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => submit([])}
          className="w-full text-center text-xs text-white/35 hover:text-white/55 mt-4 py-1 transition-colors disabled:opacity-40"
        >
          {t('onboarding.skipButton')}
        </button>
      </div>
    </div>
  );
}
