import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Heart, Users, Send, Gift, Wallet, Plus } from 'lucide-react';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { CapsuleDrawer } from '../client/components/Capsule/CapsuleDrawer';
import type { Capsule } from '../shared/types/api';

/* ── Lives config ───────────────────────────────────────────── */
interface LiveConfig {
  videoId: string;
  creator: string;
  avatar: string;
  title: string;
  viewers: number;
  capsules: Capsule[];
  pool: { user: string; text: string }[];
}

const LIVES: LiveConfig[] = [
  {
    videoId: 'yZO80uBK45w',
    creator: 'skoleom_official',
    avatar: 'S',
    title: 'Drop exclusif — collection capsule',
    viewers: 3247,
    capsules: [
      {
        id: 'lc1',
        name: 'Hoodie Skoleom Premium',
        description: 'Hoodie oversize, coton bio 300g, logo brodé.',
        price: 69.90,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=300&h=300&fit=crop',
        images: [],
        stock: 15,
        soldCount: 23,
        commissionRate: 0.15,
        status: 'available',
        variants: [{ name: 'Taille', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }],
      },
      {
        id: 'lc2',
        name: 'Tee-shirt Logo Brodé',
        description: 'Coton peigné, coupe droite.',
        price: 34.90,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop',
        images: [],
        stock: 42,
        soldCount: 67,
        commissionRate: 0.15,
        status: 'available',
        variants: [{ name: 'Taille', options: ['XS', 'S', 'M', 'L', 'XL'] }],
      },
    ],
    pool: [
      { user: 'marie_92',   text: 'Trop bien ce live !!!' },
      { user: 'karim.hmd',  text: "La capsule c'est quoi ?" },
      { user: 'sophiaglow', text: "J'adore 😍" },
      { user: 'julien_b',   text: 'On peut acheter depuis le live ?' },
      { user: 'leabylena',  text: 'Clique sur Capsule en bas à droite !' },
      { user: 'thomas_r',   text: 'Je suis depuis Paris 🗼' },
      { user: 'amina.s',    text: 'La qualité est ouf 🔥' },
      { user: 'maxime77',   text: "C'est dispo en quelle taille ?" },
      { user: 'lola.fit',   text: 'Je veux le même 🙌' },
      { user: 'rayan.k',    text: 'Prix top !' },
      { user: 'noemie_l',   text: '❤️❤️❤️' },
      { user: 'camille.d',  text: "Commandé hier, livré en 3 jours !" },
    ],
  },
  {
    videoId: 'R6Jm7RrTFBc',
    creator: 'stylebylea',
    avatar: 'L',
    title: 'Nouvelle collection été ☀️',
    viewers: 1893,
    capsules: [
      {
        id: 'lc3',
        name: 'Robe Ibiza Lin',
        description: 'Légère et colorée, parfaite pour l\'été. Tissu 100% lin.',
        price: 89.90,
        currency: 'EUR',
        imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300&h=300&fit=crop',
        images: [],
        stock: 12,
        soldCount: 5,
        commissionRate: 0.15,
        status: 'available',
        variants: [{ name: 'Taille', options: ['XS', 'S', 'M', 'L'] }],
      },
    ],
    pool: [
      { user: 'ines_b',     text: 'Livraison combien de jours ?' },
      { user: 'djibril09',  text: 'Skoleom est trop bien' },
      { user: 'alexis_77',  text: '🔥🔥🔥' },
      { user: 'yasmine.b',  text: "Trop belle cette robe !" },
      { user: 'lucas_off',  text: 'Le son est parfait' },
      { user: 'sarah.mk',   text: "J'arrive juste, c'est quoi le produit ?" },
      { user: 'benoit_r',   text: "Earn It c'est trop fort comme concept" },
      { user: 'elodie.c',   text: 'La couleur est magnifique 😍' },
      { user: 'hugo_r',     text: "Je commande pour ma copine 🎁" },
      { user: 'clara.b',    text: 'En stock le XS ?' },
    ],
  },
];

const COLORS = ['#0066FF', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

/* ── Virtual gifts ──────────────────────────────────────────── */
interface GiftDef {
  id: string;
  emoji: string;
  name: string;
  coins: number;
  eur: string;
  color: string;
}

const GIFTS: GiftDef[] = [
  { id: 'rose',     emoji: '🌹', name: 'Rose',     coins: 10,   eur: '0,10€', color: '#ec4899' },
  { id: 'etoile',   emoji: '⭐', name: 'Étoile',   coins: 50,   eur: '0,50€', color: '#f59e0b' },
  { id: 'feu',      emoji: '🔥', name: 'Feu',      coins: 150,  eur: '1,50€', color: '#f97316' },
  { id: 'coeur',    emoji: '💝', name: 'Cœur',     coins: 200,  eur: '2€',    color: '#ec4899' },
  { id: 'rocket',   emoji: '🚀', name: 'Fusée',    coins: 500,  eur: '5€',    color: '#8b5cf6' },
  { id: 'diamant',  emoji: '💎', name: 'Diamant',  coins: 1000, eur: '10€',   color: '#06b6d4' },
  { id: 'trophee',  emoji: '🏆', name: 'Trophée',  coins: 1500, eur: '15€',   color: '#f59e0b' },
  { id: 'couronne', emoji: '👑', name: 'Couronne', coins: 2000, eur: '20€',   color: '#f59e0b' },
];

const COIN_PACKS = [
  { coins: 100,  eur: '1€' },
  { coins: 500,  eur: '4,50€' },
  { coins: 1200, eur: '10€' },
  { coins: 3000, eur: '24€' },
];

interface Comment {
  id: number;
  user: string;
  text: string;
  color: string;
  isGift?: boolean;
  giftEmoji?: string;
}

/* ── Chat panel ─────────────────────────────────────────────── */
type ChatTab = 'chat' | 'gifts';

function ChatPanel({ live, viewers }: { live: LiveConfig; viewers: number }) {
  const [tab, setTab] = useState<ChatTab>('chat');
  const [comments, setComments] = useState<Comment[]>(() =>
    live.pool.slice(0, 5).map((c, i) => ({ ...c, id: i, color: COLORS[i % COLORS.length] })),
  );
  const [inputVal, setInputVal] = useState('');
  const [coins, setCoins] = useState(500);
  const [sentGift, setSentGift] = useState<string | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(50);
  const poolIdx = useRef(5);

  useEffect(() => {
    setComments(live.pool.slice(0, 5).map((c, i) => ({ ...c, id: i, color: COLORS[i % COLORS.length] })));
    poolIdx.current = 5;
    idRef.current = 50;
  }, [live.videoId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [comments]);

  useEffect(() => {
    const iv = setInterval(() => {
      const item = live.pool[poolIdx.current % live.pool.length];
      poolIdx.current++;
      setComments(prev => [
        ...prev.slice(-40),
        { ...item, id: idRef.current++, color: COLORS[idRef.current % COLORS.length] },
      ]);
    }, 1800);
    return () => clearInterval(iv);
  }, [live.videoId]);

  function send() {
    if (!inputVal.trim()) return;
    setComments(prev => [...prev.slice(-40), { id: idRef.current++, user: 'moi', text: inputVal.trim(), color: '#a8ff35' }]);
    setInputVal('');
  }

  function sendGift(gift: GiftDef) {
    if (coins < gift.coins) { setShowRecharge(true); return; }
    setCoins(c => c - gift.coins);
    setSentGift(gift.id);
    setTimeout(() => setSentGift(null), 1200);
    setComments(prev => [...prev.slice(-40), {
      id: idRef.current++,
      user: 'moi',
      text: `a envoyé ${gift.emoji} ${gift.name} à ${live.creator}`,
      color: gift.color,
      isGift: true,
      giftEmoji: gift.emoji,
    }]);
    setTab('chat');
  }

  return (
    <div className="w-[300px] shrink-0 flex flex-col bg-[#0a0a0c] border-l border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-[14px] font-bold">Live</span>
        </div>
        <span className="text-white/40 text-[12px]">{viewers.toLocaleString('fr-FR')} spectateurs</span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-white/[0.06]">
        <button onClick={() => setTab('chat')}
          className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors border-b-2 ${tab === 'chat' ? 'border-white text-white' : 'border-transparent text-white/35 hover:text-white/60'}`}>
          Chat
        </button>
        <button onClick={() => setTab('gifts')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold transition-colors border-b-2 ${tab === 'gifts' ? 'bg-[#f59e0b]/[0.16] border-[#f59e0b] text-[#f59e0b]' : 'bg-[#f59e0b]/[0.08] border-[#f59e0b]/30 text-[#f59e0b]/80 hover:bg-[#f59e0b]/[0.12]'}`}>
          <Gift size={13} />
          Cadeaux
        </button>
      </div>

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <>
          <div ref={chatRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-2.5">
            {comments.map(c => (
              <div key={c.id} className={`flex items-start gap-2 animate-fade-in ${c.isGift ? 'bg-white/[0.03] rounded-xl px-2 py-1.5' : ''}`}>
                {c.isGift ? (
                  <span className="text-[20px] leading-none shrink-0 mt-0.5">{c.giftEmoji}</span>
                ) : (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: c.color }}>
                    {c.user[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold mr-1" style={{ color: c.color }}>{c.user}</span>
                  <span className={`text-[13px] leading-snug break-words ${c.isGift ? 'font-semibold' : 'text-white/80'}`} style={c.isGift ? { color: c.color } : undefined}>{c.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-2">
              <input type="text" placeholder="Commenter…" value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                className="flex-1 bg-transparent text-white text-[13px] placeholder-white/30 outline-none"
              />
              <button onClick={send} className="text-[#a8ff35] hover:text-[#c3ff70] transition-colors shrink-0">
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── GIFTS TAB ── */}
      {tab === 'gifts' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Coin balance */}
          <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/40 flex items-center justify-center">
                <Wallet size={13} className="text-[#f59e0b]" />
              </div>
              <div>
                <p className="text-[15px] font-extrabold text-white leading-none">{coins.toLocaleString('fr-FR')} 🪙</p>
                <p className="text-[10px] text-white/35 mt-0.5">≈ {(coins / 100).toFixed(2).replace('.', ',')} €</p>
              </div>
            </div>
            <button onClick={() => setShowRecharge(r => !r)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/35 text-[#f59e0b] text-[12px] font-bold hover:bg-[#f59e0b]/25 transition-colors">
              <Plus size={12} />
              Recharger
            </button>
          </div>

          {/* Recharge packs (toggle) */}
          {showRecharge && (
            <div className="px-3 py-3 border-b border-white/[0.06] shrink-0 bg-[#f59e0b]/04">
              <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-wide mb-2">Packs de coins</p>
              <div className="grid grid-cols-2 gap-1.5">
                {COIN_PACKS.map(pack => (
                  <button key={pack.coins} onClick={() => { setCoins(c => c + pack.coins); setShowRecharge(false); }}
                    className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl hover:border-[#f59e0b]/50 hover:bg-[#f59e0b]/08 transition-all">
                    <span className="text-[13px] font-bold text-white">{pack.coins} 🪙</span>
                    <span className="text-[12px] font-semibold text-[#f59e0b]">{pack.eur}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="px-4 py-2 shrink-0">
            <p className="text-[11px] text-white/35">Envoie un cadeau à <span className="text-white/60 font-semibold">{live.creator}</span> — il recevra 50% de la valeur.</p>
          </div>

          {/* Gift grid */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              {GIFTS.map(gift => {
                const canAfford = coins >= gift.coins;
                const wasSent = sentGift === gift.id;
                return (
                  <button key={gift.id} onClick={() => sendGift(gift)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-[16px] p-3 border transition-all ${
                      wasSent ? 'scale-95 bg-white/[0.12] border-white/30' :
                      canAfford ? 'bg-white/[0.04] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.08] active:scale-95' :
                      'bg-white/[0.02] border-white/[0.04] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-[28px] leading-none">{gift.emoji}</span>
                    <p className="text-[12px] font-bold text-white">{gift.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-semibold text-[#f59e0b]">{gift.coins} 🪙</span>
                    </div>
                    <p className="text-[10px] text-white/30">{gift.eur}</p>
                    {wasSent && (
                      <div className="absolute inset-0 rounded-[16px] flex items-center justify-center bg-black/40">
                        <span className="text-[22px]">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Not enough coins */}
          {coins < Math.min(...GIFTS.map(g => g.coins)) && (
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 text-center">
              <p className="text-[12px] text-white/40">Solde insuffisant — recharge des coins pour envoyer un cadeau.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Single live card ───────────────────────────────────────── */
function LiveCard({ live, onVisible }: { live: LiveConfig; onVisible: () => void }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(live.viewers * 0.56));
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [viewers, setViewers] = useState(live.viewers);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) onVisible(); }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible]);

  useEffect(() => {
    const iv = setInterval(() => setViewers(v => v + Math.floor(Math.random() * 6 - 2)), 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div ref={cardRef} className="h-full w-full shrink-0 flex items-center justify-center bg-[#060608] snap-start">
      <div className="relative h-full overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '100%' }}>

        {/* YouTube iframe */}
        <iframe
          src={`https://www.youtube.com/embed/${live.videoId}?autoplay=1&mute=1&loop=1&playlist=${live.videoId}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1`}
          allow="autoplay; encrypted-media"
          className="w-full h-full border-0"
          title={live.title}
        />

        {/* Transparent overlay — blocks YouTube hover controls */}
        <div className="absolute inset-0 z-10" style={{ background: 'transparent' }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 pt-3 pb-10 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full tracking-wide shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
              <div className="w-5 h-5 rounded-full bg-[#a8ff35] flex items-center justify-center text-[9px] font-bold text-black shrink-0">
                {live.avatar}
              </div>
              <span className="text-white text-[12px] font-semibold">{live.creator}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
            <Users size={12} className="text-white/70" />
            <span className="text-white text-[12px] font-semibold">{viewers.toLocaleString('fr-FR')}</span>
          </div>
        </div>

        {/* Right actions */}
        <div className="absolute bottom-6 right-3 z-20 flex flex-col items-center gap-4 pointer-events-auto">
          <button
            onClick={() => { setLiked(l => !l); setLikeCount(n => n + (liked ? -1 : 1)); }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all ${liked ? 'scale-110' : ''}`}>
              <Heart size={22} className={liked ? 'text-red-500 fill-red-500' : 'text-white'} />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow">{likeCount.toLocaleString('fr-FR')}</span>
          </button>

          <button onClick={() => setCapsuleOpen(true)} className="skoleom-capsule-btn skoleom-capsule-btn--breathe">
            <img src="/skoleom-mark.png" alt="Skoleom" className="skoleom-capsule-btn-logo" />
            <span>Capsule</span>
          </button>
        </div>

        {/* Caption */}
        <div className="absolute bottom-6 left-3 right-16 z-20 pointer-events-none">
          <p className="text-white text-[13px] font-semibold drop-shadow-lg">{live.title}</p>
        </div>
      </div>

      <CapsuleDrawer capsules={live.capsules} open={capsuleOpen} onClose={() => setCapsuleOpen(false)} />
    </div>
  );
}

/* ── Live page ──────────────────────────────────────────────── */
export default function LivePage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeLive = LIVES[activeIdx];

  return (
    <>
      <Head><title>skoleomLive — Live</title></Head>
      <div className="flex h-screen bg-black overflow-hidden">
        <AppSidebar />

        <main className="flex flex-1 overflow-hidden">
          {/* Snap-scroll live videos */}
          <div className="flex-1 overflow-y-scroll scrollbar-hide snap-y snap-mandatory">
            {LIVES.map((live, i) => (
              <div key={live.videoId} className="h-full w-full snap-start">
                <LiveCard live={live} onVisible={() => setActiveIdx(i)} />
              </div>
            ))}
          </div>

          {/* Fixed chat — updates with active live */}
          <ChatPanel live={activeLive} viewers={activeLive.viewers} />
        </main>
      </div>
    </>
  );
}
