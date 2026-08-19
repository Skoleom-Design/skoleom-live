import { useState } from 'react';
import { AvatarGrid } from './AvatarGrid';
import { PRESET_AVATARS_3D } from '../../constants/avatars';
import { useLanguage } from '../../i18n/LanguageContext';

interface AvatarCategoryPickerProps {
  cosmicOptions: string[];
  value: string;
  onChange: (url: string) => void;
}

// Deux categories de gamerpics — "Cosmique" (illustrations SVG maison) et "3D" (style verre/
// glossy, voir PRESET_AVATARS_3D) — partagees entre l'onboarding (classique/Google) et l'edition
// de profil. Le choix de categorie initial suit la valeur courante si elle appartient a la 3D.
export function AvatarCategoryPicker({ cosmicOptions, value, onChange }: AvatarCategoryPickerProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<'cosmic' | 'glass'>(
    PRESET_AVATARS_3D.includes(value) ? 'glass' : 'cosmic',
  );

  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {(['cosmic', 'glass'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`flex-1 py-2 rounded-full text-[12.5px] font-semibold border transition-all ${
              category === c
                ? 'bg-[#a8ff35] text-black border-[#a8ff35]'
                : 'bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25'
            }`}
          >
            {c === 'cosmic' ? t('onboarding.categoryCosmic') : t('onboarding.categoryGlass')}
          </button>
        ))}
      </div>
      <AvatarGrid options={category === 'cosmic' ? cosmicOptions : PRESET_AVATARS_3D} value={value} onChange={onChange} />
    </div>
  );
}
