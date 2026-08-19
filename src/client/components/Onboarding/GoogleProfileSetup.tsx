import { useState } from 'react';
import { api, ApiError } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';
import { PRESET_AVATARS } from '../../constants/avatars';
import { AvatarCategoryPicker } from './AvatarCategoryPicker';

interface GoogleProfileSetupProps {
  initialUsername: string;
  googleAvatarUrl?: string;
  onDone: (updated: { username: string; avatarUrl: string }) => void;
}

// Affiche apres une premiere connexion via Google — le pseudo est genere automatiquement depuis
// l'email (voir auth.service.ts) et jamais choisi a la main comme dans l'inscription classique,
// donc on laisse l'occasion de le changer ici, plus un choix de photo de profil facon "gamerpic".
export function GoogleProfileSetup({ initialUsername, googleAvatarUrl, onDone }: GoogleProfileSetupProps) {
  const { t } = useLanguage();
  const avatarOptions = googleAvatarUrl ? [googleAvatarUrl, ...PRESET_AVATARS] : PRESET_AVATARS;

  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(avatarOptions[0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError(t('onboarding.usernameTooShort'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.patch('/users/me', { username: trimmed, avatarUrl });
      onDone({ username: trimmed, avatarUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cosmic-bg min-h-screen flex flex-col items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#a8ff35]/10 border border-[#a8ff35]/20 flex items-center justify-center mx-auto mb-4">
            <img src="/skoleom-mark.png" alt="" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('onboarding.profileTitle')}</h1>
          <p className="text-white/45 text-sm px-2">{t('onboarding.profileSubtitle')}</p>
        </div>

        <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
          {t('auth.username')}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('auth.usernamePlaceholder')}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all mb-6"
        />

        <p className="text-[11px] text-white/40 mb-2.5 font-medium uppercase tracking-wider">
          {t('onboarding.chooseAvatar')}
        </p>
        <div className="mb-6 max-h-72 overflow-y-auto scrollbar-hide pr-1">
          <AvatarCategoryPicker cosmicOptions={avatarOptions} value={avatarUrl} onChange={setAvatarUrl} />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20 mb-4">
            {error}
          </p>
        )}

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
