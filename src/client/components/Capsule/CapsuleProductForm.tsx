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
  getCapsuleGroupLimit,
} from '../../constants/capsule';
import { useLanguage } from '../../i18n/LanguageContext';
import { getStoredUser, uploadFile } from '../../../shared/api/http';
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

function isDraftEmpty(d: Draft): boolean {
  return !d.name.trim() && !d.brand.trim() && !d.description.trim() && !d.category && !d.price && !d.stock;
}

export interface CapsuleProductFormHandle {
  /** Retourne le nom de la capsule (obligatoire). Retourne null (avec message d'erreur affiche)
   *  si le champ est vide. */
  getGroupName: () => string | null;
  /** Retourne la liste complete (produits deja ajoutes + brouillon courant s'il est valide).
   *  Retourne null si rien n'est pret — un message d'erreur est alors deja affiche dans le formulaire. */
  getProducts: () => CapsuleProductInput[] | null;
}

const fieldClass = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all';
const chipClass = (active: boolean) =>
  `px-3.5 py-2 rounded-[10px] text-xs font-medium transition-all duration-150 border ${
    active ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
  }`;

export const CapsuleProductForm = forwardRef<CapsuleProductFormHandle>(function CapsuleProductForm(_props, ref) {
  const { t } = useLanguage();
  const [groupName, setGroupName] = useState('');
  const [products, setProducts] = useState<CapsuleProductInput[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const plan = getStoredUser()?.plan;
  const limit = getCapsuleGroupLimit(plan);
  const limitReached = limit !== null && products.length >= limit;

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

  function addProduct() {
    if (limitReached) {
      setError(t('studio.capsuleLimitReached', { limit: limit as number }));
      return;
    }
    const result = validateDraft(draft);
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError('');
    setProducts((prev) => [...prev, result]);
    setDraft(emptyDraft());
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  useImperativeHandle(ref, () => ({
    getGroupName() {
      if (!groupName.trim()) {
        setError(t('studio.capsuleNameRequired'));
        return null;
      }
      setError('');
      return groupName.trim();
    },
    getProducts() {
      let result: CapsuleProductInput[];
      if (isDraftEmpty(draft)) {
        if (products.length === 0) {
          setError(t('studio.fillProductFirst'));
          return null;
        }
        result = products;
      } else {
        const validated = validateDraft(draft);
        if (typeof validated === 'string') {
          setError(validated);
          return null;
        }
        result = [...products, validated];
      }
      if (limit !== null && result.length > limit) {
        setError(t('studio.capsuleLimitReached', { limit }));
        return null;
      }
      setError('');
      return result;
    },
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
          {t('capsuleForm.capsuleName')} <span className="text-[#ffc94d]">*</span>
        </p>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder={t('capsuleForm.capsuleNamePlaceholder')}
          className={fieldClass}
        />
        <p className="text-xs text-white/35 mt-1.5">
          {limit === null
            ? t('studio.capsuleLimitUnlimited')
            : t('studio.capsuleLimitHint', { limit })}
        </p>
      </div>

      {/* Demarcation entre la capsule (conteneur) et ses produits individuels. */}
      <div className="h-px bg-white/10" />

      {products.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
            {t('studio.productsInCapsule', { count: products.length, plural: products.length > 1 ? 's' : '' })}
          </p>
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl p-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={15} className="text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{p.name}{p.brand ? ` · ${p.brand}` : ''}</p>
                <p className="text-xs text-white/40">{p.price.toFixed(2)} € · {p.stock} en stock</p>
              </div>
              <button
                type="button"
                onClick={() => removeProduct(i)}
                title={t('studio.removeProduct')}
                className="w-7 h-7 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/30 hover:text-red-400 transition-all shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Demarcation claire : chaque produit est numerote, comme une fiche d'article separee
          (inspire du flow d'ajout d'articles de Whatnot avant un live). */}
      <div className="flex items-center gap-3 pt-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#ffc94d] whitespace-nowrap">
          {t('capsuleForm.productNumber', { n: products.length + 1 })}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

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

      <button
        type="button"
        onClick={addProduct}
        disabled={limitReached}
        className={`w-full py-2.5 rounded-xl border border-dashed text-sm font-medium transition-all ${
          limitReached
            ? 'border-white/10 text-white/25 cursor-not-allowed'
            : 'border-white/15 text-white/60 hover:bg-white/[0.04] hover:text-white hover:border-white/25'
        }`}
      >
        {limitReached ? t('studio.capsuleLimitReached', { limit: limit as number }) : t('studio.addAnotherProduct')}
      </button>
    </div>
  );
});
