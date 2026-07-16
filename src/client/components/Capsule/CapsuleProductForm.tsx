import { useState, forwardRef, useImperativeHandle } from 'react';
import { Check, X, Package } from 'lucide-react';
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

export interface CapsuleProductInput {
  name: string;
  description?: string;
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
  description: string;
  category: CapsuleCategory | '';
  subcategory: string;
  size: string;
  condition: CapsuleCondition | '';
  colors: string[];
  price: string;
  stock: string;
}

function emptyDraft(): Draft {
  return { name: '', description: '', category: '', subcategory: '', size: '', condition: '', colors: [], price: '', stock: '' };
}

function isDraftEmpty(d: Draft): boolean {
  return !d.name.trim() && !d.description.trim() && !d.category && !d.price && !d.stock;
}

export interface CapsuleProductFormHandle {
  /** Retourne la liste complete (produits deja ajoutes + brouillon courant s'il est valide).
   *  Retourne null si rien n'est pret — un message d'erreur est alors deja affiche dans le formulaire. */
  getProducts: () => CapsuleProductInput[] | null;
}

const fieldClass = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all';
const chipClass = (active: boolean) =>
  `px-3.5 py-2 rounded-[10px] text-xs font-medium transition-all duration-150 border ${
    active ? 'bg-[#a8ff35] text-black border-[#a8ff35]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
  }`;

export const CapsuleProductForm = forwardRef<CapsuleProductFormHandle>(function CapsuleProductForm(_props, ref) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<CapsuleProductInput[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState('');

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
      description: d.description.trim() || undefined,
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
    getProducts() {
      if (isDraftEmpty(draft)) {
        if (products.length === 0) {
          setError(t('studio.fillProductFirst'));
          return null;
        }
        setError('');
        return products;
      }
      const result = validateDraft(draft);
      if (typeof result === 'string') {
        setError(result);
        return null;
      }
      setError('');
      return [...products, result];
    },
  }));

  return (
    <div className="space-y-4">
      {products.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
            {t('studio.productsInCapsule', { count: products.length, plural: products.length > 1 ? 's' : '' })}
          </p>
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl p-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <Package size={15} className="text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{p.name}</p>
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

      <input
        type="text"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder={t('capsuleForm.productName')}
        className={fieldClass}
      />

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
                  isSelected ? 'ring-2 ring-[#a8ff35] ring-offset-2 ring-offset-[#050505]' : 'ring-1 ring-white/15 hover:ring-white/35'
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
        className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-white/60 text-sm font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
      >
        {t('studio.addAnotherProduct')}
      </button>
    </div>
  );
});
