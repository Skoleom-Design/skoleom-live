import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { Room, RoomEvent, Track } from 'livekit-client';
import { ArrowLeft, Users, Send, Gavel, Timer, Package, Crown, Gift, Wallet, Plus, Trophy } from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { CapsuleDrawer } from '../../client/components/Capsule/CapsuleDrawer';
import { GiftBurstOverlay, type ActiveGiftBurst } from '../../client/components/Live/GiftBurstOverlay';
import { GIFTS, COIN_PACKS, giftById, type GiftDef } from '../../client/constants/gifts';
import { api, ApiError, getToken, getStoredUser } from '../../shared/api/http';
import type { Capsule } from '../../shared/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const BID_STEPS = [5, 10, 20];

interface LiveSession {
  id: string;
  title?: string;
  status: 'live' | 'ended';
  startedAt: string;
  mode: 'live' | 'auction';
  auctionCapsule?: Capsule;
  startingBid?: number;
  currentBid?: number;
  currentBidderId?: string;
  currentBidder?: { username: string; displayName?: string };
  auctionEndsAt?: string;
  auctionSettled?: boolean;
  auctionActive?: boolean;
  featuredCapsuleId?: string | null;
  featuredCapsule?: Capsule | null;
  creator: { id: string; username: string; displayName?: string; avatarUrl?: string };
}

interface LiveComment {
  id: string;
  text: string;
  userId: string;
  username: string;
  createdAt: string;
  isBid?: boolean;
  isGift?: boolean;
  giftImage?: string;
}

interface TopDonor {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  totalAmount: number;
}

function fmtCountdown(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0');
  const s = Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LiveViewerPage() {
  const router = useRouter();
  const { id } = router.query;
  const socketRef = useRef<Socket | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const audioElRef = useRef<HTMLAudioElement>(null);
  const myId = getStoredUser()?.id;

  const [live, setLive] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [videoConnected, setVideoConnected] = useState(false);

  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentInput, setCommentInput] = useState('');

  const [roundActive, setRoundActive] = useState(false);
  const [activeCapsule, setActiveCapsule] = useState<Capsule | undefined>(undefined);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentBidderName, setCurrentBidderName] = useState<string | null>(null);
  const [auctionEndsAt, setAuctionEndsAt] = useState<string | null>(null);
  const [auctionSecondsLeft, setAuctionSecondsLeft] = useState(0);
  const [auctionResult, setAuctionResult] = useState<{ winnerId: string | null; amount: number | null } | null>(null);
  const [bidOpen, setBidOpen] = useState(false);
  const [bidCustom, setBidCustom] = useState('');
  const [bidError, setBidError] = useState('');
  const [capsuleDrawerOpen, setCapsuleDrawerOpen] = useState(false);

  const [sidebarTab, setSidebarTab] = useState<'chat' | 'gifts'>('chat');
  const [coins, setCoins] = useState(0);
  const [sentGift, setSentGift] = useState<string | null>(null);
  const [giftError, setGiftError] = useState('');
  const [showRecharge, setShowRecharge] = useState(false);

  // Cadeaux qui "explosent" au-dessus de la video (visibles par tout le monde, pas seulement
  // dans le chat) — chaque item se retire automatiquement apres son animation.
  const [screenGifts, setScreenGifts] = useState<ActiveGiftBurst[]>([]);
  const screenGiftTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [topDonorsOpen, setTopDonorsOpen] = useState(false);

  // Le solde de coins reflete le vrai wallet (walletBalance, 100 coins = 1€).
  useEffect(() => {
    if (!getToken()) return;
    api.get<{ walletBalance: number }>('/auth/me')
      .then((me) => setCoins(Math.round(Number(me.walletBalance ?? 0) * 100)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!router.isReady || typeof id !== 'string') return;
    api.get<LiveSession>(`/lives/${id}`)
      .then((session) => {
        setLive(session);
        if (session.mode === 'auction' && session.auctionActive) {
          setRoundActive(true);
          setActiveCapsule(session.auctionCapsule);
          setCurrentBid(Number(session.currentBid ?? session.startingBid ?? 0));
          setCurrentBidderName(session.currentBidder?.displayName || session.currentBidder?.username || null);
          setAuctionEndsAt(session.auctionEndsAt ?? null);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [router.isReady, id]);

  // Classement des plus gros donateurs de ce live — recharge a l'arrivee, puis periodiquement
  // (et juste apres reception d'un cadeau, voir listener 'giftSent' ci-dessous).
  function fetchTopDonors(liveId: string) {
    api.get<TopDonor[]>(`/lives/${liveId}/top-donors`).then(setTopDonors).catch(() => {});
  }

  useEffect(() => {
    if (!live?.id) return;
    fetchTopDonors(live.id);
    const timer = setInterval(() => fetchTopDonors(live.id), 20000);
    return () => clearInterval(timer);
  }, [live?.id]);

  // Depend uniquement de live?.id (pas de `live` en entier) : mettre a jour live.featuredCapsule
  // (file de vente) ne doit pas fermer/rouvrir la connexion.
  useEffect(() => {
    if (!live || typeof id !== 'string') return;

    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join', { liveId: id });
    socket.on('viewerCount', (d: { count: number }) => setViewerCount(d.count));
    socket.on('history', (h: LiveComment[]) => setComments(h));
    socket.on('comment', (c: LiveComment) => setComments((prev) => [...prev, c]));
    socket.on('commentDeleted', (d: { commentId: string }) => {
      setComments((prev) => prev.filter((c) => c.id !== d.commentId));
    });
    socket.on('bidUpdate', (d: { currentBid: number; currentBidderId: string; currentBidderName?: string; auctionEndsAt: string }) => {
      setCurrentBid(d.currentBid);
      setCurrentBidderName(d.currentBidderName || null);
      setAuctionEndsAt(d.auctionEndsAt);
      setBidOpen(false);
      setComments((prev) => [...prev, {
        id: `bid-${Date.now()}`,
        text: `a enchéri à ${d.currentBid.toFixed(2)}€`,
        userId: d.currentBidderId,
        username: d.currentBidderName || 'Un spectateur',
        createdAt: new Date().toISOString(),
        isBid: true,
      }]);
    });
    socket.on('bidError', (d: { message: string }) => setBidError(d.message));
    socket.on('auctionStarted', (d: { capsule: Capsule; startingBid: number; currentBid: number; auctionEndsAt: string }) => {
      setRoundActive(true);
      setActiveCapsule(d.capsule);
      setCurrentBid(d.currentBid);
      setCurrentBidderName(null);
      setAuctionEndsAt(d.auctionEndsAt);
      setAuctionResult(null);
      setBidOpen(false);
    });
    socket.on('auctionEnded', (d: { winnerId: string | null; amount: number | null }) => {
      setRoundActive(false);
      setAuctionResult(d);
    });
    socket.on('featuredCapsuleChanged', (d: { capsuleId: string | null; capsule: Capsule | null }) => {
      setLive((prev) => (prev ? { ...prev, featuredCapsuleId: d.capsuleId, featuredCapsule: d.capsule } : prev));
    });
    socket.on('giftSent', (d: { giftType: string; username: string; displayName?: string }) => {
      const gift = giftById(d.giftType);
      if (!gift) return;
      const username = d.displayName || d.username;

      setComments((prev) => [...prev, {
        id: `gift-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: `a envoyé ${gift.name}`,
        userId: '',
        username,
        createdAt: new Date().toISOString(),
        isGift: true,
        giftImage: gift.image3d,
      }]);

      const burstId = `burst-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setScreenGifts((prev) => [...prev, { id: burstId, gift, username }]);
      screenGiftTimeouts.current.push(
        setTimeout(() => setScreenGifts((prev) => prev.filter((g) => g.id !== burstId)), 3200),
      );

      if (typeof id === 'string') fetchTopDonors(id);
    });

    return () => {
      socket.emit('leave', { liveId: id });
      socket.close();
      socketRef.current = null;
      screenGiftTimeouts.current.forEach(clearTimeout);
      screenGiftTimeouts.current = [];
    };
  }, [live?.id, id]);

  // Reception de la video en direct (LiveKit) — se connecte a la room en lecture seule et
  // affiche le flux du createur des qu'il est publie. Si LiveKit n'est pas configure cote
  // serveur, ou si le createur n'a pas encore publie, le placeholder texte reste affiche.
  useEffect(() => {
    if (!live || typeof id !== 'string' || !getToken()) return;

    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      try {
        const { token, url } = await api.get<{ token: string; url: string }>(`/lives/${id}/livekit-token`);
        if (cancelled) return;
        room = new Room();
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoElRef.current) {
            track.attach(videoElRef.current);
            setVideoConnected(true);
          } else if (track.kind === Track.Kind.Audio && audioElRef.current) {
            track.attach(audioElRef.current);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
          if (track.kind === Track.Kind.Video) setVideoConnected(false);
        });
        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        roomRef.current = room;
      } catch {
        // Diffusion video indisponible — le placeholder reste affiche, le reste (chat/encheres)
        // continue de fonctionner normalement.
      }
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
      if (roomRef.current === room) roomRef.current = null;
      setVideoConnected(false);
    };
  }, [live?.id, id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    if (!live || live.mode !== 'auction' || !auctionEndsAt) return;
    const tick = () => setAuctionSecondsLeft((new Date(auctionEndsAt).getTime() - Date.now()) / 1000);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [live?.mode, auctionEndsAt]);

  function sendComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text || !live || !socketRef.current) return;
    if (!getToken()) { router.push('/auth/login'); return; }
    socketRef.current.emit('comment', { liveId: live.id, text, token: getToken() });
    setCommentInput('');
  }

  function placeBid(amount: number) {
    if (!getToken()) { router.push('/auth/login'); return; }
    if (!live || !socketRef.current) return;
    setBidError('');
    socketRef.current.emit('placeBid', { liveId: live.id, amount, token: getToken() });
  }

  // Debite reellement le wallet et credite le createur (50% de la valeur) — a la difference de
  // /lives/gift/demo utilise sur la page vitrine, ce live est reel : le cadeau part au vrai
  // createur, et le serveur diffuse l'evenement 'giftSent' a tout le monde (voir listener ci-dessus).
  async function sendRealGift(gift: GiftDef) {
    if (!getToken()) { router.push('/auth/login'); return; }
    if (!live) return;
    if (coins < gift.coins) { setShowRecharge(true); return; }
    setGiftError('');
    try {
      const res = await api.post<{ walletBalance: number }>(`/lives/${live.id}/gift`, { giftType: gift.id });
      setCoins(Math.round(Number(res.walletBalance) * 100));
      setSentGift(gift.id);
      setTimeout(() => setSentGift(null), 1200);
      setSidebarTab('chat');
    } catch (err) {
      setGiftError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi du cadeau.");
    }
  }

  async function buyCoins(pack: { coins: number; eur: string }) {
    const amount = parseFloat(pack.eur.replace('€', '').replace(',', '.'));
    try {
      const res = await api.post<{ walletBalance: number }>('/payments/wallet/topup', { amount });
      setCoins(Math.round(Number(res.walletBalance) * 100));
    } catch {
      // Erreur reseau/auth — le solde reel n'a pas bouge, on ne change rien localement.
    }
    setShowRecharge(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center text-white/40 text-sm">Chargement…</main>
      </div>
    );
  }

  if (notFound || !live) {
    return (
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-white/50 text-sm">
          <p>Ce live est introuvable ou déjà terminé.</p>
          <Link href="/live" className="text-[#a8ff35] underline">Retour aux lives</Link>
        </main>
      </div>
    );
  }

  const isAuction = live.mode === 'auction';
  const sessionEnded = live.status === 'ended';
  const minNextBid = currentBid + 1;

  return (
    <>
      <Head><title>{live.title || 'Live'} — skoleomLive</title></Head>
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4 shrink-0">
            <Link href="/live" className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors">
              <ArrowLeft size={16} className="text-white/70" />
            </Link>
            <span className="text-white font-bold text-sm">{live.title || (isAuction ? 'Enchère' : 'Live')}</span>
            <div className="ml-auto flex items-center gap-2 text-white/60 text-xs font-semibold">
              <Users size={13} /> {viewerCount}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden px-4 pb-6 gap-4">
            <div className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-hide">
              <div className="w-full max-w-md">
                <div className="relative w-full aspect-[9/16] max-h-[65vh] mx-auto rounded-2xl overflow-hidden bg-black border border-white/[0.08] flex items-center justify-center">
                  {/* Toujours monte (meme avant connexion) — sinon l'attach() de la track video
                      arrive avant le montage de l'element et se perd silencieusement. */}
                  <video
                    ref={videoElRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 w-full h-full object-cover ${videoConnected ? '' : 'hidden'}`}
                  />
                  <audio ref={audioElRef} autoPlay className="hidden" />

                  {!videoConnected && (
                    isAuction && roundActive && activeCapsule?.imageUrl ? (
                      <img src={activeCapsule.imageUrl} alt={activeCapsule.name} className="w-full h-full object-cover opacity-60" />
                    ) : (
                      <Package size={40} className="text-white/15" />
                    )
                  )}

                  {!videoConnected && (
                    <div className="absolute inset-0 flex items-center justify-center px-6 text-center pointer-events-none">
                      <p className="text-white/35 text-xs leading-relaxed">
                        En attente de la vidéo du créateur — le chat
                        {isAuction ? ' et les enchères fonctionnent' : ' fonctionne'} en temps réel.
                      </p>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {sessionEnded ? 'TERMINÉ' : 'LIVE'}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <div className="w-5 h-5 rounded-full bg-[#a8ff35] flex items-center justify-center text-[9px] font-bold text-black shrink-0">
                      {(live.creator.displayName || live.creator.username)[0]?.toUpperCase()}
                    </div>
                    <span className="text-white text-[12px] font-semibold">{live.creator.username}</span>
                  </div>

                  {isAuction && roundActive && (
                    <div className="absolute top-14 left-3 right-3 flex items-center justify-between bg-black/55 backdrop-blur-sm rounded-2xl px-3.5 py-2.5">
                      <div>
                        <p className="text-white/50 text-[10px] uppercase tracking-wider">Mise actuelle</p>
                        <p className="text-[#a8ff35] font-extrabold text-[17px] leading-none">{currentBid.toFixed(2)} €</p>
                      </div>
                      <div className={`flex items-center gap-1.5 text-[13px] font-bold ${auctionSecondsLeft < 30 ? 'text-red-400' : 'text-white'}`}>
                        <Timer size={14} />
                        {fmtCountdown(auctionSecondsLeft)}
                      </div>
                    </div>
                  )}

                  {isAuction && roundActive && (
                    <div className="absolute bottom-3 inset-x-0 flex flex-col items-center gap-1 px-4">
                      <button
                        onClick={() => setBidOpen(true)}
                        disabled={sessionEnded || live.creator.id === myId}
                        className="skoleom-capsule-btn skoleom-capsule-btn--breathe disabled:opacity-50"
                      >
                        <Gavel size={15} />
                        <span>Enchérir</span>
                      </button>
                      {live.creator.id === myId && (
                        <p className="text-white/30 text-[10px]">C&apos;est ta propre enchère</p>
                      )}
                    </div>
                  )}

                  {isAuction && !roundActive && !sessionEnded && (
                    <div className="absolute bottom-3 inset-x-0 flex justify-center px-4">
                      <p className="bg-black/55 backdrop-blur-sm text-white/50 text-xs px-4 py-2 rounded-full">
                        En attente du lancement d&apos;une enchère par {live.creator.username}…
                      </p>
                    </div>
                  )}

                  {/* Produit "en vente maintenant" — file de vente façon Whatnot, pilotée par le
                      créateur depuis son studio et diffusée en temps réel via websocket. */}
                  {!isAuction && live.featuredCapsule && (
                    <div className="absolute bottom-3 inset-x-0 flex justify-center px-4">
                      <button
                        onClick={() => setCapsuleDrawerOpen(true)}
                        className="skoleom-capsule-btn skoleom-capsule-btn--breathe"
                      >
                        <img src="/skoleom-mark.png" alt="Skoleom" className="skoleom-capsule-btn-logo" />
                        <span>{live.featuredCapsule.name} · {live.featuredCapsule.price.toFixed(2)} €</span>
                      </button>
                    </div>
                  )}

                  <GiftBurstOverlay items={screenGifts} />
                </div>

                {isAuction && roundActive && (
                  <div className="mt-4 space-y-1 text-center">
                    <p className="text-white text-sm font-semibold">{activeCapsule?.name}</p>
                    {currentBidderName && (
                      <p className="text-white/40 text-xs">Plus offrant : <span className="text-[#a8ff35] font-semibold">{currentBidderName}</span></p>
                    )}
                  </div>
                )}

                {isAuction && auctionResult && (
                  <div className="mt-4 space-y-1 text-center">
                    <p className={`text-sm font-semibold ${auctionResult.winnerId ? 'text-[#a8ff35]' : 'text-white/40'}`}>
                      {auctionResult.winnerId === myId
                        ? `Tu as remporté l'enchère à ${auctionResult.amount?.toFixed(2)} € 🎉`
                        : auctionResult.winnerId
                        ? `Remportée à ${auctionResult.amount?.toFixed(2)} €`
                        : 'Terminée sans mise.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-[300px] shrink-0 flex flex-col gap-2">
              <button
                onClick={() => setTopDonorsOpen((o) => !o)}
                className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#f59e0b]/20 via-[#f59e0b]/10 to-transparent border border-[#f59e0b]/30 hover:border-[#f59e0b]/50 transition-all text-left"
              >
                <span className="w-8 h-8 rounded-full bg-[#f59e0b]/20 flex items-center justify-center shrink-0">
                  <Trophy size={15} className="text-[#f59e0b]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#f59e0b]/80">Top donateur</span>
                  <span className="block text-[13px] font-semibold text-white truncate">
                    {topDonors[0] ? `👑 ${topDonors[0].displayName || topDonors[0].username}` : 'Sois le premier !'}
                  </span>
                </span>
              </button>

              {topDonorsOpen && (
                <div className="shrink-0 bg-[#0d0d0f] border border-[#f59e0b]/25 rounded-2xl p-3 max-h-64 overflow-y-auto scrollbar-hide">
                  {topDonors.length === 0 ? (
                    <p className="text-white/30 text-xs text-center py-4">Aucun cadeau envoyé pour l&apos;instant — sois le premier à soutenir {live.creator.username} !</p>
                  ) : (
                    <div className="space-y-1.5">
                      {topDonors.map((donor, i) => (
                        <div key={donor.userId} className="flex items-center gap-2.5 px-1 py-1">
                          <span className="w-5 text-center text-[13px] font-bold text-white/40 shrink-0">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </span>
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold text-white/60">
                            {donor.avatarUrl ? (
                              <img src={donor.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (donor.displayName || donor.username)[0]?.toUpperCase()
                            )}
                          </div>
                          <span className="flex-1 min-w-0 text-[13px] text-white truncate">{donor.displayName || donor.username}</span>
                          <span className="text-[12px] font-bold text-[#f59e0b] shrink-0">{donor.totalAmount.toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 flex flex-col bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="flex shrink-0 border-b border-white/[0.06]">
                <button
                  onClick={() => setSidebarTab('chat')}
                  className={`flex-1 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    sidebarTab === 'chat' ? 'border-[#a8ff35] text-white' : 'border-transparent text-white/35 hover:text-white/60'
                  }`}
                >
                  Commentaires
                </button>
                <button
                  onClick={() => setSidebarTab('gifts')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    sidebarTab === 'gifts' ? 'bg-[#f59e0b]/[0.16] border-[#f59e0b] text-[#f59e0b]' : 'bg-[#f59e0b]/[0.06] border-transparent text-[#f59e0b]/70 hover:bg-[#f59e0b]/[0.1]'
                  }`}
                >
                  <Gift size={12} /> Cadeaux
                </button>
              </div>

              {sidebarTab === 'chat' ? (
                <>
                  <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3 space-y-2.5">
                    {comments.length === 0 && (
                      <p className="text-white/25 text-xs text-center mt-4">Aucun commentaire pour l&apos;instant.</p>
                    )}
                    {comments.map((c) => {
                      const isHost = c.userId === live.creator.id;
                      if (c.isGift) {
                        return (
                          <div key={c.id} className="flex items-center gap-2 text-[13px] leading-snug bg-white/[0.03] rounded-xl px-2 py-1.5">
                            {c.giftImage && <img src={c.giftImage} alt="" className="w-6 h-6 object-contain shrink-0" />}
                            <p className="min-w-0">
                              <span className="font-semibold mr-1 text-[#f59e0b]">{c.username}</span>
                              <span className="text-[#f59e0b]/80 break-words font-medium">{c.text}</span>
                            </p>
                          </div>
                        );
                      }
                      if (c.isBid) {
                        return (
                          <div key={c.id} className="flex items-center gap-2 text-[13px] leading-snug bg-white/[0.03] rounded-xl px-2 py-1.5">
                            <span className="w-5 h-5 rounded-full bg-[#a8ff35]/15 flex items-center justify-center shrink-0">
                              <Gavel size={11} className="text-[#a8ff35]" />
                            </span>
                            <p className="min-w-0">
                              <span className="font-semibold mr-1 text-[#a8ff35]">{c.username}</span>
                              <span className="text-[#a8ff35]/80 break-words font-medium">{c.text}</span>
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div key={c.id} className="text-[13px] leading-snug">
                          <span className={`font-semibold mr-1 ${isHost ? 'text-[#f59e0b]' : 'text-[#a8ff35]'}`}>{c.username}</span>
                          {isHost && <Crown size={11} className="inline text-[#f59e0b] mr-1 -translate-y-px" />}
                          <span className="text-white/80 break-words">{c.text}</span>
                        </div>
                      );
                    })}
                    <div ref={commentsEndRef} />
                  </div>
                  <form onSubmit={sendComment} className="p-3 border-t border-white/[0.06] flex items-center gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Commenter…"
                      className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-3.5 py-2 text-white placeholder:text-white/25 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 transition-all"
                    />
                    <button type="submit" className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center shrink-0 transition-all">
                      <Send size={14} className="text-[#a8ff35]" />
                    </button>
                  </form>
                </>
              ) : (
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
                    <button
                      onClick={() => setShowRecharge((r) => !r)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/35 text-[#f59e0b] text-[12px] font-bold hover:bg-[#f59e0b]/25 transition-colors"
                    >
                      <Plus size={12} /> Recharger
                    </button>
                  </div>

                  {showRecharge && (
                    <div className="px-3 py-3 border-b border-white/[0.06] shrink-0">
                      <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-wide mb-2">Packs de coins</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {COIN_PACKS.map((pack) => (
                          <button
                            key={pack.coins}
                            onClick={() => buyCoins(pack)}
                            className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl hover:border-[#f59e0b]/50 hover:bg-[#f59e0b]/[0.08] transition-all"
                          >
                            <span className="text-[13px] font-bold text-white">{pack.coins} 🪙</span>
                            <span className="text-[12px] font-semibold text-[#f59e0b]">{pack.eur}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-2 shrink-0">
                    <p className="text-[11px] text-white/35">
                      Envoie un cadeau à <span className="text-white/60 font-semibold">{live.creator.username}</span> — il reçoit 50% de la valeur.
                    </p>
                  </div>

                  {giftError && (
                    <p className="mx-4 mb-2 text-red-400 text-[11px] bg-red-400/10 px-3 py-2 rounded-xl border border-red-400/20">{giftError}</p>
                  )}

                  <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
                    <div className="grid grid-cols-2 gap-2">
                      {GIFTS.map((gift) => {
                        const canAfford = coins >= gift.coins;
                        const wasSent = sentGift === gift.id;
                        return (
                          <button
                            key={gift.id}
                            onClick={() => sendRealGift(gift)}
                            className={`relative flex flex-col items-center gap-1.5 rounded-[16px] p-3 border transition-all ${
                              wasSent
                                ? 'scale-95 bg-white/[0.12] border-white/30'
                                : canAfford
                                ? 'bg-white/[0.04] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.08] active:scale-95'
                                : 'bg-white/[0.02] border-white/[0.04] opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <img src={gift.image3d} alt={gift.name} className="w-10 h-10 object-contain" />
                            <p className="text-[11px] font-bold text-white">{gift.name}</p>
                            <span className="text-[10px] font-semibold text-[#f59e0b]">{gift.coins} 🪙</span>
                            <p className="text-[9px] text-white/30">{gift.eur}</p>
                            {wasSent && (
                              <div className="absolute inset-0 rounded-[16px] flex items-center justify-center bg-black/40">
                                <span className="text-[20px]">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {bidOpen && isAuction && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0d0d0f] border-t border-x border-white/[0.08] rounded-t-[24px] p-5">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-white/5 overflow-hidden shrink-0">
                {activeCapsule?.imageUrl && (
                  <img src={activeCapsule.imageUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{activeCapsule?.name}</p>
                <p className="text-white/40 text-xs truncate">{activeCapsule?.description}</p>
              </div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4 text-center">
              <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Mise actuelle</p>
              <p className="text-[32px] font-extrabold text-[#a8ff35]">{currentBid.toFixed(2)} €</p>
            </div>

            {bidError && (
              <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20 mb-3">{bidError}</p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-3">
              {BID_STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => placeBid(currentBid + step)}
                  className="py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white font-semibold text-sm hover:bg-[#a8ff35]/15 hover:border-[#a8ff35]/40 hover:text-[#a8ff35] transition-all"
                >
                  +{step}€
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                min={minNextBid}
                placeholder={`Montant libre (min ${minNextBid.toFixed(0)}€)`}
                value={bidCustom}
                onChange={(e) => setBidCustom(e.target.value)}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
              />
              <button
                onClick={() => {
                  const amount = parseFloat(bidCustom);
                  if (amount && amount > currentBid) { placeBid(amount); setBidCustom(''); }
                }}
                disabled={!bidCustom || parseFloat(bidCustom) <= currentBid}
                className="btn-skoleom px-5 rounded-xl text-sm font-bold disabled:opacity-40"
              >
                Enchérir
              </button>
            </div>

            <button onClick={() => setBidOpen(false)} className="w-full py-3 rounded-full border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/10 hover:text-white transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      {live.featuredCapsule && (
        <CapsuleDrawer
          capsules={[live.featuredCapsule]}
          open={capsuleDrawerOpen}
          onClose={() => setCapsuleDrawerOpen(false)}
        />
      )}
    </>
  );
}
