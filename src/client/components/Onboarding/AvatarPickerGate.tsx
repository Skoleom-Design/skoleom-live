import { useState } from 'react';
import { api } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';
import { PRESET_AVATARS } from '../../constants/avatars';
import { AvatarGrid } from './AvatarGrid';

interface AvatarPickerGateProps {
  onDone: (avatarUrl: string) => void;
}

// Affiche apres une inscription classique (email/mot de passe) — le pseudo est deja choisi a
// la main dans le formulaire, il ne reste que la photo de profil facon "gamerpic" a proposer.
export function AvatarPickerGate({ onDone }: AvatarPickerGateProps) {
  const { t } = useLanguage();
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.patch('/users/me', { avatarUrl });
    } catch {
      // Choix cosmetique — un echec reseau ne doit jamais bloquer l'entree dans l'app.
    } finally {
      onDone(avatarUrl);
    }
  }

  return (
    <div className="cosmic-bg min-h-screen flex flex-col items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#a8ff35]/10 border border-[#a8ff35]/20 flex items-center justify-center mx-auto mb-4">
            <img src="/skoleom-mark.png" alt="" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('onboarding.chooseAvatar')}</h1>
          <p className="text-white/45 text-sm px-2">{t('onboarding.avatarSubtitle')}</p>
        </div>

        <div className="mb-6 max-h-64 overflow-y-auto scrollbar-hide pr-1">
          <AvatarGrid options={PRESET_AVATARS} value={avatarUrl} onChange={setAvatarUrl} />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            t('onboarding.continueButton')
          )}
        </button>
      </div>
    </div>
  );
}
