import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, UserCircle2, ShoppingCart, Plus, Layers, TrendingUp, Zap, Crown, Gift, Megaphone,
  RefreshCw, Landmark, ShieldCheck, Handshake, Trophy, Shirt, Ticket, Laptop, Globe, Store, Star, Gavel,
  Play, Clock,
} from 'lucide-react';

// Lecteur video explicatif — passe `src` une fois la vraie video prete (mp4 ou embed
// YouTube/Vimeo), affiche un placeholder stylise en attendant.
function ExplainerVideo({ accent, duration, caption, src }: {
  accent: 'blue' | 'green' | 'purple';
  duration: string;
  caption: string;
  src?: string;
}) {
  const colors = {
    blue: { text: '#a8ff35', border: '#a8ff3530', bg: '#a8ff3510', glow: 'rgba(168,255,53,0.25)' },
    green: { text: '#22c55e', border: '#22c55e30', bg: '#22c55e10', glow: 'rgba(34,197,94,0.25)' },
    purple: { text: '#a855f7', border: '#a855f730', bg: '#a855f710', glow: 'rgba(168,85,247,0.25)' },
  }[accent];

  if (src) {
    return (
      <div className="rounded-[18px] overflow-hidden border mb-5" style={{ borderColor: colors.border }}>
        <video src={src} controls className="w-full aspect-video bg-black" />
      </div>
    );
  }

  return (
    <div
      className="relative rounded-[18px] overflow-hidden border mb-5 aspect-video flex flex-col items-center justify-center text-center px-6"
      style={{ borderColor: colors.border, background: `linear-gradient(135deg, ${colors.bg}, transparent)` }}
    >
      <button
        type="button"
        disabled
        className="w-14 h-14 rounded-full flex items-center justify-center mb-3 border transition-all duration-200"
        style={{ background: colors.bg, borderColor: colors.border, boxShadow: `0 0 24px ${colors.glow}` }}
      >
        <Play size={22} style={{ color: colors.text }} fill={colors.text} />
      </button>
      <p className="text-[13px] font-bold text-white mb-1">{caption}</p>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: colors.text }}>
        <Clock size={11} />
        Vidéo bientôt disponible · {duration}
      </div>
    </div>
  );
}

type Tab = 'creator' | 'buyer' | 'skoleom';

function CapsulePreview() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-black/55 border border-white/20 rounded-full px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-md mt-2">
      <img src="/skoleom-mark.png" alt="" className="w-4 h-4 object-contain" />
      Capsule
    </span>
  );
}

function Step({
  num,
  accent,
  title,
  desc,
  extra,
}: {
  num: number;
  accent: 'blue' | 'green';
  title: string;
  desc: string;
  extra?: React.ReactNode;
}) {
  const isBlue = accent === 'blue';
  return (
    <div className="flex gap-3.5 items-start bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4 hover:bg-white/[0.055] hover:border-white/[0.12] transition-all duration-200">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 border ${
          isBlue
            ? 'bg-[#a8ff35]/14 text-[#a8ff35] border-[#a8ff35]/25'
            : 'bg-[#22c55e]/14 text-[#22c55e] border-[#22c55e]/25'
        }`}
      >
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold mb-0.5">{title}</p>
        <p className="text-[13px] text-white/52 leading-relaxed">{desc}</p>
        {extra}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GuideModal({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<Tab>('creator');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
          visible ? 'bg-black/80 backdrop-blur-[6px]' : 'bg-transparent pointer-events-none'
        }`}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className={`relative w-full max-w-[660px] max-h-[92vh] flex flex-col bg-[#0d0d10] border border-white/[0.08] rounded-[28px] overflow-hidden transition-all duration-350 ${
            visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
          }`}
          style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Blue glow line */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#a8ff35] to-transparent shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#a8ff35] to-[#6fe600] flex items-center justify-center shrink-0">
                <Layers size={16} className="text-black" />
              </div>
              <div>
                <p className="text-[15px] font-bold leading-tight">Comment ça marche ?</p>
                <p className="text-[11px] text-white/45 leading-tight">skoleomLive — Social Commerce</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-[34px] h-[34px] rounded-full bg-white/[0.07] hover:bg-white/[0.14] flex items-center justify-center text-white/55 hover:text-white transition-all duration-200 hover:rotate-90"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-6 pt-4 shrink-0 flex-wrap">
            <button
              onClick={() => setTab('creator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold border transition-all duration-200 ${
                tab === 'creator'
                  ? 'bg-[#a8ff35]/20 border-[#a8ff35]/60 text-white shadow-[0_0_16px_rgba(168,255,53,0.2)]'
                  : 'bg-[#a8ff35]/10 border-[#a8ff35]/20 text-[#c3ff70] hover:border-[#a8ff35]/40'
              }`}
            >
              <UserCircle2 size={15} />
              Je suis Créateur
            </button>
            <button
              onClick={() => setTab('buyer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold border transition-all duration-200 ${
                tab === 'buyer'
                  ? 'bg-[#22c55e]/18 border-[#22c55e]/55 text-white shadow-[0_0_16px_rgba(34,197,94,0.15)]'
                  : 'bg-[#22c55e]/10 border-[#22c55e]/18 text-[#6ee7a0] hover:border-[#22c55e]/38'
              }`}
            >
              <ShoppingCart size={15} />
              Je suis Acheteur
            </button>
            <button
              onClick={() => setTab('skoleom')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold border transition-all duration-200 ${
                tab === 'skoleom'
                  ? 'bg-[#a855f7]/20 border-[#a855f7]/60 text-white shadow-[0_0_16px_rgba(168,85,247,0.2)]'
                  : 'bg-[#a855f7]/10 border-[#a855f7]/20 text-[#d8b4fe] hover:border-[#a855f7]/40'
              }`}
            >
              <TrendingUp size={15} />
              Pour Skoleom
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto scrollbar-hide flex-1 px-6 py-5">

            {/* ── CREATOR ── */}
            {tab === 'creator' && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#a8ff35] mb-3">
                  Pour les créateurs &amp; vendeurs
                </p>
                <h2 className="text-[22px] font-extrabold tracking-tight leading-snug mb-1.5">
                  Lance une Enchère,<br />vends au meilleur prix.
                </h2>
                <p className="text-[14px] text-white/52 leading-relaxed mb-3">
                  Tu crées du contenu ? Lance une <strong className="text-white">Enchère</strong> en direct : fixe une mise de départ, tes viewers misent en temps réel dans le chat, le prix grimpe jusqu&apos;au bout.
                </p>

                {/* Qui peut être créateur — pas réservé à un profil type */}
                <div className="flex gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#a8ff35]/30 bg-[#a8ff35]/10 text-[#a8ff35]">
                    <Store size={11} /> Une marque
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#a8ff35]/30 bg-[#a8ff35]/10 text-[#a8ff35]">
                    <Star size={11} /> Un influenceur
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#a8ff35]/30 bg-[#a8ff35]/10 text-[#a8ff35]">
                    <UserCircle2 size={11} /> Toi, tout simplement
                  </span>
                </div>
                <p className="text-[12px] text-white/40 leading-relaxed mb-5">
                  Aucun statut requis pour créer : marque, influenceur ou simple utilisateur qui veut vendre un article — tout le monde peut lancer sa Capsule.
                </p>

                <ExplainerVideo
                  accent="blue"
                  duration="1 min 30"
                  caption="Regarde comment lancer ta première Enchère"
                />

                <div className="flex flex-col gap-3 mb-5">
                  <Step
                    num={1} accent="blue"
                    title="Crée ton compte & choisis ton offre"
                    desc="Inscris-toi en 30 secondes. Ton offre détermine combien de manches d'enchère tu peux lancer par live — commence gratuitement avec 2 manches, passe en Premium pour scaler."
                  />
                  <Step
                    num={2} accent="blue"
                    title="Lance ton Enchère"
                    desc="Démarre une session enchère depuis ton Studio, choisis un produit, fixe une mise de départ et une durée — c'est parti. Neufs ou d'occasion, tout est bienvenu."
                  />
                  <Step
                    num={3} accent="blue"
                    title="Le prix grimpe en direct"
                    desc="Tes viewers misent en temps réel dans le chat — une mise de dernière seconde prolonge automatiquement l'enchère (anti-sniping). Le plus offrant remporte le produit, ton pourcentage tombe immédiatement."
                    extra={
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#a8ff35]/30 bg-[#a8ff35]/10 text-[#a8ff35] mt-2">
                        <Gavel size={11} /> Nombre de manches selon ton offre
                      </span>
                    }
                  />
                  <Step
                    num={4} accent="blue"
                    title="Ou lance un Live classique"
                    desc="Présente tes produits à prix fixe grâce à la Capsule — le bouton apparaît sur l'écran de tes viewers, ils achètent sans quitter le Live."
                    extra={
                      <div className="flex items-center gap-2 mt-2">
                        <CapsulePreview />
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]">
                          <RefreshCw size={11} /> Occasion OK
                        </span>
                      </div>
                    }
                  />
                </div>

                {/* Earn box */}
                <div className="flex items-center gap-4 bg-gradient-to-r from-[#22c55e]/10 to-[#a8ff35]/08 border border-[#22c55e]/20 rounded-[18px] p-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#22c55e]/15 flex items-center justify-center shrink-0">
                    <Landmark size={22} className="text-[#22c55e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold mb-0.5">Tes gains, tes règles</p>
                    <p className="text-[12px] text-white/48 leading-relaxed">Tu fixes ton prix, on s&apos;occupe du paiement. Tu touches ton pourcentage dès validation de la commande.</p>
                  </div>
                  <div className="shrink-0 bg-[#22c55e]/15 border border-[#22c55e]/30 rounded-full px-3 py-1.5 text-[13px] font-extrabold text-[#22c55e] whitespace-nowrap">
                    jusqu&apos;à 88%
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#a8ff35] text-black text-[14px] font-bold hover:brightness-110 hover:shadow-[0_0_24px_rgba(168,255,53,0.4)] transition-all duration-200 active:scale-[0.97]">
                    <Plus size={16} />
                    Lancer mon premier Live
                  </button>
                  <button className="px-5 py-3.5 rounded-full bg-white/[0.06] border border-white/[0.07] text-[14px] font-bold text-white/65 hover:bg-white/[0.1] hover:text-white transition-all duration-200">
                    Studio →
                  </button>
                </div>
              </div>
            )}

            {/* ── BUYER ── */}
            {tab === 'buyer' && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#22c55e] mb-3">
                  Pour les acheteurs
                </p>
                <h2 className="text-[22px] font-extrabold tracking-tight leading-snug mb-1.5">
                  Découvre, clique,<br />
                  <span className="text-[#22c55e]">Earn It.</span>
                </h2>
                <p className="text-[14px] text-white/52 leading-relaxed mb-3">
                  Rejoins des Lives en direct et achète les produits que tu vois en temps réel — neufs ou d&apos;occasion. Plus besoin de chercher ailleurs.
                </p>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#ec4899]/30 bg-[#ec4899]/10 text-[#ec4899]">
                    <Gift size={11} /> Envoie des cadeaux en Live
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]">
                    <RefreshCw size={11} /> Articles d&apos;occasion acceptés
                  </span>
                </div>

                <div className="flex flex-col gap-3 mb-5">
                  <Step
                    num={1} accent="green"
                    title="Rejoins un Live"
                    desc="Parcours le feed et lance-toi dans un Live en cours. Tu vois le créateur présenter ses produits en temps réel, devant toi."
                  />
                  <Step
                    num={2} accent="green"
                    title="Clique sur Capsule"
                    desc="Le bouton Capsule apparaît pendant le Live dès qu'un produit est mis en avant. Un clic : tu vois la fiche complète avec prix, description et photos."
                    extra={<CapsulePreview />}
                  />
                  <Step
                    num={3} accent="green"
                    title="Earn It — achète sans quitter le Live"
                    desc="Choisis ta variante, valide, c'est dans le panier. Tu continues de regarder le Live pendant que ta commande est confirmée. Paiement 100% sécurisé."
                  />
                </div>

                {/* Security box */}
                <div className="flex items-center gap-4 bg-gradient-to-r from-[#22c55e]/09 to-[#a8ff35]/07 border border-[#22c55e]/18 rounded-[18px] p-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#22c55e]/15 flex items-center justify-center shrink-0">
                    <ShieldCheck size={22} className="text-[#22c55e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold mb-0.5">Paiement sécurisé</p>
                    <p className="text-[12px] text-white/48 leading-relaxed">Tous les achats sont traités via Stripe. Livraison directement par le créateur, suivi inclus.</p>
                  </div>
                  <div className="shrink-0 bg-[#22c55e]/15 border border-[#22c55e]/30 rounded-full px-3 py-1.5 text-[13px] font-extrabold text-[#22c55e] whitespace-nowrap">
                    100% sécurisé
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#22c55e] text-white text-[14px] font-bold hover:brightness-110 hover:shadow-[0_0_24px_rgba(34,197,94,0.3)] transition-all duration-200 active:scale-[0.97]">
                    Explorer le feed
                  </button>
                  <button className="px-5 py-3.5 rounded-full bg-white/[0.06] border border-white/[0.07] text-[14px] font-bold text-white/65 hover:bg-white/[0.1] hover:text-white transition-all duration-200">
                    En savoir plus →
                  </button>
                </div>
              </div>
            )}

            {/* ── SKOLEOM ── */}
            {tab === 'skoleom' && (
              <div>
                {/* Identity / Positioning */}
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#a855f7] mb-3">
                  Qui sommes-nous ?
                </p>
                <h2 className="text-[22px] font-extrabold tracking-tight leading-snug mb-2">
                  Skoleom Live regroupe<br />
                  <span className="text-[#a855f7]">le meilleur de 4 plateformes.</span>
                </h2>
                <p className="text-[14px] text-white/52 leading-relaxed mb-4">
                  Une seule app pour vendre en live, exposer tes produits dans un feed soigné, revendre du neuf ou de l&apos;occasion, et tenir une boutique ouverte 24h/24.
                </p>

                <div className="grid grid-cols-2 gap-2.5 mb-6">

                  {/* TikTok Shop — logo SVG officiel */}
                  <div className="rounded-[16px] p-3.5 border" style={{ background: '#ec489908', borderColor: '#ec489930' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="white">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.24a8.27 8.27 0 004.84 1.54V7.35a4.84 4.84 0 01-1.07-.66z" />
                      </svg>
                      <p className="text-[13px] font-extrabold" style={{ color: '#ec4899' }}>TikTok Shop</p>
                    </div>
                    <p className="text-[12px] text-white/50 leading-relaxed">Achat instantané pendant un Live — sans quitter l&apos;écran, sans redirection.</p>
                  </div>

                  {/* Instagram */}
                  <div className="rounded-[16px] p-3.5 border" style={{ background: '#a8ff3508', borderColor: '#a8ff3530' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="url(#ig-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <defs>
                          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f09433" />
                            <stop offset="50%" stopColor="#e6683c" />
                            <stop offset="75%" stopColor="#dc2743" />
                            <stop offset="100%" stopColor="#cc2366" />
                          </linearGradient>
                        </defs>
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                        <circle cx="12" cy="12" r="5" />
                        <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad)" stroke="none" />
                      </svg>
                      <p className="text-[13px] font-extrabold" style={{ color: '#a8ff35' }}>Instagram</p>
                    </div>
                    <p className="text-[12px] text-white/50 leading-relaxed">Feed immersif, design soigné, DA cohérente — le scroll qui donne envie d&apos;acheter.</p>
                  </div>

                  {/* Vinted — logo stylisé */}
                  <div className="rounded-[16px] p-3.5 border" style={{ background: '#09B1BA08', borderColor: '#09B1BA30' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 36 36" className="w-5 h-5 shrink-0">
                        <path fill="#09B1BA" d="M2 4 L7 4 L18 27 L29 4 L34 4 L18 32 Z" />
                      </svg>
                      <p className="text-[13px] font-extrabold" style={{ color: '#09B1BA' }}>Vinted</p>
                    </div>
                    <p className="text-[12px] text-white/50 leading-relaxed">Vends du neuf comme de l&apos;occasion. Chaque article trouve sa communauté.</p>
                  </div>

                  {/* Shopify */}
                  <div className="rounded-[16px] p-3.5 border" style={{ background: '#96bf4808', borderColor: '#96bf4830' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="#96bf48">
                        <path d="M15.337 23.979l6.43-1.39S19.708 7.147 19.69 7.01c-.018-.136-.136-.226-.254-.226s-2.304-.163-2.304-.163-.932-.913-1.04-1.012V5.6c-.488-1.265-1.34-1.934-2.3-2.186v-.27c0-.596-.488-1.084-1.084-1.084-.596 0-1.084.488-1.084 1.084v.217c-.21.04-.407.1-.597.18C10.54 2.03 9.22 1.57 7.74 1.97l.163-.028s-1.085.596-1.32 2.304c-.109.776-.127 1.57-.163 2.34l-1.445.46-.054.018-1.535.487c-.271.09-.29.108-.308.37C2.96 8.376 1.5 22.595 1.5 22.595l12.872 1.953.965-.569zM14.48 5.31v.162l-2.05.65c.016-.814.12-1.654.43-2.39.56.433 1.085 1.093 1.62 1.578zm-2.43-.7c.271-.739.74-1.373 1.32-1.778.108.415.162.939.162 1.57v.162l-1.49.47c.005-.143.007-.287.007-.424zm.578-2.89c.163 0 .325.055.47.163-.579.296-1.194.938-1.46 2.304l-1.68.54c.325-1.427 1.283-3.007 2.67-3.007zM9.76 17.5c.054.884.63 1.67 1.57 1.724.848.054 1.625-.614 1.696-1.516l.054-.722.018-.46s-.614.235-1.373.325c-1.228.163-1.985-.343-1.966.649zm5.7 1.37c-.017-.487-.054-1.12-.054-1.75v-.054c0-.054 0-.109.018-.163.054-1.156-.054-2.123-.578-2.83-.38-.524-.994-.83-1.697-.857-.072 0-.145 0-.217.01-1.373.109-1.868.813-1.868.813l.054-2.87-.018-.018.018-.018 3.876-.858s.433 3.876.468 4.265z" />
                      </svg>
                      <p className="text-[13px] font-extrabold" style={{ color: '#96bf48' }}>Shopify</p>
                    </div>
                    <p className="text-[12px] text-white/50 leading-relaxed">Ta boutique est toujours ouverte. Tu postes, tu attends — les ventes arrivent même hors Live.</p>
                  </div>

                </div>

                {/* Divider into business model */}
                <div className="h-px bg-white/[0.06] mb-5" />

                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#a855f7] mb-3">
                  Modèle économique
                </p>
                <h2 className="text-[22px] font-extrabold tracking-tight leading-snug mb-1.5">
                  Comment Skoleom<br />
                  <span className="text-[#a855f7]">gagne de l&apos;argent.</span>
                </h2>
                <p className="text-[14px] text-white/52 leading-relaxed mb-5">
                  Skoleom prend une commission sur les transactions et propose des abonnements pour débloquer plus de fonctionnalités. Simple, transparent, aligné avec les créateurs.
                </p>

                {/* Revenue streams */}
                <div className="flex flex-col gap-3 mb-5">
                  {/* Commission ventes */}
                  <div className="flex gap-3.5 items-start bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4">
                    <div className="w-9 h-9 rounded-full bg-[#a855f7]/14 border border-[#a855f7]/25 flex items-center justify-center shrink-0">
                      <TrendingUp size={16} className="text-[#a855f7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[14px] font-bold">Commission sur ventes Capsule</p>
                        <span className="bg-[#a855f7]/15 border border-[#a855f7]/30 text-[#a855f7] text-[13px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ml-2">5%</span>
                      </div>
                      <p className="text-[13px] text-white/52 leading-relaxed">Sur chaque achat réalisé via une Capsule pendant un Live ou dans le feed. Le créateur garde 95% du prix de vente.</p>
                    </div>
                  </div>

                  {/* Cadeaux live */}
                  <div className="flex gap-3.5 items-start bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4">
                    <div className="w-9 h-9 rounded-full bg-[#f59e0b]/14 border border-[#f59e0b]/25 flex items-center justify-center shrink-0">
                      <Gift size={16} className="text-[#f59e0b]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[14px] font-bold">Commission sur cadeaux Live</p>
                        <span className="bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#f59e0b] text-[13px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ml-2">50%</span>
                      </div>
                      <p className="text-[13px] text-white/52 leading-relaxed">Les viewers peuvent envoyer des cadeaux virtuels en direct. Skoleom perçoit 50% de la valeur — le créateur reçoit l&apos;autre 50%.</p>
                    </div>
                  </div>

                  {/* Abonnements */}
                  <div className="flex gap-3.5 items-start bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4">
                    <div className="w-9 h-9 rounded-full bg-[#a8ff35]/14 border border-[#a8ff35]/25 flex items-center justify-center shrink-0">
                      <Zap size={16} className="text-[#a8ff35]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold mb-1">Abonnements créateurs</p>
                      <p className="text-[13px] text-white/52 leading-relaxed mb-3">3 paliers pour débloquer plus de Capsules, d&apos;articles et de manches d&apos;enchère — avant ou pendant un Live.</p>

                      {/* Plans */}
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {[
                          { name: 'Standard',      price: '0€',     limit: '2 Capsules · 2 art. · 2 enchères',  icon: null },
                          { name: 'Premium',       price: '9,90€',  limit: '15 Capsules · 5 art. · 10 enchères', icon: 'blue' },
                          { name: 'Ultra Premium', price: '29,90€', limit: '∞ Capsules · 8 art. · ∞ enchères', icon: 'gold' },
                        ].map(plan => (
                          <div
                            key={plan.name}
                            className={`rounded-[14px] p-3 border text-center ${
                              plan.icon === 'gold'
                                ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30'
                                : plan.icon === 'blue'
                                ? 'bg-[#a8ff35]/10 border-[#a8ff35]/25'
                                : 'bg-white/[0.03] border-white/[0.07]'
                            }`}
                          >
                            <div className="flex justify-center mb-1.5">
                              {plan.icon === 'gold' && <Crown size={14} className="text-[#f59e0b]" />}
                              {plan.icon === 'blue' && <Zap size={14} className="text-[#a8ff35]" />}
                              {!plan.icon && <div className="w-3.5 h-3.5 rounded-full bg-white/20" />}
                            </div>
                            <p className={`text-[11px] font-bold mb-1 ${plan.icon === 'gold' ? 'text-[#f59e0b]' : plan.icon === 'blue' ? 'text-[#a8ff35]' : 'text-white/50'}`}>
                              {plan.name}
                            </p>
                            <p className="text-[15px] font-extrabold text-white leading-tight">{plan.price}</p>
                            <p className="text-[10px] text-white/35 leading-tight">/mois</p>
                            <p className="text-[11px] font-semibold text-white/60 mt-1.5">{plan.limit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Boost de visibilité */}
                  <div className="flex gap-3.5 items-start bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4">
                    <div className="w-9 h-9 rounded-full bg-[#ec4899]/14 border border-[#ec4899]/25 flex items-center justify-center shrink-0">
                      <Megaphone size={16} className="text-[#ec4899]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[14px] font-bold">Boost de visibilité</p>
                        <span className="bg-[#ec4899]/15 border border-[#ec4899]/30 text-[#ec4899] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 uppercase tracking-wide">Nouveau</span>
                      </div>
                      <p className="text-[13px] text-white/52 leading-relaxed mb-3">
                        Les créateurs peuvent payer pour être mis en avant dans le feed — comme une pub TikTok. Plus de portée, plus de viewers sur leurs Lives et posts.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: 'Boost S',  price: '4,90€',  reach: '×2 portée',  color: 'white' },
                          { name: 'Boost M',  price: '14,90€', reach: '×5 portée',  color: '#ec4899' },
                          { name: 'Boost XL', price: '39,90€', reach: '×15 portée', color: '#a855f7' },
                        ].map(b => (
                          <div key={b.name} className={`rounded-[14px] p-3 border text-center ${
                            b.color === '#a855f7' ? 'bg-[#a855f7]/10 border-[#a855f7]/30' :
                            b.color === '#ec4899' ? 'bg-[#ec4899]/10 border-[#ec4899]/25' :
                            'bg-white/[0.03] border-white/[0.07]'
                          }`}>
                            <p className={`text-[11px] font-bold mb-1 ${b.color === '#a855f7' ? 'text-[#a855f7]' : b.color === '#ec4899' ? 'text-[#ec4899]' : 'text-white/50'}`}>{b.name}</p>
                            <p className="text-[15px] font-extrabold text-white leading-tight">{b.price}</p>
                            <p className="text-[10px] text-white/35">/mois</p>
                            <p className="text-[11px] font-semibold text-white/60 mt-1.5">{b.reach}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary box */}
                <div className="flex items-center gap-4 bg-gradient-to-r from-[#a855f7]/10 to-[#a8ff35]/08 border border-[#a855f7]/20 rounded-[18px] p-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#a855f7]/15 flex items-center justify-center shrink-0">
                    <Handshake size={22} className="text-[#a855f7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold mb-0.5">Aligné avec les créateurs</p>
                    <p className="text-[12px] text-white/48 leading-relaxed">Skoleom ne gagne que si les créateurs vendent. Nos intérêts sont les mêmes — ton succès est notre succès.</p>
                  </div>
                </div>

                {/* Top sellers rewards */}
                <div className="bg-gradient-to-br from-[#f59e0b]/10 via-[#f97316]/06 to-[#ec4899]/08 border border-[#f59e0b]/30 rounded-[18px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={20} className="text-[#f59e0b]" />
                    <div>
                      <p className="text-[14px] font-extrabold text-white leading-tight">Récompenses Top Vendeurs</p>
                      <p className="text-[11px] text-[#f59e0b]/80">Pour les meilleurs créateurs du mois</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-white/50 leading-relaxed mb-3">
                    Les créateurs qui performent le mieux reçoivent des cadeaux exclusifs de la part de Skoleom — une façon de récompenser ceux qui font vivre la plateforme.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Shirt, label: 'Maillot Skoleom',   desc: 'Édition limitée signée' },
                      { icon: Ticket, label: 'Places de concert', desc: 'Événements partenaires' },
                      { icon: Laptop, label: 'Gaming gear',        desc: 'Setup streaming offert' },
                      { icon: Globe, label: 'Voyages exclusifs',  desc: 'Events créateurs off' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-[12px] px-3 py-2.5">
                        <r.icon size={17} className="text-[#f59e0b] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-white truncate">{r.label}</p>
                          <p className="text-[10px] text-white/35 truncate">{r.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 mt-3 text-center">Classement mis à jour chaque mois · Top 1% des créateurs</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── Trigger button — cercle "?" ── */
export function GuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="px-3 py-1.5">
        <button
          onClick={() => setOpen(true)}
          title="Comment ça marche ?"
          className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-[14px] font-bold text-white/45 hover:text-white hover:border-white/55 hover:bg-white/[0.06] transition-all duration-200"
        >
          ?
        </button>
      </div>
      <GuideModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
