import type { CapsuleCondition, CapsuleCategory } from '../../shared/types/api';

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

export const CAPSULE_CATEGORY_VALUES: CapsuleCategory[] = ['vetement', 'chaussures', 'accessoire', 'objet'];
export const CAPSULE_CONDITION_VALUES: CapsuleCondition[] = [
  'neuf_avec_etiquette',
  'neuf_sans_etiquette',
  'tres_bon_etat',
  'bon_etat',
  'satisfaisant',
];

export function categoryLabel(t: TFunc, value: CapsuleCategory): string {
  return t(`capsuleForm.categories.${value}`);
}

// Sous-types par categorie — "vetement" seul ne dit rien de precis, un T-shirt et un manteau
// n'interessent pas le meme acheteur. Pas de sous-type pour "objet" (catch-all trop varie).
const SUBCATEGORY_VALUES: Partial<Record<CapsuleCategory, string[]>> = {
  vetement: ['tshirt', 'chemise', 'pull', 'veste', 'jean', 'pantalon', 'short', 'robe', 'jupe', 'survetement', 'maillot_de_bain', 'sous_vetement', 'autre'],
  chaussures: ['baskets', 'bottes', 'sandales', 'talons', 'mocassins', 'chaussons', 'autre'],
  accessoire: ['sac', 'bijou', 'montre', 'ceinture', 'lunettes', 'echarpe_bonnet', 'casquette_chapeau', 'autre'],
};

export function getSubcategoryOptions(category: CapsuleCategory | ''): string[] | null {
  if (!category) return null;
  return SUBCATEGORY_VALUES[category] ?? null;
}

export function subcategoryLabel(t: TFunc, category: CapsuleCategory, value: string): string {
  // "objet" n'a pas de sous-types predefinis — la valeur est du texte libre saisi par le
  // vendeur, pas une cle de traduction.
  if (category === 'objet') return value;
  return t(`capsuleForm.subcategories.${category}.${value}`);
}

export function conditionLabel(t: TFunc, value: CapsuleCondition): string {
  return t(`capsuleForm.conditions.${value}`);
}

export function colorLabel(t: TFunc, name: string): string {
  return t(`capsuleForm.colorNames.${name}`);
}

export const CLOTHING_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'];

// Vinted-style logic: only clothing and shoes carry a "size" attribute.
export function getSizeOptions(category: CapsuleCategory | ''): string[] | null {
  if (category === 'vetement') return CLOTHING_SIZES;
  if (category === 'chaussures') return SHOE_SIZES;
  return null;
}

export function getSizeFieldLabel(t: TFunc, category: CapsuleCategory | ''): string {
  return category === 'chaussures' ? t('capsuleForm.shoeSize') : t('capsuleForm.size');
}

export const CAPSULE_COLOR_PALETTE: { name: string; swatch: string }[] = [
  { name: 'Noir', swatch: '#000000' },
  { name: 'Blanc', swatch: '#FFFFFF' },
  { name: 'Gris', swatch: '#9CA3AF' },
  { name: 'Beige', swatch: '#E8DCC8' },
  { name: 'Marron', swatch: '#7B4B2A' },
  { name: 'Rouge', swatch: '#E11D2E' },
  { name: 'Rose', swatch: '#F472B6' },
  { name: 'Orange', swatch: '#F97316' },
  { name: 'Jaune', swatch: '#FACC15' },
  { name: 'Vert', swatch: '#22C55E' },
  { name: 'Bleu', swatch: '#3B82F6' },
  { name: 'Violet', swatch: '#A855F7' },
  { name: 'Doré', swatch: '#D4AF37' },
  { name: 'Argenté', swatch: '#C0C0C0' },
  { name: 'Multicolore', swatch: 'conic-gradient(from 0deg, #E11D2E, #FACC15, #22C55E, #3B82F6, #A855F7, #E11D2E)' },
];

export const CAPSULE_COLOR_SWATCHES: Record<string, string> = Object.fromEntries(
  CAPSULE_COLOR_PALETTE.map((c) => [c.name, c.swatch]),
);
