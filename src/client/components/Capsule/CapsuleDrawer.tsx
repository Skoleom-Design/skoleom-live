import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, ShoppingCart, Check,
  Heart, Truck, Package,
} from 'lucide-react';
import type { Capsule } from '../../../shared/types/api';
import { categoryLabel, conditionLabel, colorLabel, CAPSULE_COLOR_SWATCHES } from '../../constants/capsule';
import { useLanguage } from '../../i18n/LanguageContext';
import { api, ApiError, getToken } from '../../../shared/api/http';

interface Props {
  capsules: Capsule[];
  open: boolean;
  onClose: () => void;
}

/* ── Single product view ──────────────────────────────────── */
function ProductView({
  capsule,
  onBack,
  showBack,
  onClose,
}: {
  capsule: Capsule;
  onBack: () => void;
  showBack: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const images = [
    ...(capsule.imageUrl ? [capsule.imageUrl] : []),
    ...(capsule.images || []),
  ];
  const [imgIdx, setImgIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addedToCart, setAddedToCart] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    if (capsule.variants) {
      const init: Record<string, string> = {};
      capsule.variants.forEach((v) => { init[v.name] = ''; });
      setSelectedOptions(init);
    }
    setImgIdx(0);
  }, [capsule]);

  const allSelected = useMemo(() => {
    if (!capsule.variants || capsule.variants.length === 0) return true;
    return Object.values(selectedOptions).every((v) => v !== '');
  }, [capsule, selectedOptions]);

  const isSoldOut = capsule.status === 'sold_out';

  async function handleBuy() {
    if (!allSelected || isAdding || addedToCart || isSoldOut) return;
    if (!getToken()) {
      window.location.href = '/auth/login';
      return;
    }
    setBuyError('');
    setIsAdding(true);
    try {
      await api.post('/payments/capsule/wallet-pay', {
        capsuleId: capsule.id,
        selectedVariant: capsule.variants?.length ? Object.values(selectedOptions).join(' / ') : undefined,
      });
      setAddedToCart(true);
      setTimeout(() => onClose(), 950);
    } catch (e) {
      setBuyError(e instanceof ApiError ? e.message : t('capsuleDrawer.buyFailed'));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── IMAGE GALLERY (left on desktop, top on mobile) ── */}
      <div className="relative lg:w-[45%] shrink-0 bg-[#0a0a0a]">
        {/* Main image */}
        <div className="relative aspect-square lg:aspect-auto lg:h-full overflow-hidden">
          {images.length > 0 ? (
            <img
              src={images[imgIdx]}
              alt={capsule.name}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
              <Package size={48} className="text-white/15" />
            </div>
          )}

          {/* Arrow navigation */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((i) => Math.max(0, i - 1))}
                disabled={imgIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all disabled:opacity-30"
              >
                <ChevronLeft size={18} color="#fff" />
              </button>
              <button
                onClick={() => setImgIdx((i) => Math.min(images.length - 1, i + 1))}
                disabled={imgIdx === images.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all disabled:opacity-30"
              >
                <ChevronRight size={18} color="#fff" />
              </button>
            </>
          )}

          {/* Sold out banner */}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-sm font-semibold bg-red-500/80 px-4 py-1.5 rounded-full">
                {t('capsuleDrawer.soldOut')}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 ${
                  imgIdx === i
                    ? 'border-[#a8ff35] opacity-100'
                    : 'border-white/10 opacity-50 hover:opacity-80'
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── PRODUCT INFO (right on desktop, bottom on mobile) ── */}
      <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide px-5 py-5 gap-4">
        {/* Title */}
        <div>
          {(capsule.group?.name || capsule.brand) && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a8ff35]/80 mb-1">
              {[capsule.group?.name, capsule.brand].filter(Boolean).join(' · ')}
            </p>
          )}
          <h2 className="text-white font-bold text-base leading-snug line-clamp-3">
            {capsule.name}
          </h2>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-[#a8ff35] font-bold text-2xl">
            {capsule.price.toFixed(2)}€
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {capsule.category && (
            <div className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              {categoryLabel(t, capsule.category)}
            </div>
          )}
          {capsule.size && (
            <div className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              {capsule.category === 'chaussures' ? t('capsuleForm.shoeSize') : t('capsuleForm.size')} {capsule.size}
            </div>
          )}
          {capsule.condition && (
            <div className="flex items-center gap-1.5 text-xs text-[#a8ff35] bg-[#a8ff35]/10 border border-[#a8ff35]/20 rounded-full px-3 py-1">
              {conditionLabel(t, capsule.condition)}
            </div>
          )}
          {capsule.stock > 0 && !isSoldOut && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-3 py-1">
              <Truck size={12} />
              {t('capsuleDrawer.freeShipping')}
            </div>
          )}
          {capsule.soldCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-white/50 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              <Heart size={12} />
              {t('capsuleDrawer.boughtCount', { count: capsule.soldCount })}
            </div>
          )}
        </div>

        {/* Couleurs */}
        {capsule.colors && capsule.colors.length > 0 && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2 block">
              {t('capsuleDrawer.colorsLabel')}
            </span>
            <div className="flex flex-wrap gap-2">
              {capsule.colors.map((color) => (
                <div
                  key={color}
                  className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-full pl-1.5 pr-3 py-1"
                >
                  <span
                    className="w-4 h-4 rounded-full ring-1 ring-white/20 shrink-0"
                    style={{ background: CAPSULE_COLOR_SWATCHES[color] || '#888' }}
                  />
                  <span className="text-xs text-white/70">{colorLabel(t, color)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {capsule.description && (
          <p className="text-sm text-white/55 leading-relaxed line-clamp-4">
            {capsule.description}
          </p>
        )}

        {/* Stock info */}
        {!isSoldOut && capsule.stock > 0 && capsule.stock <= 10 && (
          <p className="text-xs text-amber-400">
            {t('capsuleDrawer.lowStock', { count: capsule.stock })}
          </p>
        )}

        {/* Variants */}
        {capsule.variants && capsule.variants.length > 0 && (
          <div className="space-y-4">
            {capsule.variants.map((variant) => (
              <div key={variant.name}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                    {variant.name}
                  </span>
                  {selectedOptions[variant.name] && (
                    <span className="text-[11px] font-bold text-[#a8ff35]">
                      {selectedOptions[variant.name]}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {variant.options.map((option) => {
                    const isSelected = selectedOptions[variant.name] === option;
                    return (
                      <button
                        key={option}
                        onClick={() =>
                          setSelectedOptions((prev) => ({ ...prev, [variant.name]: option }))
                        }
                        className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 border min-w-[44px] ${
                          isSelected
                            ? 'bg-[#a8ff35] text-black border-[#a8ff35] shadow-[0_0_16px_rgba(168,255,53,0.35)]'
                            : 'bg-white/[0.04] text-white/75 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {buyError && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5 mb-1">
            {buyError}
            {buyError.toLowerCase().includes('solde') && (
              <a href="/profile/me?tab=wallet" className="block underline font-semibold mt-1 text-[#a8ff35]">
                {t('capsuleDrawer.topUpWallet')}
              </a>
            )}
          </div>
        )}

        {/* Buy button */}
        <button
          onClick={handleBuy}
          disabled={!allSelected || isAdding || addedToCart || isSoldOut}
          className={`w-full py-4 rounded-full font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-300 ${
            isSoldOut
              ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
              : addedToCart
              ? 'bg-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.4)]'
              : allSelected
              ? 'bg-gradient-to-r from-[#a8ff35] to-[#6fe600] text-black hover:shadow-[0_0_30px_rgba(168,255,53,0.5)] hover:brightness-110 active:scale-[0.98]'
              : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
          }`}
        >
          {addedToCart ? (
            <><Check size={19} strokeWidth={3} />{t('capsuleDrawer.addedToCart')}</>
          ) : isAdding ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : isSoldOut ? (
            t('capsuleDrawer.soldOut')
          ) : allSelected ? (
            <><ShoppingCart size={18} />{t('capsuleDrawer.buy')}</>
          ) : (
            t('capsuleDrawer.chooseOption')
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Main Drawer ────────────────────────────────────────────── */
export function CapsuleDrawer({ capsules, open, onClose }: Props) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
      // Auto-select if single capsule
      if (capsules.length === 1) setSelectedCapsule(capsules[0]);
      else setSelectedCapsule(null);
    } else {
      setAnimateIn(false);
      const timeoutId = setTimeout(() => {
        setShouldRender(false);
        setSelectedCapsule(null);
      }, 350);
      return () => clearTimeout(timeoutId);
    }
  }, [open, capsules]);

  if (!mounted || !shouldRender) return null;

  const showingProduct = !!selectedCapsule;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] transition-all duration-300 ${
          animateIn ? 'bg-black/70 backdrop-blur-sm' : 'bg-transparent'
        }`}
        onClick={onClose}
      />

      {/* Drawer container */}
      <div
        className={`fixed inset-0 z-[9999] flex items-end md:items-end justify-center pointer-events-none transition-opacity duration-300 ${
          animateIn ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className={`pointer-events-auto w-full max-w-3xl transition-transform duration-300 ease-out ${
            animateIn ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Blue glow line */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#a8ff35] to-transparent" />

          <div className="relative bg-[#0d0d0f]/97 backdrop-blur-2xl rounded-t-[24px] border-t border-x border-white/[0.06] overflow-hidden"
            style={{ maxHeight: '88vh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <div className="flex items-center gap-2">
                {showingProduct && capsules.length > 1 ? (
                  <button
                    onClick={() => setSelectedCapsule(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  >
                    <ChevronLeft size={16} color="#fff" />
                  </button>
                ) : (
                  <img src="/skoleom-mark.png" alt="" className="w-5 h-5 object-contain" />
                )}
                <span className="text-white font-semibold text-sm">
                  {showingProduct ? selectedCapsule!.name : t('capsuleDrawer.capsuleCount', { count: capsules.length, plural: capsules.length > 1 ? 's' : '' })}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:rotate-90 duration-200"
              >
                <X size={16} color="#fff" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-hidden" style={{ height: 'calc(88vh - 72px)' }}>
              {!showingProduct ? (
                /* ── LIST VIEW ── */
                <div className="px-5 pb-6 overflow-y-auto h-full scrollbar-hide space-y-3">
                  {capsules.map((capsule) => (
                    <button
                      key={capsule.id}
                      onClick={() => capsule.status !== 'sold_out' && setSelectedCapsule(capsule)}
                      disabled={capsule.status === 'sold_out'}
                      className="w-full flex items-center gap-4 p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-[14px] text-left transition-all border border-white/[0.05] disabled:opacity-40"
                    >
                      <div className="w-16 h-16 rounded-[10px] overflow-hidden bg-white/5 shrink-0 ring-1 ring-white/10">
                        {capsule.imageUrl ? (
                          <img src={capsule.imageUrl} alt={capsule.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={20} className="text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{capsule.name}{capsule.brand ? ` · ${capsule.brand}` : ''}</p>
                        {capsule.description && (
                          <p className="text-xs text-white/35 line-clamp-1 mt-0.5">{capsule.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[#a8ff35] font-bold text-sm">€{capsule.price.toFixed(2)}</span>
                          {capsule.status === 'sold_out' ? (
                            <span className="text-xs text-red-400">{t('capsuleDrawer.soldOut')}</span>
                          ) : (
                            <span className="text-xs text-white/25">{t('capsuleDrawer.remaining', { count: capsule.stock })}</span>
                          )}
                          {capsule.condition && (
                            <span className="text-xs text-white/25">· {conditionLabel(t, capsule.condition)}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-white/25 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                /* ── PRODUCT VIEW ── */
                <ProductView
                  capsule={selectedCapsule!}
                  showBack={capsules.length > 1}
                  onBack={() => setSelectedCapsule(null)}
                  onClose={onClose}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
