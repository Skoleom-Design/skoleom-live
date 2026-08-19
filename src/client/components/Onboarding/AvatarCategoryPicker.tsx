import { useState } from 'react';
import { Palette } from 'lucide-react';
import { AvatarGrid } from './AvatarGrid';
import { AvatarDrawModal } from './AvatarDrawModal';
import {
  PRESET_AVATARS_ROBOTS, PRESET_AVATARS_PORTRAITS, PRESET_AVATARS_ORBITS, PRESET_AVATARS_PERSONAS,
} from '../../constants/avatars';
import { useLanguage } from '../../i18n/LanguageContext';

interface AvatarCategoryPickerProps {
  cosmicOptions: string[];
  value: string;
  onChange: (url: string) => void;
}

// Categories de gamerpics — "Cosmique" (illustrations SVG maison), quatre categories illustrees
// (voir PRESET_AVATARS_*, generees via DiceBear puis sauvegardees en statique) et "Dessiner"
// (atelier de dessin libre, voir AvatarDrawModal). Partage entre l'onboarding et l'edition de
// profil.
export function AvatarCategoryPicker({ cosmicOptions, value, onChange }: AvatarCategoryPickerProps) {
  const { t } = useLanguage();
  const [drawOpen, setDrawOpen] = useState(false);

  const categories = [
    { key: 'cosmic', label: t('onboarding.categoryCosmic'), options: cosmicOptions },
    { key: 'robots', label: t('onboarding.categoryRobots'), options: PRESET_AVATARS_ROBOTS },
    { key: 'portraits', label: t('onboarding.categoryPortraits'), options: PRESET_AVATARS_PORTRAITS },
    { key: 'orbits', label: t('onboarding.categoryOrbits'), options: PRESET_AVATARS_ORBITS },
    { key: 'personas', label: t('onboarding.categoryPersonas'), options: PRESET_AVATARS_PERSONAS },
  ];

  const initialCategory = categories.find((c) => c.options.includes(value))?.key ?? 'cosmic';
  const [category, setCategory] = useState(initialCategory);

  return (
    <div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all ${
              category === c.key
                ? 'bg-[#a8ff35] text-black border-[#a8ff35]'
                : 'bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25'
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDrawOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold border bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25 hover:text-white transition-all"
        >
          <Palette size={13} /> {t('onboarding.categoryDraw')}
        </button>
      </div>

      <AvatarGrid
        options={categories.find((c) => c.key === category)!.options}
        value={value}
        onChange={onChange}
      />

      <AvatarDrawModal open={drawOpen} onClose={() => setDrawOpen(false)} onSave={onChange} />
    </div>
  );
}
