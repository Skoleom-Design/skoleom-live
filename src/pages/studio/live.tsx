import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { Room, Track } from 'livekit-client';
import {
  ArrowLeft, Mic, MicOff, Video, VideoOff, Radio, Loader2, Send, Users, Package, X, ShoppingBag,
  Crown, Trash2, UserX, Gavel, Timer,
} from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { CapsuleDrawer } from '../../client/components/Capsule/CapsuleDrawer';
import { api, ApiError, getToken, getStoredUser } from '../../shared/api/http';
import type { Capsule } from '../../shared/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type LiveMode = 'live' | 'auction';

interface LiveSession {
  id: string;
  title?: string;
  startedAt: string;
  capsules?: Capsule[];
  mode?: LiveMode;
  auctionCapsuleId?: string;
  auctionCapsule?: Capsule;
  startingBid?: number;
  currentBid?: number;
  currentBidderId?: string;
  currentBidder?: { username: string; displayName?: string };
  auctionEndsAt?: string;
  auctionSettled?: boolean;
  auctionActive?: boolean;
}

interface LiveComment {
  id: string;
  text: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  isBid?: boolean;
}

const DURATION_OPTIONS = [2, 5, 10, 30];

function fmtElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtCountdown(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0');
  const s = Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StudioLivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  // Incremente a chaque requestMedia() — permet a une requete getUserMedia en cours de se
  // reconnaitre perimee (ex: StrictMode qui monte/demonte/remonte l'effet en dev) et de liberer
  // immediatement le flux obtenu au lieu de le laisser fuiter et verrouiller la camera.
  const mediaRequestIdRef = useRef(0);
  const roomRef = useRef<Room | null>(null);
  const publishedLiveIdRef = useRef<string | null>(null);
  const myId = getStoredUser()?.id;

  const [mediaError, setMediaError] = useState('');
  const [mediaReady, setMediaReady] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [ending, setEnding] = useState(false);
  const [live, setLive] = useState<LiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sales, setSales] = useState({ count: 0, revenue: 0 });

  const [myCapsules, setMyCapsules] = useState<Capsule[]>([]);
  const [featuredCapsule, setFeaturedCapsule] = useState<Capsule | null>(null);
  const [capsulePickerOpen, setCapsulePickerOpen] = useState(false);
  const [capsuleDrawerOpen, setCapsuleDrawerOpen] = useState(false);

  const [mode, setMode] = useState<LiveMode>('live');

  // Le bouton "Enchere" du Studio renvoie ici avec ?mode=auction pour pre-selectionner le mode.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.mode === 'auction') setMode('auction');
  }, [router.isReady, router.query.mode]);

  // Lancement d'une manche d'enchere — choisi en plein direct, capsule par capsule.
  const [auctionCapsuleId, setAuctionCapsuleId] = useState('');
  const [startingBidInput, setStartingBidInput] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');

  // Etat de la manche d'enchere en cours — mis a jour en temps reel via les evenements socket.
  const [roundActive, setRoundActive] = useState(false);
  const [activeAuctionCapsule, setActiveAuctionCapsule] = useState<Capsule | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentBidderName, setCurrentBidderName] = useState<string | null>(null);
  const [auctionEndsAt, setAuctionEndsAt] = useState<string | null>(null);
  const [auctionSecondsLeft, setAuctionSecondsLeft] = useState(0);
  const [auctionResult, setAuctionResult] = useState<{ winnerId: string | null; amount: number | null } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth/login');
      return;
    }
    if (getStoredUser()?.role === 'admin') {
      router.replace('/admin');
      return;
    }

    // Reporte l'appel getUserMedia d'un tick : le double-montage StrictMode (mount -> cleanup ->
    // remount) est entierement synchrone, donc le cleanup du premier montage "jetable" annule ce
    // timeout avant qu'il ne se declenche — une seule requete camera part reellement par ouverture,
    // au lieu de deux requetes concurrentes qui se disputent le meme peripherique (NotReadableError).
    const mediaKickoffId = setTimeout(() => requestMedia(), 0);

    api.get<Capsule[]>('/capsules/mine').then(setMyCapsules).catch(() => {});

    api.get<LiveSession | null>('/lives/mine').then((existing) => {
      if (!existing) return;
      setLive(existing);
      setFeaturedCapsule(existing.capsules?.[0] ?? null);
      if (existing.mode === 'auction' && existing.auctionActive) {
        setRoundActive(true);
        setActiveAuctionCapsule(existing.auctionCapsule ?? null);
        setCurrentBid(Number(existing.currentBid ?? existing.startingBid ?? 0));
        setCurrentBidderName(existing.currentBidder?.displayName || existing.currentBidder?.username || null);
        setAuctionEndsAt(existing.auctionEndsAt ?? null);
      }
    }).catch(() => {});

    return () => {
      clearTimeout(mediaKickoffId);
      // Invalide toute requete getUserMedia en cours pour cet effet.
      mediaRequestIdRef.current += 1;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  function requestMedia(retriesLeft = 2) {
    setMediaError('');
    setMediaReady(false);

    // Un flux precedent encore ouvert (ex: double-clic sur Reessayer) doit etre libere
    // avant d'en demander un nouveau, sinon la camera reste verrouillee par nous-memes.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError(
        "Ton navigateur ne supporte pas l'accès à la caméra ici — vérifie que la page est bien chargée en HTTPS (ou localhost) et que tu n'es pas en navigation privée restreinte.",
      );
      return;
    }

    const requestId = ++mediaRequestIdRef.current;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (mediaRequestIdRef.current !== requestId) {
          // Cette requete a ete supplantee (nouvel effet StrictMode, ou nouveau Reessayer) —
          // on libere immediatement ce flux au lieu de le laisser fuiter et verrouiller la camera.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setMediaReady(true);
      })
      .catch((err) => {
        if (mediaRequestIdRef.current !== requestId) return;
        const name = err instanceof DOMException ? err.name : '';

        // NotReadableError/TrackStartError sont très souvent transitoires : le navigateur (surtout
        // en double-montage StrictMode, ou juste après la fermeture d'un autre onglet/app) peut
        // encore être en train de libérer le handle caméra côté OS au moment où on redemande —
        // ça n'a rien à voir avec une vraie appli tierce qui l'utilise. Un court retry silencieux
        // résout la grande majorité des cas avant d'afficher une erreur à l'utilisateur.
        if ((name === 'NotReadableError' || name === 'TrackStartError') && retriesLeft > 0) {
          setTimeout(() => {
            if (mediaRequestIdRef.current === requestId) requestMedia(retriesLeft - 1);
          }, 500);
          return;
        }

        const messages: Record<string, string> = {
          NotAllowedError: "Accès à la caméra/micro refusé. Clique sur l'icône cadenas (ou caméra barrée) dans la barre d'adresse de ton navigateur, autorise la caméra et le micro pour ce site, puis réessaie.",
          PermissionDeniedError: "Accès à la caméra/micro refusé. Clique sur l'icône cadenas (ou caméra barrée) dans la barre d'adresse de ton navigateur, autorise la caméra et le micro pour ce site, puis réessaie.",
          NotFoundError: "Aucune caméra ou aucun micro détecté sur cet appareil.",
          DevicesNotFoundError: "Aucune caméra ou aucun micro détecté sur cet appareil.",
          NotReadableError: "Ta caméra ou ton micro est déjà utilisé par une autre application (Zoom, Teams, un autre onglet...). Ferme-la puis réessaie.",
          TrackStartError: "Ta caméra ou ton micro est déjà utilisé par une autre application (Zoom, Teams, un autre onglet...). Ferme-la puis réessaie.",
          OverconstrainedError: "Aucune caméra ne correspond aux paramètres demandés.",
          SecurityError: "L'accès à la caméra nécessite une connexion sécurisée (HTTPS) ou localhost.",
          NotSupportedError: "Ton navigateur bloque l'accès à la caméra/micro dans ce contexte (permissions système désactivées, ou site ouvert dans un navigateur intégré type app/webview). Vérifie les autorisations caméra/micro de ton navigateur au niveau du système d'exploitation.",
        };
        setMediaError(
          messages[name] || "Impossible d'accéder à la caméra/micro — vérifie les permissions de ton navigateur.",
        );
      });
  }

  useEffect(() => {
    if (!live) return;
    const startedAt = new Date(live.startedAt).getTime();
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [live]);

  // Connexion WebSocket pour le chat + compteur de spectateurs, une fois le live demarre.
  useEffect(() => {
    if (!live) return;

    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join', { liveId: live.id });
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
      setComments((prev) => [...prev, {
        id: `bid-${Date.now()}`,
        text: `a enchéri à ${d.currentBid.toFixed(2)}€`,
        userId: d.currentBidderId,
        username: d.currentBidderName || 'Un spectateur',
        createdAt: new Date().toISOString(),
        isBid: true,
      }]);
    });
    socket.on('auctionStarted', (d: { capsule: Capsule; startingBid: number; currentBid: number; auctionEndsAt: string }) => {
      setRoundActive(true);
      setActiveAuctionCapsule(d.capsule);
      setCurrentBid(d.currentBid);
      setCurrentBidderName(null);
      setAuctionEndsAt(d.auctionEndsAt);
      setAuctionResult(null);
    });
    socket.on('auctionEnded', (d: { winnerId: string | null; amount: number | null }) => {
      setRoundActive(false);
      setAuctionResult(d);
    });

    return () => {
      socket.emit('leave', { liveId: live.id });
      socket.close();
      socketRef.current = null;
    };
  }, [live]);

  // Diffusion video reelle vers les spectateurs (LiveKit) — publie le flux camera/micro deja
  // obtenu pour l'apercu local, une fois le live demarre. Si LiveKit n'est pas configure cote
  // serveur (pas de compte/cles), l'appel echoue silencieusement : le live continue quand meme
  // (chat/encheres fonctionnent), seule la video ne part pas vers les spectateurs.
  useEffect(() => {
    if (!live || !mediaReady || !streamRef.current) return;
    if (publishedLiveIdRef.current === live.id) return;
    publishedLiveIdRef.current = live.id;

    let cancelled = false;
    (async () => {
      try {
        const { token, url } = await api.get<{ token: string; url: string }>(`/lives/${live.id}/livekit-token`);
        if (cancelled) return;
        const room = new Room();
        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        roomRef.current = room;
        const videoTrack = streamRef.current?.getVideoTracks()[0];
        const audioTrack = streamRef.current?.getAudioTracks()[0];
        if (videoTrack) await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
        if (audioTrack) await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
      } catch {
        // Diffusion video indisponible — voir commentaire ci-dessus.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [live, mediaReady]);

  // Compte a rebours de l'enchere — recalcule chaque seconde a partir de auctionEndsAt (mis a
  // jour par les evenements bidUpdate en cas de prolongation anti-sniping).
  useEffect(() => {
    if (!live || live.mode !== 'auction' || !auctionEndsAt) return;
    const tick = () => setAuctionSecondsLeft((new Date(auctionEndsAt).getTime() - Date.now()) / 1000);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [live, auctionEndsAt]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Ventes en direct — recalculees toutes les 5s.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    function poll() {
      api.get<{ count: number; revenue: number }>(`/lives/${live!.id}/sales`)
        .then((s) => { if (!cancelled) setSales(s); })
        .catch(() => {});
    }
    poll();
    const timer = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [live]);

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  async function handleStart() {
    setStarting(true);
    setStartError('');
    try {
      const session = await api.post<LiveSession>('/lives', {
        title: title.trim() || undefined,
        mode: mode === 'auction' ? 'auction' : undefined,
      });
      setLive(session);
      setElapsed(0);
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setStarting(false);
    }
  }

  async function handleLaunchAuction() {
    if (!live) return;
    if (!auctionCapsuleId) {
      setLaunchError('Choisis un produit à mettre aux enchères.');
      return;
    }
    const startingBid = parseFloat(startingBidInput);
    if (!startingBid || startingBid < 1) {
      setLaunchError("La mise de départ doit être d'au moins 1€.");
      return;
    }

    setLaunching(true);
    setLaunchError('');
    try {
      await api.post(`/lives/${live.id}/auction`, {
        capsuleId: auctionCapsuleId,
        startingBid,
        durationSeconds: durationMinutes * 60,
      });
      // roundActive/activeAuctionCapsule sont mis a jour via l'evenement socket 'auctionStarted'
      // (broadcast a tous les spectateurs, y compris ce createur qui a rejoint sa propre room).
      setAuctionCapsuleId('');
      setStartingBidInput('');
    } catch (err) {
      setLaunchError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLaunching(false);
    }
  }

  async function handleEnd() {
    if (!live) return;
    setEnding(true);
    try {
      await api.patch(`/lives/${live.id}/end`);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      roomRef.current?.disconnect();
      roomRef.current = null;
      router.push('/profile/me');
    } catch {
      setEnding(false);
    }
  }

  function sendComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text || !live || !socketRef.current) return;
    socketRef.current.emit('comment', { liveId: live.id, text, token: getToken() });
    setCommentInput('');
  }

  function deleteComment(commentId: string) {
    if (!live || !socketRef.current) return;
    socketRef.current.emit('deleteComment', { liveId: live.id, commentId, token: getToken() });
  }

  function banUser(userId: string) {
    if (!live || !socketRef.current) return;
    if (!window.confirm('Bannir cet utilisateur du chat de ce live ?')) return;
    socketRef.current.emit('banUser', { liveId: live.id, userId, token: getToken() });
  }

  async function selectCapsule(capsule: Capsule) {
    if (!live) return;
    try {
      await api.post(`/lives/${live.id}/capsules`, { capsuleId: capsule.id });
      setFeaturedCapsule(capsule);
      setCapsulePickerOpen(false);
    } catch {
      // silencieux — la capsule reste simplement non mise en avant
    }
  }

  return (
    <>
      <Head>
        <title>Live — skoleomLive</title>
      </Head>

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4 shrink-0">
            <Link
              href="/profile/me"
              className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={16} className="text-white/70" />
            </Link>
            <span className="text-white font-bold text-sm">
              {live ? 'Live en cours' : 'Préparer un live'}
            </span>

            {live && (
              <div className="ml-auto flex items-center gap-3 text-white/60 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Users size={13} /> {viewerCount}
                </span>
                <span className="flex items-center gap-1.5 text-[#a8ff35]">
                  <ShoppingBag size={13} /> {sales.count} vente{sales.count > 1 ? 's' : ''} · {sales.revenue.toFixed(2)} €
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 flex overflow-hidden px-4 pb-6 gap-4">
            <div className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-hide">
              <div className="w-full max-w-md">
                <div className="relative w-full aspect-[9/16] max-h-[65vh] mx-auto rounded-2xl overflow-hidden bg-black border border-white/[0.08]">
                  {mediaError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
                      <p className="text-white/45 text-sm">{mediaError}</p>
                      <button
                        type="button"
                        onClick={() => requestMedia()}
                        className="px-4 py-2 rounded-full border border-white/15 text-white/70 text-xs font-semibold hover:bg-white/10 hover:text-white transition-all"
                      >
                        Réessayer
                      </button>
                    </div>
                  ) : (
                    // Le <video> reste toujours monté (meme avant que le flux soit pret) pour que
                    // videoRef.current existe deja quand requestMedia() resout — sinon l'assignation
                    // srcObject = stream arrive avant le montage de l'element et se perd silencieusement,
                    // laissant l'aperçu noir malgre un flux obtenu avec succes.
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${mediaReady && camOn ? '' : 'hidden'}`}
                    />
                  )}

                  {!mediaError && !mediaReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 size={24} className="text-white/30 animate-spin" />
                    </div>
                  )}

                  {mediaReady && !camOn && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <VideoOff size={28} className="text-white/25" />
                    </div>
                  )}

                  {live && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE · {fmtElapsed(elapsed)}
                    </div>
                  )}

                  {live && live.mode !== 'auction' && featuredCapsule && (
                    <button
                      onClick={() => setCapsuleDrawerOpen(true)}
                      className="skoleom-capsule-btn skoleom-capsule-btn--breathe absolute bottom-3 right-3 z-10"
                    >
                      <img src="/skoleom-mark.png" alt="Skoleom" className="skoleom-capsule-btn-logo" />
                      <span>Capsule</span>
                    </button>
                  )}

                  {live && live.mode === 'auction' && roundActive && (
                    <div className="absolute top-14 left-3 right-3 z-10 flex items-center justify-between bg-black/55 backdrop-blur-sm rounded-2xl px-3.5 py-2.5 pointer-events-none">
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

                  {mediaReady && (
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                      <button
                        onClick={toggleMic}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                          micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-500'
                        }`}
                      >
                        {micOn ? <Mic size={18} className="text-white" /> : <MicOff size={18} className="text-white" />}
                      </button>
                      <button
                        onClick={toggleCam}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                          camOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-500'
                        }`}
                      >
                        {camOn ? <Video size={18} className="text-white" /> : <VideoOff size={18} className="text-white" />}
                      </button>
                    </div>
                  )}
                </div>

                {!live ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('live')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          mode === 'live' ? 'bg-[#a8ff35] text-black border-[#a8ff35]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
                        }`}
                      >
                        <Radio size={14} /> Live classique
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('auction')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          mode === 'auction' ? 'bg-[#a8ff35] text-black border-[#a8ff35]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
                        }`}
                      >
                        <Gavel size={14} /> Enchère
                      </button>
                    </div>

                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre du live (optionnel)"
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                    />

                    {startError && (
                      <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                        {startError}
                      </p>
                    )}

                    <button
                      onClick={handleStart}
                      disabled={!mediaReady || starting}
                      className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {starting ? <Loader2 size={16} className="animate-spin" /> : mode === 'auction' ? <Gavel size={15} /> : <Radio size={15} />}
                      {mode === 'auction' ? "Démarrer l'enchère" : 'Démarrer le live'}
                    </button>

                    <p className="text-[11px] text-white/25 text-center leading-relaxed">
                      Ta caméra et ton micro seront diffusés en direct aux spectateurs.
                      {mode === 'auction' ? ' Tu choisiras tes capsules à mettre aux enchères une fois en direct.' : ''} Le chat et les
                      ventes en direct fonctionnent réellement.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-2">
                    {live.mode === 'auction' ? (
                      <>
                        {auctionResult && (
                          <p className={`text-[12px] font-semibold text-center py-1.5 ${auctionResult.winnerId ? 'text-[#a8ff35]' : 'text-white/40'}`}>
                            {auctionResult.winnerId
                              ? `Manche précédente remportée à ${auctionResult.amount?.toFixed(2)} € 🎉`
                              : 'Manche précédente terminée sans mise.'}
                          </p>
                        )}

                        {roundActive ? (
                          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-1">
                            <p className="text-[13px] font-semibold text-white">{activeAuctionCapsule?.name || 'Produit aux enchères'}</p>
                            {currentBidderName ? (
                              <p className="text-[12px] text-white/40">Plus offrant : <span className="text-[#a8ff35] font-semibold">{currentBidderName}</span></p>
                            ) : (
                              <p className="text-[12px] text-white/40">En attente de la première enchère…</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
                                Lancer une enchère pour…
                              </p>
                              {myCapsules.length === 0 ? (
                                <p className="text-white/40 text-xs">Crée d&apos;abord une capsule depuis ton profil.</p>
                              ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide">
                                  {myCapsules.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => { setAuctionCapsuleId(c.id); setStartingBidInput(String(c.price)); }}
                                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                                        auctionCapsuleId === c.id ? 'border-[#a8ff35] bg-[#a8ff35]/10' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]'
                                      }`}
                                    >
                                      <div className="w-9 h-9 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                                        {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="text-white/25" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold text-white truncate">{c.name}</p>
                                        <p className="text-[11px] text-white/40">{c.price.toFixed(2)} € · {c.stock} en stock</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {auctionCapsuleId && (
                              <>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-1.5">
                                    Mise de départ (€)
                                  </p>
                                  <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={startingBidInput}
                                    onChange={(e) => setStartingBidInput(e.target.value)}
                                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                                  />
                                </div>

                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-1.5">
                                    Durée
                                  </p>
                                  <div className="flex gap-2">
                                    {DURATION_OPTIONS.map((min) => (
                                      <button
                                        key={min}
                                        type="button"
                                        onClick={() => setDurationMinutes(min)}
                                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                          durationMinutes === min ? 'bg-[#a8ff35] text-black border-[#a8ff35]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
                                        }`}
                                      >
                                        {min} min
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {launchError && (
                                  <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-xl border border-red-400/20">
                                    {launchError}
                                  </p>
                                )}

                                <button
                                  onClick={handleLaunchAuction}
                                  disabled={launching}
                                  className="btn-skoleom w-full py-2.5 rounded-full text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                  {launching ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
                                  Lancer l&apos;enchère
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => setCapsulePickerOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/80 text-sm font-semibold transition-all"
                      >
                        <Package size={15} className="text-[#a8ff35]" />
                        {featuredCapsule ? `Capsule : ${featuredCapsule.name}` : 'Mettre en avant une capsule'}
                      </button>
                    )}
                    <button
                      onClick={handleEnd}
                      disabled={ending}
                      className="w-full py-3.5 rounded-full border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/10 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {ending ? <Loader2 size={16} className="animate-spin" /> : null}
                      Terminer le live
                    </button>
                  </div>
                )}
              </div>
            </div>

            {live && (
              <div className="w-[320px] shrink-0 flex flex-col bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] text-white/70 text-xs font-bold uppercase tracking-wider">
                  Commentaires
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3 space-y-2.5">
                  {comments.length === 0 && (
                    <p className="text-white/25 text-xs text-center mt-4">Aucun commentaire pour l&apos;instant.</p>
                  )}
                  {comments.map((c) => {
                    const isHost = c.userId === myId;
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
                      <div key={c.id} className="group flex items-start justify-between gap-2 text-[13px] leading-snug">
                        <p className="min-w-0">
                          <span className={`font-semibold mr-1 ${isHost ? 'text-[#f59e0b]' : 'text-[#a8ff35]'}`}>
                            {c.username}
                          </span>
                          {isHost && (
                            <Crown size={11} className="inline text-[#f59e0b] mr-1 -translate-y-px" />
                          )}
                          <span className="text-white/80 break-words">{c.text}</span>
                        </p>
                        {!isHost && (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => deleteComment(c.id)}
                              title="Supprimer ce commentaire"
                              className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              onClick={() => banUser(c.userId)}
                              title="Bannir cet utilisateur"
                              className="w-6 h-6 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/40 hover:text-red-400 transition-all"
                            >
                              <UserX size={12} />
                            </button>
                          </div>
                        )}
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
                    placeholder="Commenter..."
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-3.5 py-2 text-white placeholder:text-white/25 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 transition-all"
                  />
                  <button
                    type="submit"
                    className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center shrink-0 transition-all"
                  >
                    <Send size={14} className="text-[#a8ff35]" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>

      {capsulePickerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">Mettre en avant une capsule</h2>
              <button onClick={() => setCapsulePickerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            {myCapsules.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">
                Tu n&apos;as pas encore de capsule — crées-en une depuis ton profil.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-hide">
                {myCapsules.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCapsule(c)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      featuredCapsule?.id === c.id
                        ? 'border-[#a8ff35] bg-[#a8ff35]/10'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={16} className="text-white/25" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      <p className="text-xs text-white/40">{c.price.toFixed(2)} {c.currency} · {c.stock} en stock</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {featuredCapsule && (
        <CapsuleDrawer
          capsules={[featuredCapsule]}
          open={capsuleDrawerOpen}
          onClose={() => setCapsuleDrawerOpen(false)}
        />
      )}
    </>
  );
}
