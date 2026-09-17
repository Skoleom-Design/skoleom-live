import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Check, X, Package, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { CapsuleCondition, CapsuleCategory } from '../../../shared/types/api';
import {
  CAPSULE_CATEGORY_VALUES,
  CAPSULE_CONDITION_VALUES,
  CAPSULE_COLOR_PALETTE,
  categoryLabel,
  conditionLabel,
  colorLabel,
  getSizeOptions,
  getSizeFieldLabel,
  getSubcategoryOptions,
  subcategoryLabel,
} from '../../constants/capsule';
import { useLanguage } from '../../i18n/LanguageContext';
import { uploadFile } from '../../../shared/api/http';
import { CameraCaptureModal } from '../Post/CameraCaptureModal';

export interface CapsuleProductInput {
  name: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  category: CapsuleCategory;
  subcategory?: string;
  size?: string;
  condition: CapsuleCondition;
  colors: string[];
  price: number;
  stock: number;
}

interface Draft {
  name: string;
  brand: string;
  description: string;
  imageUrl: string;
  category: CapsuleCategory | '';
  subcategory: string;
  size: string;
  condition: CapsuleCondition | '';
  colors: string[];
  price: string;
  stock: string;
}

function emptyDraft(): Draft {
  return { name: '', brand: '', description: '', imageUrl: '', category: '', subcategory: '', size: '', condition: '', colors: [], price: '', stock: '' };
}

export interface CapsuleProductFormHandle {
  /** Valide et retourne le produit courant (creation ou edition — un formulaire ne gere plus
   *  qu'un seul produit a la fois, voir le commentaire du composant). Retourne null (avec message
   *  d'erreur affiche dans le formulaire) si un champ requis manque. */
  getProduct: () => CapsuleProductInput | null;
}

function productToDraft(p: CapsuleProductInput): Draft {
  return {
    name: p.name,
    brand: p.brand || '',
    description: p.description || '',
    imageUrl: p.imageUrl || '',
    category: p.category,
    subcategory: p.subcategory || '',
    size: p.size || '',
    condition: p.condition,
    colors: p.colors,
    price: String(p.price),
    stock: String(p.stock),
  };
}

interface CapsuleProductFormProps {
  /** Pre-remplit le formulaire pour l'edition d'un produit existant. Absent = creation. */
  initialProduct?: CapsuleProductInput;
}

const fieldClass = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all';
const chipClass = (active: boolean) =>
  `px-3.5 py-2 rounded-[10px] text-xs font-medium transition-all duration-150 border ${
    active ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
  }`;

// Un produit = un formulaire, un article a vendre (nom, photo, prix, stock...). Il n'y a plus de
// notion de "capsule" (collection nommee regroupant plusieurs produits crees ensemble) — chaque
// produit est cree individuellement et le createur les fait defiler un par un pendant son live
// (voir le picker de produit en vedette sur studio/live.tsx), plutot que de les grouper a la
// creation. Les anciennes capsules-groupes existantes restent affichees telles quelles dans la
// liste (voir profile/me.tsx), ce composant ne sert qu'a creer/editer un produit desormais.
export const CapsuleProductForm = forwardRef<CapsuleProductFormHandle, CapsuleProductFormProps>(function CapsuleProductForm(
  { initialProduct },
  ref,
) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft>(() => (initialProduct ? productToDraft(initialProduct) : emptyDraft()));
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function applyImageFile(file: File) {
    setImageUploading(true);
    setError('');
    try {
      const url = await uploadFile(file, 'capsules');
      setDraft((d) => ({ ...d, imageUrl: url }));
    } catch {
      setError(t('studio.uploadFailed'));
    } finally {
      setImageUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) applyImageFile(f);
  }

  function toggleColor(name: string) {
    setDraft((d) => ({ ...d, colors: d.colors.includes(name) ? d.colors.filter((c) => c !== name) : [...d.colors, name] }));
  }

  function selectCategory(cat: CapsuleCategory) {
    setDraft((d) => ({ ...d, category: cat, subcategory: '', size: '' }));
  }

  function validateDraft(d: Draft): CapsuleProductInput | string {
    const price = parseFloat(d.price);
    const stock = parseInt(d.stock, 10);
    if (!d.name.trim() || !price || !stock) return t('studio.nameeAndPriceRequired');
    if (price < 1) return t('studio.minPriceError');
    if (!d.category) return t('studio.chooseCategory');
    if (d.category === 'objet' && !d.subcategory.trim()) return t('studio.specifyObjectType');
    if (!d.condition) return t('studio.chooseCondition');
    if (getSizeOptions(d.category) && !d.size) {
      return t('studio.chooseSize', { field: getSizeFieldLabel(t, d.category).toLowerCase() });
    }
    return {
      name: d.name.trim(),
      brand: d.brand.trim() || undefined,
      description: d.description.trim() || undefined,
      imageUrl: d.imageUrl || undefined,
      category: d.category,
      subcategory: d.subcategory || undefined,
      size: d.size || undefined,
      condition: d.condition,
      colors: d.colors,
      price,
      stock,
    };
  }

  useImperativeHandle(ref, () => ({
    getProduct() {
      const validated = validateDraft(draft);
      if (typeof validated === 'string') {
        setError(validated);
        return null;
      }
      setError('');
      return validated;
    },
  }));

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder={t('capsuleForm.productName')}
        className={fieldClass}
      />

      <input
        type="text"
        value={draft.brand}
        onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
        placeholder={t('capsuleForm.brand')}
        className={fieldClass}
      />

      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/[0.05] border border-white/[0.08] shrink-0 flex items-center justify-center">
          {imageUploading ? (
            <Loader2 size={18} className="animate-spin text-white/40" />
          ) : draft.imageUrl ? (
            <>
              <img src={draft.imageUrl} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, imageUrl: '' }))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
              >
                <X size={11} className="text-white" />
              </button>
            </>
          ) : (
            <Package size={20} className="text-white/20" />
          )}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 text-[11px] font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
          >
            <Camera size={16} />
            {t('capsuleForm.takePhoto')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 text-[11px] font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
          >
            <ImageIcon size={16} />
            {t('capsuleForm.importPhoto')}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
      </div>
      <CameraCaptureModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={applyImageFile} photoOnly />

      <textarea
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        placeholder={t('capsuleForm.description')}
        rows={3}
        className={`${fieldClass} resize-none`}
      />

      {/* Categorie */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
          {t('capsuleForm.category')}
        </p>
        <div className="flex flex-wrap gap-2">
          {CAPSULE_CATEGORY_VALUES.map((value) => (
            <button key={value} type="button" onClick={() => selectCategory(value)} className={chipClass(draft.category === value)}>
              {categoryLabel(t, value)}
            </button>
          ))}
        </div>
      </div>

      {/* Sous-categorie — precise le type exact (T-shirt, jean...) au lieu de "Vetement" seul */}
      {getSubcategoryOptions(draft.category) && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
            {t('capsuleForm.subcategory')}
          </p>
          <div className="flex flex-wrap gap-2">
            {getSubcategoryOptions(draft.category)!.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, subcategory: sub }))}
                className={chipClass(draft.subcategory === sub)}
              >
                {subcategoryLabel(t, draft.category as CapsuleCategory, sub)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* "Objet / Autre" n'a pas de liste de sous-types predefinie (trop varie) — on demande
          simplement de preciser en texte libre ce qui est vendu. */}
      {draft.category === 'objet' && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
            {t('capsuleForm.subcategory')}
          </p>
          <input
            type="text"
            value={draft.subcategory}
            onChange={(e) => setDraft((d) => ({ ...d, subcategory: e.target.value }))}
            placeholder={t('capsuleForm.specifyObjectPlaceholder')}
            className={fieldClass}
          />
        </div>
      )}

      {/* Taille / Pointure */}
      {getSizeOptions(draft.category) && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
            {getSizeFieldLabel(t, draft.category)}
          </p>
          <div className="flex flex-wrap gap-2">
            {getSizeOptions(draft.category)!.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, size: s }))}
                className={`min-w-[42px] ${chipClass(draft.size === s)}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Etat */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
          {t('capsuleForm.condition')}
        </p>
        <div className="flex flex-wrap gap-2">
          {CAPSULE_CONDITION_VALUES.map((value) => (
            <button key={value} type="button" onClick={() => setDraft((d) => ({ ...d, condition: value }))} className={chipClass(draft.condition === value)}>
              {conditionLabel(t, value)}
            </button>
          ))}
        </div>
      </div>

      {/* Couleurs */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
          {t('capsuleForm.colors')}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {CAPSULE_COLOR_PALETTE.map((c) => {
            const isSelected = draft.colors.includes(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggleColor(c.name)}
                title={colorLabel(t, c.name)}
                className={`relative w-9 h-9 rounded-full transition-all duration-150 ${
                  isSelected ? 'ring-2 ring-[#ffc94d] ring-offset-2 ring-offset-[#1c0c21]' : 'ring-1 ring-white/15 hover:ring-white/35'
                }`}
                style={{ background: c.swatch }}
              >
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check size={14} strokeWidth={3} className={c.name === 'Blanc' || c.name === 'Jaune' ? 'text-black' : 'text-white'} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {draft.colors.length > 0 && (
          <p className="text-xs text-white/35 mt-2">{draft.colors.map((c) => colorLabel(t, c)).join(', ')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          step="0.01"
          min="1"
          value={draft.price}
          onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          placeholder={t('capsuleForm.price')}
          className={fieldClass}
        />
        <input
          type="number"
          value={draft.stock}
          onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
          placeholder={t('capsuleForm.stock')}
          className={fieldClass}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
          {error}
        </p>
      )}
    </div>
  );
});
