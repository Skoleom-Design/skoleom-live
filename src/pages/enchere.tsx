import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Heart, Users, Send, Gift, Wallet, Plus, Gavel, Timer } from 'lucide-react';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { GIFTS, COIN_PACKS, type GiftDef } from '../client/constants/gifts';
import { api } from '../shared/api/http';

/* ── Auctions config ────────────────────────────────────────── */
interface AuctionItem {
  name: string;
  description: string;
  imageUrl: string;
}

interface AuctionConfig {
  videoId: string;
  creator: string;
  avatar: string;
  title: string;
  viewers: number;
  item: AuctionItem;
  startingBid: number;
  endsInSeconds: number;
  pool: { user: string; text: string }[];
}

const AUCTIONS: AuctionConfig[] = [
  {
    videoId: 'yZO80uBK45w',
    creator: 'skoleom_official',
    avatar: 'S',
    title: 'Enchère live — pièce unique signée',
    viewers: 2140,
    item: {
      name: 'Hoodie Skoleom Édition Limitée',
      description: 'Pièce unique signée par le créateur, numérotée 1/1.',
      imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=300&h=300&fit=crop',
    },
    startingBid: 40,
    endsInSeconds: 240,
    pool: [
      { user: 'marie_92',   text: "J'enchéris !!" },
      { user: 'karim.hmd',  text: 'Ça monte vite 😅' },
      { user: 'sophiaglow', text: 'Magnifique pièce 😍' },
      { user: 'julien_b',   text: 'Combien de temps il reste ?' },
      { user: 'leabylena',  text: 'Clique sur Enchérir en bas à droite !' },
      { user: 'thomas_r',   text: 'Je monte à 55€' },
      { user: 'amina.s',    text: 'Cette qualité 🔥' },
      { user: 'maxime77',   text: 'Numérotée en plus, ça vaut le coup' },
      { user: 'lola.fit',   text: 'Je veux la même 🙌' },
      { user: 'rayan.k',    text: 'Allez encore un effort !' },
    ],
  },
  {
    videoId: 'R6Jm7RrTFBc',
    creator: 'stylebylea',
    avatar: 'L',
    title: 'Enchère flash — collection capsule',
    viewers: 1320,
    item: {
      name: 'Robe Ibiza Lin — prototype',
      description: 'Prototype exclusif jamais mis en vente, taille M.',
      imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300&h=300&fit=crop',
    },
    startingBid: 60,
    endsInSeconds: 150,
    pool: [
      { user: 'ines_b',     text: "C'est un prototype unique ?" },
      { user: 'djibril09',  text: 'Enchère intense là 🔥' },
      { user: 'alexis_77',  text: 'Je monte !' },
      { user: 'yasmine.b',  text: 'Trop belle cette robe !' },
      { user: 'lucas_off',  text: 'Bonne chance à tous 😄' },
      { user: 'sarah.mk',   text: "J'arrive, combien la mise actuelle ?" },
      { user: 'benoit_r',   text: 'Le concept enchère est top' },
      { user: 'elodie.c',   text: 'La couleur est magnifique 😍' },
    ],
  },
];

const COLORS = ['#0066FF', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
const BID_STEPS = [5, 10, 20];

interface Comment {
  id: number;
  user: string;
  text: string;
  color: string;
  isGift?: boolean;
  giftImage?: string;
  isBid?: boolean;
}

function fmtCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ── Chat panel ─────────────────────────────────────────────── */
type ChatTab = 'chat' | 'gifts';

function ChatPanel({
  auction,
  viewers,
  comments,
  setComments,
}: {
  auction: AuctionConfig;
  viewers: number;
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
}) {
  const [tab, setTab] = useState<ChatTab>('chat');
  const [inputVal, setInputVal] = useState('');
  const [coins, setCoins] = useState(0);
  const [sentGift, setSentGift] = useState<string | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(9000);

  // Le solde de coins reflete le vrai wallet (walletBalance, 100 coins = 1€) — on le recharge
  // depuis le backend a l'ouverture pour qu'une recharge faite ailleurs (profil) soit visible ici.
  useEffect(() => {
    api.get<{ walletBalance: number }>('/auth/me')
      .then((me) => setCoins(Math.round(Number(me.walletBalance ?? 0) * 100)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [comments]);

  function send() {
    if (!inputVal.trim()) return;
    setComments((prev) => [...prev.slice(-40), { id: idRef.current++, user: 'moi', text: inputVal.trim(), color: '#a8ff35' }]);
    setInputVal('');
  }

  // Credite reellement le wallet cote backend (meme flux simule que Profil > Wallet) au lieu
  // d'ajouter des coins localement — le solde reste coherent partout dans l'app.
  async function buyPack(pack: { coins: number; eur: string }) {
    const amount = parseFloat(pack.eur.replace('€', '').replace(',', '.'));
    try {
      const res = await api.post<{ walletBalance: number }>('/payments/wallet/topup', { amount });
      setCoins(Math.round(Number(res.walletBalance) * 100));
    } catch {
      // Non connecte ou erreur reseau — le vrai solde n'a pas bouge, on ne change rien localement.
    }
    setShowRecharge(false);
  }

  // Debite reellement le wallet cote backend — ces createurs de demo sont fictifs, donc l'argent
  // ne credite personne en retour (voir sendDemoGift), mais le solde de l'envoyeur, lui, est reel.
  async function sendGift(gift: GiftDef) {
    if (coins < gift.coins) { setShowRecharge(true); return; }
    try {
      const res = await api.post<{ walletBalance: number }>('/lives/gift/demo', { giftType: gift.id });
      setCoins(Math.round(Number(res.walletBalance) * 100));
    } catch {
      setShowRecharge(true);
      return;
    }
    setSentGift(gift.id);
    setTimeout(() => setSentGift(null), 1200);
    setComments((prev) => [...prev.slice(-40), {
      id: idRef.current++,
      user: 'moi',
      text: `a envoyé ${gift.name} à ${auction.creator}`,
      color: gift.color,
      isGift: true,
      giftImage: gift.image3d,
    }]);
    setTab('chat');
  }

  return (
    <div className="w-[300px] shrink-0 flex flex-col bg-[#0a0a0c] border-l border-white/[0.06]">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-[14px] font-bold">Enchère</span>
        </div>
        <span className="text-white/40 text-[12px]">{viewers.toLocaleString('fr-FR')} spectateurs</span>
      </div>

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

      {tab === 'chat' && (
        <>
          <div ref={chatRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-2.5">
            {comments.map((c) => (
              <div key={c.id} className={`flex items-start gap-2 animate-fade-in ${c.isGift || c.isBid ? 'bg-white/[0.03] rounded-xl px-2 py-1.5' : ''}`}>
                {c.isGift ? (
                  c.giftImage && <img src={c.giftImage} alt="" className="w-7 h-7 object-contain shrink-0 mt-0.5" />
                ) : c.isBid ? (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#a8ff35]/15">
                    <Gavel size={12} className="text-[#a8ff35]" />
                  </span>
                ) : (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: c.color }}>
                    {c.user[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold mr-1" style={{ color: c.color }}>{c.user}</span>
                  <span className={`text-[13px] leading-snug break-words ${c.isGift || c.isBid ? 'font-semibold' : 'text-white/80'}`} style={c.isGift || c.isBid ? { color: c.color } : undefined}>{c.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-2">
              <input type="text" placeholder="Commenter…" value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                className="flex-1 bg-transparent text-white text-[13px] placeholder-white/30 outline-none"
              />
              <button onClick={send} className="text-[#a8ff35] hover:text-[#c3ff70] transition-colors shrink-0">
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'gifts' && (
        <div className="flex flex-col flex-1 overflow-hidden">
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
            <button onClick={() => setShowRecharge((r) => !r)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/35 text-[#f59e0b] text-[12px] font-bold hover:bg-[#f59e0b]/25 transition-colors">
              <Plus size={12} />
              Recharger
            </button>
          </div>

          {showRecharge && (
            <div className="px-3 py-3 border-b border-white/[0.06] shrink-0 bg-[#f59e0b]/04">
              <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-wide mb-2">Packs de coins</p>
              <div className="grid grid-cols-2 gap-1.5">
                {COIN_PACKS.map((pack) => (
                  <button key={pack.coins} onClick={() => buyPack(pack)}
                    className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl hover:border-[#f59e0b]/50 hover:bg-[#f59e0b]/08 transition-all">
                    <span className="text-[13px] font-bold text-white">{pack.coins} 🪙</span>
                    <span className="text-[12px] font-semibold text-[#f59e0b]">{pack.eur}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-2 shrink-0">
            <p className="text-[11px] text-white/35">Envoie un cadeau à <span className="text-white/60 font-semibold">{auction.creator}</span> — il recevra 50% de la valeur.</p>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              {GIFTS.map((gift) => {
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
                    <img src={gift.image3d} alt={gift.name} className="w-11 h-11 object-contain" />
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

          {coins < Math.min(...GIFTS.map((g) => g.coins)) && (
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 text-center">
              <p className="text-[12px] text-white/40">Solde insuffisant — recharge des coins pour envoyer un cadeau.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Bid drawer ─────────────────────────────────────────────── */
function BidDrawer({
  auction,
  currentBid,
  ended,
  onClose,
  onBid,
}: {
  auction: AuctionConfig;
  currentBid: number;
  ended: boolean;
  onClose: () => void;
  onBid: (amount: number) => void;
}) {
  const [custom, setCustom] = useState('');

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d0d0f] border-t border-x border-white/[0.08] rounded-t-[24px] p-5">
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl bg-white/5 overflow-hidden shrink-0">
            <img src={auction.item.imageUrl} alt={auction.item.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{auction.item.name}</p>
            <p className="text-white/40 text-xs truncate">{auction.item.description}</p>
          </div>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4 text-center">
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Mise actuelle</p>
          <p className="text-[32px] font-extrabold text-[#a8ff35]">{currentBid.toFixed(2)} €</p>
        </div>

        {ended ? (
          <p className="text-center text-white/50 text-sm py-2 mb-2">Enchère terminée.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {BID_STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => onBid(currentBid + step)}
                  className="py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white font-semibold text-sm hover:bg-[#a8ff35]/15 hover:border-[#a8ff35]/40 hover:text-[#a8ff35] transition-all"
                >
                  +{step}€
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                min={currentBid + 1}
                placeholder={`Montant libre (min ${(currentBid + 1).toFixed(0)}€)`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
              />
              <button
                onClick={() => {
                  const amount = parseFloat(custom);
                  if (amount && amount > currentBid) { onBid(amount); setCustom(''); }
                }}
                disabled={!custom || parseFloat(custom) <= currentBid}
                className="btn-skoleom px-5 rounded-xl text-sm font-bold disabled:opacity-40"
              >
                Enchérir
              </button>
            </div>
          </>
        )}

        <button onClick={onClose} className="w-full py-3 rounded-full border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/10 hover:text-white transition-all">
          Fermer
        </button>
      </div>
    </div>
  );
}

/* ── Single auction card ────────────────────────────────────── */
function AuctionCard({
  auction,
  onVisible,
  setComments,
}: {
  auction: AuctionConfig;
  onVisible: () => void;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(auction.viewers * 0.4));
  const [bidOpen, setBidOpen] = useState(false);
  const [viewers, setViewers] = useState(auction.viewers);
  const [currentBid, setCurrentBid] = useState(auction.startingBid);
  const [highestBidder, setHighestBidder] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(auction.endsInSeconds);
  const cardRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) onVisible(); }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible]);

  useEffect(() => {
    const iv = setInterval(() => setViewers((v) => v + Math.floor(Math.random() * 6 - 2)), 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const iv = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [secondsLeft > 0]);

  const ended = secondsLeft <= 0;

  function placeBid(amount: number) {
    setCurrentBid(amount);
    setHighestBidder('moi');
    setComments((prev) => [...prev.slice(-40), {
      id: idRef.current++ + 8000,
      user: 'moi',
      text: `a enchéri à ${amount.toFixed(0)}€ sur ${auction.item.name}`,
      color: '#a8ff35',
      isBid: true,
    }]);
    setBidOpen(false);
  }

  return (
    <div ref={cardRef} className="h-full w-full shrink-0 flex items-center justify-center bg-[#060608] snap-start">
      <div className="relative h-full overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '100%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${auction.videoId}?autoplay=1&mute=1&loop=1&playlist=${auction.videoId}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1`}
          allow="autoplay; encrypted-media"
          className="w-full h-full border-0"
          title={auction.title}
        />

        <div className="absolute inset-0 z-10" style={{ background: 'transparent' }} />

        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 pt-3 pb-10 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full tracking-wide shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
              <div className="w-5 h-5 rounded-full bg-[#a8ff35] flex items-center justify-center text-[9px] font-bold text-black shrink-0">
                {auction.avatar}
              </div>
              <span className="text-white text-[12px] font-semibold">{auction.creator}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
            <Users size={12} className="text-white/70" />
            <span className="text-white text-[12px] font-semibold">{viewers.toLocaleString('fr-FR')}</span>
          </div>
        </div>

        {/* Bandeau enchère : mise actuelle + compte à rebours */}
        <div className="absolute top-16 left-3 right-3 z-20 flex items-center justify-between bg-black/55 backdrop-blur-sm rounded-2xl px-3.5 py-2.5 pointer-events-none">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider">Mise actuelle</p>
            <p className="text-[#a8ff35] font-extrabold text-[17px] leading-none">{currentBid.toFixed(2)} €</p>
          </div>
          <div className={`flex items-center gap-1.5 text-[13px] font-bold ${ended ? 'text-white/40' : secondsLeft < 30 ? 'text-red-400' : 'text-white'}`}>
            <Timer size={14} />
            {ended ? 'Terminée' : fmtCountdown(secondsLeft)}
          </div>
        </div>

        <div className="absolute bottom-6 right-3 z-20 flex flex-col items-center gap-4 pointer-events-auto">
          <button
            onClick={() => { setLiked((l) => !l); setLikeCount((n) => n + (liked ? -1 : 1)); }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all ${liked ? 'scale-110' : ''}`}>
              <Heart size={22} className={liked ? 'text-red-500 fill-red-500' : 'text-white'} />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow">{likeCount.toLocaleString('fr-FR')}</span>
          </button>

          <button
            onClick={() => setBidOpen(true)}
            disabled={ended}
            className="skoleom-capsule-btn skoleom-capsule-btn--breathe disabled:opacity-50"
          >
            <Gavel size={15} />
            <span>{ended ? 'Terminée' : 'Enchérir'}</span>
          </button>
        </div>

        <div className="absolute bottom-6 left-3 right-16 z-20 pointer-events-none">
          <p className="text-white text-[13px] font-semibold drop-shadow-lg">{auction.title}</p>
          {highestBidder && (
            <p className="text-white/50 text-[11px] mt-0.5">Plus offrant : {highestBidder}</p>
          )}
        </div>
      </div>

      {bidOpen && (
        <BidDrawer
          auction={auction}
          currentBid={currentBid}
          ended={ended}
          onClose={() => setBidOpen(false)}
          onBid={placeBid}
        />
      )}
    </div>
  );
}

/* ── Auction page ───────────────────────────────────────────── */
export default function AuctionPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [commentsByIdx, setCommentsByIdx] = useState<Record<number, Comment[]>>(() =>
    Object.fromEntries(
      AUCTIONS.map((a, i) => [i, a.pool.slice(0, 5).map((c, j) => ({ ...c, id: j, color: COLORS[j % COLORS.length] }))]),
    ),
  );
  const activeAuction = AUCTIONS[activeIdx];

  useEffect(() => {
    const poolIdx: Record<number, number> = Object.fromEntries(AUCTIONS.map((_, i) => [i, 5]));
    const idCounters: Record<number, number> = Object.fromEntries(AUCTIONS.map((_, i) => [i, 500]));
    const iv = setInterval(() => {
      const i = activeIdx;
      const auction = AUCTIONS[i];
      const item = auction.pool[poolIdx[i] % auction.pool.length];
      poolIdx[i]++;
      setCommentsByIdx((prev) => ({
        ...prev,
        [i]: [...(prev[i] || []).slice(-40), { ...item, id: idCounters[i]++, color: COLORS[idCounters[i] % COLORS.length] }],
      }));
    }, 1800);
    return () => clearInterval(iv);
  }, [activeIdx]);

  return (
    <>
      <Head><title>skoleomLive — Enchère</title></Head>
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-scroll scrollbar-hide snap-y snap-mandatory">
            {AUCTIONS.map((auction, i) => (
              <div key={auction.videoId} className="h-full w-full snap-start">
                <AuctionCard
                  auction={auction}
                  onVisible={() => setActiveIdx(i)}
                  setComments={(update) =>
                    setCommentsByIdx((prev) => ({
                      ...prev,
                      [i]: typeof update === 'function' ? (update as (p: Comment[]) => Comment[])(prev[i] || []) : update,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <ChatPanel
            auction={activeAuction}
            viewers={activeAuction.viewers}
            comments={commentsByIdx[activeIdx] || []}
            setComments={(update) =>
              setCommentsByIdx((prev) => ({
                ...prev,
                [activeIdx]: typeof update === 'function' ? (update as (p: Comment[]) => Comment[])(prev[activeIdx] || []) : update,
              }))
            }
          />
        </main>
      </div>
    </>
  );
}
