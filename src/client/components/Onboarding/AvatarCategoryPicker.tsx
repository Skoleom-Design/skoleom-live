import { useEffect, useRef, useState } from 'react';
import { Palette, ChevronLeft, ChevronRight } from 'lucide-react';
import { AvatarGrid } from './AvatarGrid';
import { AvatarDrawModal } from './AvatarDrawModal';
import {
  PRESET_AVATARS_ROBOTS, PRESET_AVATARS_PORTRAITS, PRESET_AVATARS_ORBITS, PRESET_AVATARS_PERSONAS,
} from '../../constants/avatars';
import { useLanguage } from '../../i18n/LanguageContext';

interface AvatarCategoryPickerProps {
  // Avatars a proposer en plus des galeries fixes (ex: la vraie photo Google au premier login) —
  // fusionnes en tete de l'onglet "Personnages" plutot que d'avoir leur propre onglet.
  extraOptions?: string[];
  value: string;
  onChange: (url: string) => void;
}

// Categories de gamerpics — quatre categories illustrees (voir PRESET_AVATARS_*, generees via
// DiceBear puis sauvegardees en statique) et "Dessiner" (atelier de dessin libre, voir
// AvatarDrawModal), toutes dans un seul rang d'onglets horizontalement scrollable. Partage entre
// l'onboarding et l'edition de profil. L'ancienne categorie "Cosmique" (illustrations maison
// rocket/planet/etc.) a ete retiree — jugee peu qualitative — et "Personnages" est desormais la
// categorie par defaut.
export function AvatarCategoryPicker({ extraOptions = [], value, onChange }: AvatarCategoryPickerProps) {
  const { t } = useLanguage();
  const [drawOpen, setDrawOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const galleries = [
    { key: 'personas', label: t('onboarding.categoryPersonas'), options: [...extraOptions, ...PRESET_AVATARS_PERSONAS] },
    { key: 'portraits', label: t('onboarding.categoryPortraits'), options: PRESET_AVATARS_PORTRAITS },
    { key: 'robots', label: t('onboarding.categoryRobots'), options: PRESET_AVATARS_ROBOTS },
    { key: 'orbits', label: t('onboarding.categoryOrbits'), options: PRESET_AVATARS_ORBITS },
  ];
  // Ordre d'affichage voulu : Personnages, Portraits, Robots, Dessiner (bouton special, pas une
  // galerie), Orbites.
  const tabs: Array<{ isDraw: true } | { isDraw: false; key: string; label: string }> = [
    ...galleries.slice(0, 3).map((g) => ({ isDraw: false as const, key: g.key, label: g.label })),
    { isDraw: true },
    ...galleries.slice(3).map((g) => ({ isDraw: false as const, key: g.key, label: g.label })),
  ];

  const initialCategory = galleries.find((c) => c.options.includes(value))?.key ?? 'personas';
  const [category, setCategory] = useState(initialCategory);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, []);

  function scrollByStep(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="relative mb-3 flex items-center">
        <button
          type="button"
          onClick={() => scrollByStep(-1)}
          className={`shrink-0 w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mr-1 transition-opacity ${
            canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft size={13} className="text-white/70" />
        </button>

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
        >
          {tabs.map((tabItem) =>
            tabItem.isDraw ? (
              <button
                key="draw"
                type="button"
                onClick={() => setDrawOpen(true)}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold border bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25 hover:text-white transition-all"
              >
                <Palette size={13} /> {t('onboarding.categoryDraw')}
              </button>
            ) : (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => setCategory(tabItem.key)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all ${
                  category === tabItem.key
                    ? 'bg-[#ffc94d] text-black border-[#ffc94d]'
                    : 'bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25'
                }`}
              >
                {tabItem.label}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => scrollByStep(1)}
          className={`shrink-0 w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center ml-1 transition-opacity ${
            canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight size={13} className="text-white/70" />
        </button>
      </div>

      <AvatarGrid
        options={galleries.find((c) => c.key === category)!.options}
        value={value}
        onChange={onChange}
      />

      <AvatarDrawModal open={drawOpen} onClose={() => setDrawOpen(false)} onSave={onChange} />
    </div>
  );
}
