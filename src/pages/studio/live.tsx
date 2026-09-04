import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import {
  ArrowLeft, Mic, MicOff, Video, VideoOff, Radio, Loader2, Send, Users, Package, X, ShoppingBag,
  Crown, Trash2, UserX, Gavel, Timer, ChevronRight, Plus, Trophy, Users2, AlertTriangle, Check, Lock, Eye, Gamepad2,
  Music, Pause, Play, Square, Wand2,
} from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { CapsuleDrawer } from '../../client/components/Capsule/CapsuleDrawer';
import { GiftBurstOverlay, type ActiveGiftBurst } from '../../client/components/Live/GiftBurstOverlay';
import { LiveGameDrawer } from '../../client/components/Game/LiveGameDrawer';
import { YoutubeMusicPlayer, extractYoutubeId, type MusicState } from '../../client/components/Live/YoutubeMusicPlayer';
import {
  FilterEngine, NO_FILTERS, filtersActive, COLOR_FILTER_PRESETS, BACKGROUND_FILTER_PRESETS, FACE_FILTER_PRESETS,
  type FilterConfig,
} from '../../client/components/Studio/videoFilters';
import { api, ApiError, getToken, getStoredUser } from '../../shared/api/http';
import { giftById } from '../../client/constants/gifts';
import type { Capsule } from '../../shared/types/api';

// Voir live/[id].tsx pour le detail de pourquoi c'est l'URL publique et non un port interne.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type LiveMode = 'live' | 'auction';

interface LiveSession {
  id: string;
  title?: string;
  startedAt: string;
  isPrivate?: boolean;
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
  auctionRoundsCount?: number;
  featuredCapsuleId?: string | null;
  featuredCapsule?: Capsule | null;
}

interface LiveComment {
  id: string;
  text: string;
  userId: string;
  username: string;
  avatarUrl?: string;
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

const DURATION_OPTIONS = [2, 5, 10, 30];

// Doit rester aligné avec AUCTION_ROUNDS_LIMIT dans lives.service.ts — affiché ici comme rappel
// avant le lancement d'une manche (pas de nouvel appel serveur, ce sont les mêmes paliers que
// ceux déjà exposés côté client pour les capsules).
const AUCTION_ROUNDS_LIMIT_CLIENT: Record<'free' | 'premium' | 'ultra', number | null> = {
  free: 2,
  premium: 10,
  ultra: null,
};

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
  // Flux publie (LiveKit) ET affiche en local — c'est la SORTIE du pipeline de filtres (voir
  // videoFilters.ts), pas le flux camera brut (streamRef) : les spectateurs voient donc le filtre
  // aussi, pas seulement un aperçu local gadget.
  const publishStreamRef = useRef<MediaStream | null>(null);
  const filterEngineRef = useRef<FilterEngine | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  // Incremente a chaque requestMedia() — permet a une requete getUserMedia en cours de se
  // reconnaitre perimee (ex: StrictMode qui monte/demonte/remonte l'effet en dev) et de liberer
  // immediatement le flux obtenu au lieu de le laisser fuiter et verrouiller la camera.
  const mediaRequestIdRef = useRef(0);
  const roomRef = useRef<Room | null>(null);
  const publishedLiveIdRef = useRef<string | null>(null);
  const myId = getStoredUser()?.id;
  // Garde-fou pour ne terminer le live qu'une seule fois (clic sur "Terminer" OU depart de la
  // page), et connait toujours l'id courant sans faire re-souscrire l'effet ci-dessous a chaque
  // mise a jour de `live` (file de vente, cadeaux...).
  const liveEndedRef = useRef(false);
  const liveIdRef = useRef<string | null>(null);

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

  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const pendingUrlRef = useRef<string | null>(null);
  const allowNavRef = useRef(false);

  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sales, setSales] = useState({ count: 0, revenue: 0 });

  const [myCapsules, setMyCapsules] = useState<Capsule[]>([]);
  const [capsulePickerOpen, setCapsulePickerOpen] = useState(false);
  const [capsuleDrawerOpen, setCapsuleDrawerOpen] = useState(false);

  // Le createur peut lancer/gerer un jeu (Undercover, Loup-Garou) directement depuis son propre
  // studio — jusqu'ici seul le spectateur (live/[id].tsx, en tant que "isOwner") le pouvait,
  // obligeant a ouvrir un second onglet pour y acceder pendant la diffusion.
  const [gameDrawerOpen, setGameDrawerOpen] = useState(false);
  const [gameActive, setGameActive] = useState(false);

  // Musique d'ambiance (YouTube) — voir le commentaire de YoutubeMusicPlayer.tsx pour le principe
  // (sync de lecture cote client, pas de mixage dans le flux LiveKit).
  const [musicState, setMusicState] = useState<MusicState | null>(null);
  const [musicPanelOpen, setMusicPanelOpen] = useState(false);
  const [musicInput, setMusicInput] = useState('');
  const [musicInputError, setMusicInputError] = useState('');

  // Filtres video (couleur / arriere-plan / visage) — voir videoFilters.ts. `filterMlError` reste
  // null tant qu'aucun filtre arriere-plan/visage n'a ete tente, ou si son chargement a reussi.
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(NO_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterMlError, setFilterMlError] = useState<string | null>(null);

  // Delai minimum apres la fin d'un live avant de pouvoir en relancer un — verifie a l'arrivee
  // sur la page pour afficher un decompte plutot que de le decouvrir a l'echec du clic "Démarrer".
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Cadeaux qui "explosent" au-dessus de la video de l'hote — memes composants/animation que
  // cote spectateur (voir GiftBurstOverlay).
  const [screenGifts, setScreenGifts] = useState<ActiveGiftBurst[]>([]);
  const screenGiftTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [topDonorsOpen, setTopDonorsOpen] = useState(false);

  // Invites façon TikTok (ex-duo, desormais N invites simultanes) — voir LivesGateway
  // (inviteDuo/respondDuo/requestDuo/respondDuoRequest/endDuo) pour le signalement. Le meme
  // panneau sert aussi de liste des spectateurs avec moderation (exclure/muter) — voir
  // openDuoPanel, kickUser, setMuted.
  const [duoPanelOpen, setDuoPanelOpen] = useState(false);
  const [viewersList, setViewersList] = useState<{ userId: string; username: string; avatarUrl?: string; muted: boolean }[]>([]);
  const [guests, setGuests] = useState<{ id: string; username: string; avatarUrl?: string }[]>([]);
  const [duoInviteStatus, setDuoInviteStatus] = useState<'idle' | 'inviting' | 'declined' | 'error'>('idle');
  const [duoErrorMsg, setDuoErrorMsg] = useState('');
  // Demandes de duo initiees par des spectateurs (sens inverse d'inviteDuo) — plusieurs peuvent
  // etre en attente en meme temps, voir requestDuo/respondDuoRequest dans LivesGateway.
  const [duoRequests, setDuoRequests] = useState<{ userId: string; username: string; avatarUrl?: string }[]>([]);
  // Demandes d'ACCES VISIONNAGE (live prive) — distinct des demandes de duo ci-dessus, voir
  // requestViewAccess/respondViewRequest dans LivesGateway.
  const [viewRequests, setViewRequests] = useState<{ userId: string; username: string; avatarUrl?: string }[]>([]);
  // Retour visuel local apres "Autoriser à regarder" — inviteViewer est un aller simple (pas de
  // reponse serveur a attendre), sans ca le bouton ne change pas d'etat et l'hote peut croire
  // que le clic n'a rien fait.
  const [grantedViewerIds, setGrantedViewerIds] = useState<Set<string>>(new Set());
  // Onglets du panneau d'invitation — recherche par pseudo et "mes abonnements" en plus de la
  // liste des spectateurs deja connectes (voir GET /users/search et GET /follows/mine/following).
  const [invitePanelTab, setInvitePanelTab] = useState<'viewers' | 'search' | 'following'>('viewers');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<{ id: string; username: string; displayName?: string; avatarUrl?: string }[]>([]);
  const [followingList, setFollowingList] = useState<{ id: string; username: string; displayName?: string; avatarUrl?: string }[]>([]);
  // Feuille mobile — sur desktop le "Top donateur" vit dans le panneau lateral (voir plus bas),
  // sur mobile c'est une feuille ouverte depuis une icone sur la video (voir le bloc md:hidden).
  const [mobileTopDonorsOpen, setMobileTopDonorsOpen] = useState(false);
  const guestVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const guestAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const guestTracksRef = useRef(new Map<string, RemoteTrack[]>());
  const pendingGuestTracksRef = useRef(new Map<string, RemoteTrack[]>());

  function attachGuestTrack(guestId: string, track: RemoteTrack) {
    const el = track.kind === Track.Kind.Video ? guestVideoRefs.current.get(guestId) : guestAudioRefs.current.get(guestId);
    if (!el) {
      if (!pendingGuestTracksRef.current.has(guestId)) pendingGuestTracksRef.current.set(guestId, []);
      pendingGuestTracksRef.current.get(guestId)!.push(track);
      return;
    }
    track.attach(el);
    if (!guestTracksRef.current.has(guestId)) guestTracksRef.current.set(guestId, []);
    guestTracksRef.current.get(guestId)!.push(track);
    if (track.kind === Track.Kind.Audio) (el as HTMLAudioElement).play().catch(() => {});
  }

  function flushPendingGuestTracks(guestId: string, kind: Track.Kind) {
    const pending = pendingGuestTracksRef.current.get(guestId) ?? [];
    const matching = pending.filter((t) => t.kind === kind);
    const rest = pending.filter((t) => t.kind !== kind);
    pendingGuestTracksRef.current.set(guestId, rest);
    matching.forEach((t) => attachGuestTrack(guestId, t));
  }

  function makeGuestVideoRef(guestId: string) {
    return (el: HTMLVideoElement | null) => {
      if (el) {
        guestVideoRefs.current.set(guestId, el);
        flushPendingGuestTracks(guestId, Track.Kind.Video);
      }
      return () => {
        guestVideoRefs.current.delete(guestId);
        (guestTracksRef.current.get(guestId) ?? []).forEach((t) => { if (el && t.kind === Track.Kind.Video) t.detach(el); });
      };
    };
  }

  function makeGuestAudioRef(guestId: string) {
    return (el: HTMLAudioElement | null) => {
      if (el) {
        guestAudioRefs.current.set(guestId, el);
        flushPendingGuestTracks(guestId, Track.Kind.Audio);
      }
      return () => {
        guestAudioRefs.current.delete(guestId);
        (guestTracksRef.current.get(guestId) ?? []).forEach((t) => { if (el && t.kind === Track.Kind.Audio) t.detach(el); });
      };
    };
  }

  // "Commencer un live" (Studio) renvoie ici sans parametre — mode par defaut "live". "Commencer
  // une enchere" renvoie avec ?mode=auction, voir l'effet ci-dessous.
  const [mode, setMode] = useState<LiveMode>('live');
  // Live prive — seul le createur (+ invites/demandes acceptees) peut regarder, voir
  // LivesGateway (inviteViewer/requestViewAccess/respondViewRequest) et LiveSession.isPrivate.
  const [isPrivate, setIsPrivate] = useState(false);

  // Le bouton "Enchere" du Studio renvoie ici avec ?mode=auction pour pre-selectionner le mode.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.mode === 'auction') setMode('auction');
  }, [router.isReady, router.query.mode]);

  const myPlan = (getStoredUser()?.plan || 'free') as 'free' | 'premium' | 'ultra';
  const auctionRoundsLimit = AUCTION_ROUNDS_LIMIT_CLIENT[myPlan];

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
    api.get<{ remainingSeconds: number }>('/lives/cooldown').then((d) => setCooldownSeconds(d.remainingSeconds)).catch(() => {});

    api.get<LiveSession | null>('/lives/mine').then((existing) => {
      if (!existing) return;
      setLive(existing);
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
      filterEngineRef.current?.stop();
      filterEngineRef.current = null;
      publishStreamRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  function requestMedia(retriesLeft = 4) {
    setMediaError('');
    setMediaReady(false);

    // Un flux precedent encore ouvert (ex: double-clic sur Reessayer) doit etre libere
    // avant d'en demander un nouveau, sinon la camera reste verrouillee par nous-memes.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    filterEngineRef.current?.stop();
    filterEngineRef.current = null;
    publishStreamRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError(
        "Ton navigateur ne supporte pas l'accès à la caméra ici — vérifie que la page est bien chargée en HTTPS (ou localhost) et que tu n'es pas en navigation privée restreinte.",
      );
      return;
    }

    const requestId = ++mediaRequestIdRef.current;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (stream) => {
        if (mediaRequestIdRef.current !== requestId) {
          // Cette requete a ete supplantee (nouvel effet StrictMode, ou nouveau Reessayer) —
          // on libere immediatement ce flux au lieu de le laisser fuiter et verrouiller la camera.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Le flux camera brut passe toujours par le pipeline de filtres (voir videoFilters.ts) —
        // meme sans filtre actif ça reste un simple recopiage de frame, et ça evite d'avoir deux
        // chemins differents (brut vs filtre) a synchroniser pour l'aperçu local ET la
        // publication LiveKit. Si le pipeline echoue pour une raison quelconque (canvas non
        // supporte...), on retombe sur le flux brut plutot que de bloquer le live.
        try {
          const engine = new FilterEngine(stream);
          filterEngineRef.current = engine;
          engine.setConfig(filterConfig);
          const output = await engine.start();
          if (mediaRequestIdRef.current !== requestId) {
            engine.stop();
            return;
          }
          publishStreamRef.current = output;
          if (videoRef.current) videoRef.current.srcObject = output;
        } catch {
          filterEngineRef.current = null;
          publishStreamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        }
        setMediaReady(true);
      })
      .catch((err) => {
        if (mediaRequestIdRef.current !== requestId) return;
        const name = err instanceof DOMException ? err.name : '';

        // NotReadableError/TrackStartError sont très souvent transitoires : le navigateur (surtout
        // en double-montage StrictMode, ou juste après la fermeture d'un autre onglet/app) peut
        // encore être en train de libérer le handle caméra côté OS au moment où on redemande —
        // ça n'a rien à voir avec une vraie appli tierce qui l'utilise. Un court retry silencieux
        // résout la grande majorité des cas avant d'afficher une erreur à l'utilisateur. Backoff
        // croissant (500ms/800ms/1200ms/1600ms, ~4s au total) — certains pilotes webcam mettent
        // plus d'une seconde à relâcher le handle, 2 essais à 500ms fixes ne suffisaient pas toujours.
        if ((name === 'NotReadableError' || name === 'TrackStartError') && retriesLeft > 0) {
          const delay = 500 + (4 - retriesLeft) * 300;
          setTimeout(() => {
            if (mediaRequestIdRef.current === requestId) requestMedia(retriesLeft - 1);
          }, delay);
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
  }, [live?.startedAt]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds > 0]);

  // Connexion WebSocket pour le chat + compteur de spectateurs, une fois le live demarre.
  // Depend uniquement de live?.id (pas de `live` en entier) : mettre a jour live.capsules /
  // live.featuredCapsule (file de vente) ne doit pas fermer/rouvrir la connexion.
  useEffect(() => {
    if (!live) return;

    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    // Voir live/[id].tsx pour le detail : 'connect' se redeclenche a chaque reconnexion, pas
    // seulement au montage, sinon une coupure reseau silencieuse nous rend invisible cote serveur.
    // Le token est indispensable ici : sans lui, handleJoin nous traite comme un spectateur
    // anonyme et refuse l'entree en room sur un live prive — meme pour son propre createur — ce
    // qui coupait tout evenement diffuse a la room (demandes d'acces, invites, cadeaux...).
    socket.on('connect', () => socket.emit('join', { liveId: live.id, token: getToken() }));
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
    socket.on('featuredCapsuleChanged', (d: { capsuleId: string | null; capsule: Capsule | null }) => {
      setLive((prev) => (prev ? { ...prev, featuredCapsuleId: d.capsuleId, featuredCapsule: d.capsule } : prev));
    });
    socket.on('gameActive', () => setGameActive(true));
    socket.on('musicChanged', (m: MusicState | null) => setMusicState(m));
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

      fetchTopDonors(live.id);
    });
    socket.on('viewersList', (list: { userId: string; username: string; avatarUrl?: string; muted: boolean }[]) => {
      setViewersList(list);
    });
    socket.on('userMuteChanged', (d: { userId: string; muted: boolean }) => {
      setViewersList((prev) => prev.map((v) => (v.userId === d.userId ? { ...v, muted: d.muted } : v)));
    });
    socket.on('duoStarted', (d: { partnerId: string; partnerUsername: string; partnerAvatarUrl?: string }) => {
      setGuests((prev) => (prev.some((g) => g.id === d.partnerId) ? prev : [...prev, { id: d.partnerId, username: d.partnerUsername, avatarUrl: d.partnerAvatarUrl }]));
      setDuoInviteStatus('idle');
    });
    socket.on('duoEnded', (d: { userId: string }) => {
      setGuests((prev) => prev.filter((g) => g.id !== d.userId));
      (guestTracksRef.current.get(d.userId) ?? []).forEach((t) => t.detach());
      guestTracksRef.current.delete(d.userId);
      pendingGuestTracksRef.current.delete(d.userId);
    });
    socket.on('duoDeclined', () => setDuoInviteStatus('declined'));
    socket.on('duoError', (d: { message: string }) => {
      setDuoInviteStatus('error');
      setDuoErrorMsg(d.message);
    });
    socket.on('duoRequestReceived', (d: { userId: string; username: string; avatarUrl?: string }) => {
      setDuoRequests((prev) => (prev.some((r) => r.userId === d.userId) ? prev : [...prev, d]));
    });
    socket.on('duoRequestCancelled', (d: { userId: string }) => {
      setDuoRequests((prev) => prev.filter((r) => r.userId !== d.userId));
    });
    socket.on('viewRequestReceived', (d: { userId: string; username: string; avatarUrl?: string }) => {
      setViewRequests((prev) => (prev.some((r) => r.userId === d.userId) ? prev : [...prev, d]));
    });
    socket.on('viewRequestCancelled', (d: { userId: string }) => {
      setViewRequests((prev) => prev.filter((r) => r.userId !== d.userId));
    });

    return () => {
      socket.emit('leave', { liveId: live.id });
      socket.close();
      socketRef.current = null;
      screenGiftTimeouts.current.forEach(clearTimeout);
      screenGiftTimeouts.current = [];
    };
  }, [live?.id]);

  // Classement des plus gros donateurs de ce live — recharge a l'arrivee, puis periodiquement.
  function fetchTopDonors(liveId: string) {
    api.get<TopDonor[]>(`/lives/${liveId}/top-donors`).then(setTopDonors).catch(() => {});
  }

  function openDuoPanel() {
    if (!live) return;
    setDuoPanelOpen(true);
    // Sur un live prive, l'onglet "Spectateurs" est vide par construction (personne ne peut
    // etre connecte sans acces) — partir sur "Rechercher" evite que l'hote atterrisse sur un
    // onglet vide et croie qu'il n'y a aucun moyen d'inviter quelqu'un.
    setInvitePanelTab(live.isPrivate ? 'search' : 'viewers');
    setDuoInviteStatus('idle');
    socketRef.current?.emit('listViewers', { liveId: live.id, token: getToken() });
  }

  function inviteDuo(targetUserId: string) {
    if (!live) return;
    setDuoInviteStatus('inviting');
    socketRef.current?.emit('inviteDuo', { liveId: live.id, targetUserId, token: getToken() });
  }

  function endDuo(targetUserId: string) {
    if (!live) return;
    socketRef.current?.emit('endDuo', { liveId: live.id, token: getToken(), targetUserId });
  }

  // Pousse une invitation a un spectateur precis pour rejoindre la partie en cours — le jeu se
  // rejoint sinon seulement en libre-service (bouton Gamepad2, visible des que gameActive passe a
  // true pour tout le monde), ce qui n'etait pas assez visible/decouvrable en pratique.
  const [gameInviteSentTo, setGameInviteSentTo] = useState<string | null>(null);
  function inviteToGame(targetUserId: string) {
    if (!live) return;
    socketRef.current?.emit('inviteToGame', { liveId: live.id, targetUserId, token: getToken() });
    setGameInviteSentTo(targetUserId);
    setTimeout(() => setGameInviteSentTo((cur) => (cur === targetUserId ? null : cur)), 2500);
  }

  function setMusicTrack() {
    if (!live) return;
    const youtubeId = extractYoutubeId(musicInput);
    if (!youtubeId) {
      setMusicInputError("Lien YouTube non reconnu — colle l'URL complète de la vidéo.");
      return;
    }
    setMusicInputError('');
    socketRef.current?.emit('setMusic', { liveId: live.id, token: getToken(), youtubeId });
    setMusicInput('');
  }

  function toggleMusicPlay() {
    if (!live || !musicState) return;
    socketRef.current?.emit(musicState.playing ? 'pauseMusic' : 'resumeMusic', { liveId: live.id, token: getToken() });
  }

  function stopMusic() {
    if (!live) return;
    socketRef.current?.emit('stopMusic', { liveId: live.id, token: getToken() });
  }

  // Recherche par pseudo debattue cote serveur — meme pattern que pages/index.tsx.
  useEffect(() => {
    const q = inviteQuery.trim();
    if (!q) { setInviteSearchResults([]); return; }
    const timeout = setTimeout(() => {
      api.get<{ id: string; username: string; displayName?: string; avatarUrl?: string }[]>(`/users/search?q=${encodeURIComponent(q)}`)
        .then(setInviteSearchResults)
        .catch(() => setInviteSearchResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [inviteQuery]);

  // Charge la liste d'abonnements une seule fois a l'ouverture de cet onglet, pas a chaque frappe.
  useEffect(() => {
    if (invitePanelTab !== 'following' || !duoPanelOpen) return;
    api.get<{ id: string; username: string; displayName?: string; avatarUrl?: string }[]>('/follows/mine/following')
      .then(setFollowingList)
      .catch(() => setFollowingList([]));
  }, [invitePanelTab, duoPanelOpen]);

  function respondDuoRequest(targetUserId: string, accept: boolean) {
    if (!live) return;
    socketRef.current?.emit('respondDuoRequest', { liveId: live.id, userId: targetUserId, accept, token: getToken() });
    setDuoRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
  }

  // Accorde l'acces visionnage a quelqu'un — immediat, pas besoin qu'il accepte (contrairement
  // au duo qui implique de publier sa camera, voir LivesGateway.handleInviteViewer).
  function inviteViewer(targetUserId: string) {
    if (!live) return;
    socketRef.current?.emit('inviteViewer', { liveId: live.id, targetUserId, token: getToken() });
    setGrantedViewerIds((prev) => new Set(prev).add(targetUserId));
  }

  function respondViewRequest(targetUserId: string, accept: boolean) {
    if (!live) return;
    socketRef.current?.emit('respondViewRequest', { liveId: live.id, userId: targetUserId, accept, token: getToken() });
    setViewRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
  }

  useEffect(() => {
    if (!live?.id) return;
    fetchTopDonors(live.id);
    const timer = setInterval(() => fetchTopDonors(live.id), 20000);
    return () => clearInterval(timer);
  }, [live?.id]);

  // Invites deja presents si le studio est recharge en cours de live (l'etat temps reel seul
  // ne couvre que les changements a partir de maintenant).
  useEffect(() => {
    if (!live?.id) return;
    api.get<{ id: string; username: string; avatarUrl?: string }[]>(`/lives/${live.id}/guests`).then(setGuests).catch(() => {});
  }, [live?.id]);

  useEffect(() => {
    liveIdRef.current = live?.id ?? null;
  }, [live?.id]);

  // Quitter le studio (navigation interne ou fermeture d'onglet) sans avoir clique "Terminer le
  // live" laissait le live actif indefiniment cote serveur (bloquant tout nouveau lancement —
  // voir LivesService.start/startAuction) alors que la camera/le flux s'arretent bel et bien
  // localement. On termine donc le live cote serveur des qu'on part, comme le ferait "Terminer
  // le live" — rester "en direct" est desormais lie au fait de rester sur cette page. Une
  // navigation interne (clic sur un lien/la sidebar) passe d'abord par une confirmation — voir
  // handleRouteChangeStart — la fermeture d'onglet/rechargement (pagehide) ne peut proposer que
  // le prompt générique du navigateur (beforeunload), donc reste immédiate une fois confirmée.
  useEffect(() => {
    function endOnLeave() {
      if (liveEndedRef.current || !liveIdRef.current) return;
      liveEndedRef.current = true;
      const token = getToken();
      fetch(`/api/lives/${liveIdRef.current}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        keepalive: true,
      }).catch(() => {});
    }

    function handleRouteChangeStart(url: string) {
      if (allowNavRef.current) return;
      if (liveEndedRef.current || !liveIdRef.current) return;
      pendingUrlRef.current = url;
      setLeaveConfirmOpen(true);
      router.events.emit('routeChangeError');
      // Seul moyen (non-officiel mais standard sur Next Pages Router) d'annuler une navigation
      // déjà déclenchée depuis un handler routeChangeStart — laisse une trace en console, sans
      // impact fonctionnel.
      throw 'routeChange aborted — confirmation de sortie de live requise';
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (liveEndedRef.current || !liveIdRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    }

    router.events.on('routeChangeStart', handleRouteChangeStart);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', endOnLeave);
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', endOnLeave);
    };
  }, [router]);

  // Diffusion video reelle vers les spectateurs (LiveKit) — publie le flux camera/micro deja
  // obtenu pour l'apercu local, une fois le live demarre. Si LiveKit n'est pas configure cote
  // serveur (pas de compte/cles), l'appel echoue silencieusement : le live continue quand meme
  // (chat/encheres fonctionnent), seule la video ne part pas vers les spectateurs.
  useEffect(() => {
    if (!live || !mediaReady || !publishStreamRef.current) return;
    if (publishedLiveIdRef.current === live.id) return;
    publishedLiveIdRef.current = live.id;

    let cancelled = false;
    (async () => {
      try {
        const { token, url } = await api.get<{ token: string; url: string }>(`/lives/${live.id}/livekit-token`);
        if (cancelled) return;
        const room = new Room();
        // Seuls les invites peuvent publier dans cette room a part moi — n'importe quelle piste
        // reçue d'un autre participant est forcement celle d'un invite (voir son identity).
        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          attachGuestTrack(participant.identity, track);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        roomRef.current = room;
        // Flux FILTRE (pas le flux camera brut) — voir publishStreamRef, les spectateurs voient
        // donc le meme filtre que l'aperçu local.
        const videoTrack = publishStreamRef.current?.getVideoTracks()[0];
        const audioTrack = publishStreamRef.current?.getAudioTracks()[0];
        if (videoTrack) await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
        if (audioTrack) await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
      } catch {
        // Diffusion video indisponible — voir commentaire ci-dessus.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [live?.id, mediaReady]);

  // Repercute tout changement de filtre sur le pipeline en cours — voir videoFilters.ts. Charge
  // le ML a la demande (une seule fois) si un filtre arriere-plan/visage est choisi, et remonte
  // l'erreur de chargement s'il y en a une (les filtres de couleur restent utilisables dans tous les cas).
  useEffect(() => {
    const engine = filterEngineRef.current;
    if (!engine) return;
    engine.setConfig(filterConfig);
    if (filterConfig.background !== 'none' || filterConfig.face !== 'none') {
      engine.ensureMlLoaded().then((err) => setFilterMlError(err));
    } else {
      setFilterMlError(null);
    }
  }, [filterConfig, mediaReady]);

  // Compte a rebours de l'enchere — recalcule chaque seconde a partir de auctionEndsAt (mis a
  // jour par les evenements bidUpdate en cas de prolongation anti-sniping).
  useEffect(() => {
    if (!live || live.mode !== 'auction' || !auctionEndsAt) return;
    const tick = () => setAuctionSecondsLeft((new Date(auctionEndsAt).getTime() - Date.now()) / 1000);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [live?.mode, auctionEndsAt]);

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
  }, [live?.id]);

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
        isPrivate: isPrivate || undefined,
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

  // Le clic "Quitter et éteindre" de la modale de confirmation — même logique que la garde
  // pagehide (fetch keepalive fire-and-forget), puis on laisse la navigation initialement
  // demandée reprendre son cours.
  function confirmLeave() {
    if (!liveEndedRef.current && liveIdRef.current) {
      liveEndedRef.current = true;
      const token = getToken();
      fetch(`/api/lives/${liveIdRef.current}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        keepalive: true,
      }).catch(() => {});
    }
    setLeaveConfirmOpen(false);
    allowNavRef.current = true;
    const url = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (url) router.push(url);
  }

  function cancelLeave() {
    setLeaveConfirmOpen(false);
    pendingUrlRef.current = null;
  }

  async function handleEnd() {
    if (!live) return;
    setEnding(true);
    liveEndedRef.current = true;
    try {
      await api.patch(`/lives/${live.id}/end`);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      roomRef.current?.disconnect();
      roomRef.current = null;
      router.push('/profile/me');
    } catch {
      setEnding(false);
      liveEndedRef.current = false;
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

  function setMuted(userId: string, muted: boolean) {
    if (!live || !socketRef.current) return;
    setViewersList((prev) => prev.map((v) => (v.userId === userId ? { ...v, muted } : v)));
    socketRef.current.emit('setMuted', { liveId: live.id, userId, muted, token: getToken() });
  }

  function kickUser(userId: string) {
    if (!live || !socketRef.current) return;
    if (!window.confirm('Exclure cet utilisateur de ce live ? Il ne pourra pas le rejoindre.')) return;
    socketRef.current.emit('kickUser', { liveId: live.id, userId, token: getToken() });
    setViewersList((prev) => prev.filter((v) => v.userId !== userId));
  }

  // Met en avant un produit — file de vente façon Whatnot. `setFeatured` persiste le choix
  // cote serveur (PATCH /lives/:id/featured), qui diffuse ensuite le changement a tous les
  // spectateurs via websocket (voir le listener 'featuredCapsuleChanged' plus haut).
  async function setFeatured(capsuleId: string | null) {
    if (!live) return;
    try {
      const updated = await api.patch<LiveSession>(`/lives/${live.id}/featured`, { capsuleId });
      setLive((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch {
      // silencieux — le produit mis en avant reste simplement inchange
    }
  }

  // Choix depuis le picker : attache d'abord la capsule au live si besoin (roster de vente),
  // puis la met en avant immediatement.
  async function selectCapsule(capsule: Capsule) {
    if (!live) return;
    try {
      let current: LiveSession = live;
      if (!live.capsules?.some((c) => c.id === capsule.id)) {
        current = await api.post<LiveSession>(`/lives/${live.id}/capsules`, { capsuleId: capsule.id });
        setLive((prev) => (prev ? { ...prev, ...current } : current));
      }
      setCapsulePickerOpen(false);
      await setFeatured(capsule.id);
    } catch {
      // silencieux — la capsule reste simplement non mise en avant
    }
  }

  // Avance a l'article suivant de la file (ordre d'attachement) — boucle au premier une fois
  // le dernier atteint, comme le "Suivant" d'une file Whatnot pendant un live.
  function advanceFeatured() {
    if (!live?.capsules?.length) return;
    const idx = live.capsules.findIndex((c) => c.id === live.featuredCapsuleId);
    const next = live.capsules[(idx + 1) % live.capsules.length];
    setFeatured(next.id);
  }

  return (
    <>
      <Head>
        <title>Live — skoleomLive</title>
      </Head>

      <div className="flex h-dvh cosmic-bg overflow-hidden">
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
                <button
                  onClick={openDuoPanel}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                  title="Voir les spectateurs"
                >
                  <Users size={13} /> {viewerCount}
                </button>
                <span className="hidden sm:flex items-center gap-1.5 text-[#ffc94d]">
                  <ShoppingBag size={13} /> {sales.count} vente{sales.count > 1 ? 's' : ''} · {sales.revenue.toFixed(2)} €
                </span>
                {/* Seul acces a "Terminer le live" sur mobile — le panneau de bureau (hidden
                    md:flex, plus bas) en a aussi un, mais il est invisible sur petit ecran. */}
                <button
                  onClick={handleEnd}
                  disabled={ending}
                  className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold disabled:opacity-60 shrink-0"
                >
                  {ending ? <Loader2 size={12} className="animate-spin" /> : null}
                  Terminer
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden px-4 pb-20 md:pb-6 gap-4">
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
                    // Grille "cote a cote" façon visio (Discord) — une cellule par participant
                    // (moi + chaque invite duo), toujours la meme structure (meme en solo, ou elle
                    // degenere en 1 seule colonne) pour ne jamais demonter/re-attacher les <video>
                    // refs quand un duo commence ou se termine.
                    <div
                      className="absolute inset-0 grid gap-0.5 bg-black"
                      style={{ gridTemplateColumns: `repeat(${guests.length > 0 ? 2 : 1}, 1fr)`, gridAutoRows: '1fr' }}
                    >
                      <div className="relative bg-black overflow-hidden">
                        {/* Le <video> reste toujours monté (meme avant que le flux soit pret) pour
                            que videoRef.current existe deja quand requestMedia() resout — sinon
                            l'assignation srcObject = stream arrive avant le montage de l'element
                            et se perd silencieusement, laissant l'aperçu noir malgre un flux
                            obtenu avec succes. */}
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`absolute inset-0 w-full h-full object-cover ${mediaReady && camOn ? '' : 'hidden'}`}
                        />
                        {!mediaReady && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 size={24} className="text-white/30 animate-spin" />
                          </div>
                        )}
                        {mediaReady && !camOn && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <VideoOff size={28} className="text-white/25" />
                          </div>
                        )}
                        {guests.length > 0 && (
                          <span className="absolute bottom-1 left-1.5 z-10 text-[10px] text-white font-semibold truncate px-1 drop-shadow">Toi</span>
                        )}
                      </div>
                      {guests.map((g) => (
                        <div key={g.id} className="relative bg-black overflow-hidden">
                          <video ref={makeGuestVideoRef(g.id)} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                          <audio ref={makeGuestAudioRef(g.id)} autoPlay className="hidden" />
                          <span className="absolute bottom-1 left-1.5 z-10 text-[10px] text-white font-semibold truncate px-1 drop-shadow">@{g.username}</span>
                          <button
                            onClick={() => endDuo(g.id)}
                            className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                          >
                            <X size={11} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {live && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE · {fmtElapsed(elapsed)}
                      </div>
                      {live.isPrivate && (
                        <div className="flex items-center gap-1 bg-black/60 text-white/80 text-[11px] font-semibold px-2 py-1 rounded-full">
                          <Lock size={10} /> Privé
                        </div>
                      )}
                    </div>
                  )}

                  {live && live.mode !== 'auction' && live.featuredCapsule && (
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
                        <p className="text-[#ffc94d] font-extrabold text-[17px] leading-none">{currentBid.toFixed(2)} €</p>
                        {currentBidderName && (
                          <p className="text-white/40 text-[10px] mt-0.5">par {currentBidderName}</p>
                        )}
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
                      {live && (
                        <button
                          onClick={openDuoPanel}
                          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                            guests.length > 0 ? 'bg-[#ffc94d] text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                          title="Gérer les invités"
                        >
                          <Users2 size={18} />
                          {(duoRequests.length > 0 || viewRequests.length > 0) && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-black" />
                          )}
                        </button>
                      )}
                      {live && (
                        <button
                          onClick={() => setGameDrawerOpen(true)}
                          className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all bg-white/10 hover:bg-white/20 text-white"
                          title="Jeu"
                        >
                          <Gamepad2 size={18} className="text-[#ffc94d]" />
                          {gameActive && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#ffc94d] border-2 border-black" />}
                        </button>
                      )}
                      {live && (
                        <button
                          onClick={() => setMusicPanelOpen(true)}
                          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                            musicState ? 'bg-[#ffc94d] text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                          title="Musique"
                        >
                          <Music size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => setFilterPanelOpen(true)}
                        className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                          filtersActive(filterConfig) ? 'bg-[#ffc94d] text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title="Filtres"
                      >
                        <Wand2 size={18} />
                      </button>
                    </div>
                  )}

                  {/* Demande de duo entrante — un spectateur a demande a nous rejoindre (sens
                      inverse d'"Inviter en duo"). On ne montre que la premiere ici, les autres
                      (s'il y en a) sont visibles dans le panneau "Spectateurs". */}
                  {duoRequests.length > 0 && (
                    <div className="absolute top-14 left-3 right-3 z-30 flex items-center justify-between gap-2 bg-black/80 backdrop-blur-sm border border-[#ffc94d]/40 rounded-2xl px-3.5 py-2.5">
                      <p className="text-white text-[12px] font-medium min-w-0">
                        <span className="font-bold text-[#ffc94d]">@{duoRequests[0].username}</span> demande à faire un duo
                        {duoRequests.length > 1 ? ` (+${duoRequests.length - 1} autre${duoRequests.length > 2 ? 's' : ''})` : ''}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => respondDuoRequest(duoRequests[0].userId, true)} className="w-8 h-8 rounded-full bg-[#ffc94d] text-black flex items-center justify-center">
                          <Check size={14} />
                        </button>
                        <button onClick={() => respondDuoRequest(duoRequests[0].userId, false)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Demande d'ACCES VISIONNAGE (live prive) — meme principe que la bannière
                      duo ci-dessus mais pour "regarder", pas "publier". Décalée sous la bannière
                      duo si les deux sont visibles en même temps. */}
                  {viewRequests.length > 0 && (
                    <div className={`absolute left-3 right-3 z-30 flex items-center justify-between gap-2 bg-black/80 backdrop-blur-sm border border-[#ffc94d]/40 rounded-2xl px-3.5 py-2.5 ${duoRequests.length > 0 ? 'top-[6.5rem]' : 'top-14'}`}>
                      <p className="text-white text-[12px] font-medium min-w-0">
                        <span className="font-bold text-[#ffc94d]">@{viewRequests[0].username}</span> demande à rejoindre ce live privé
                        {viewRequests.length > 1 ? ` (+${viewRequests.length - 1} autre${viewRequests.length > 2 ? 's' : ''})` : ''}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => respondViewRequest(viewRequests[0].userId, true)} className="w-8 h-8 rounded-full bg-[#ffc94d] text-black flex items-center justify-center">
                          <Check size={14} />
                        </button>
                        <button onClick={() => respondViewRequest(viewRequests[0].userId, false)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mobile uniquement — fil de commentaires transparent façon TikTok, en
                      incrustation sur la vidéo, au lieu du pavé opaque qui poussait tout vers le
                      bas et mangeait l'écran (voir le panneau desktop caché ici, plus bas). */}
                  <div
                    className="md:hidden absolute left-0 right-3 bottom-16 z-10 max-h-[30%] overflow-y-auto scrollbar-hide flex flex-col gap-1 px-3 pb-1 pointer-events-none"
                    style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%)' }}
                  >
                    {comments.map((c) => {
                      const isHost = c.userId === myId;
                      if (c.isGift) {
                        return (
                          <p key={c.id} className="flex items-center gap-1.5 text-[12.5px] leading-snug [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                            {c.giftImage && <img src={c.giftImage} alt="" className="w-4 h-4 object-contain shrink-0" />}
                            <span className="font-bold text-[#f59e0b]">{c.username}</span>
                            <span className="text-[#f59e0b]/90 font-medium">{c.text}</span>
                          </p>
                        );
                      }
                      if (c.isBid) {
                        return (
                          <p key={c.id} className="text-[12.5px] leading-snug [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                            <span className="font-bold text-[#ffc94d]">{c.username}</span>{' '}
                            <span className="text-[#ffc94d]/90 font-medium">{c.text}</span>
                          </p>
                        );
                      }
                      return (
                        <p key={c.id} className="text-[12.5px] leading-snug [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                          <span className={`font-bold ${isHost ? 'text-[#f59e0b]' : 'text-[#ffc94d]'}`}>{c.username}</span>
                          {isHost && <Crown size={10} className="inline text-[#f59e0b] mx-1 -translate-y-px" />}
                          <span className="text-white/95"> {c.text}</span>
                        </p>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setMobileTopDonorsOpen(true)}
                    className="md:hidden absolute right-2 bottom-16 z-30 w-10 h-10 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm flex items-center justify-center"
                  >
                    <Trophy size={17} className="text-[#f59e0b]" />
                  </button>

                  {/* Ecrire un message sur mobile — le formulaire "vrai" (plus bas, avec l'historique
                      complet) est dans le panneau desktop (hidden md:flex), invisible sur mobile :
                      sans ceci il n'y avait tout simplement aucun moyen de commenter sur mobile. */}
                  <form onSubmit={sendComment} className="md:hidden absolute left-3 right-14 bottom-16 z-30 flex items-center gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Commenter…"
                      className="flex-1 bg-black/45 border border-white/20 rounded-full px-3.5 py-2 text-white placeholder:text-white/50 text-[13px] backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 transition-all"
                    />
                    <button type="submit" className="w-9 h-9 rounded-full bg-black/45 border border-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                      <Send size={14} className="text-[#ffc94d]" />
                    </button>
                  </form>

                  {musicState && (
                    <div className="absolute top-3 right-3 z-20 w-24 h-16 rounded-xl overflow-hidden border border-white/15 bg-black shadow-lg">
                      <YoutubeMusicPlayer state={musicState} elementId="studio-music-player" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/70 py-1">
                        <button onClick={toggleMusicPlay} className="text-white/90 hover:text-white">
                          {musicState.playing ? <Pause size={11} /> : <Play size={11} />}
                        </button>
                        <button onClick={stopMusic} className="text-white/90 hover:text-white">
                          <Square size={10} />
                        </button>
                      </div>
                    </div>
                  )}

                  <GiftBurstOverlay items={screenGifts} />
                </div>

                {guests.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {guests.map((g) => (
                      <div key={g.id} className="flex items-center justify-between bg-[#ffc94d]/10 border border-[#ffc94d]/25 rounded-xl px-3.5 py-2">
                        <p className="text-[12px] text-[#ffc94d] font-semibold">Invité @{g.username}</p>
                        <button onClick={() => endDuo(g.id)} className="text-[11px] text-white/50 hover:text-white underline">
                          Terminer
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!live ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('live')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          mode === 'live' ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
                        }`}
                      >
                        <Radio size={14} /> Live classique
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('auction')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          mode === 'auction' ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
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
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => setIsPrivate((p) => !p)}
                      className="w-full flex items-center justify-between gap-3 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-left transition-all hover:bg-white/[0.08]"
                    >
                      <span className="flex items-center gap-2.5 text-sm text-white">
                        <Lock size={15} className={isPrivate ? 'text-[#ffc94d]' : 'text-white/40'} />
                        Live privé
                        <span className="text-white/35 text-xs font-normal">— accès sur invitation ou demande</span>
                      </span>
                      <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${isPrivate ? 'bg-[#ffc94d]' : 'bg-white/15'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black transition-transform ${isPrivate ? 'translate-x-4' : ''}`} />
                      </span>
                    </button>

                    {cooldownSeconds > 0 && (
                      <p className="text-amber-300 text-sm bg-amber-400/10 px-4 py-2.5 rounded-xl border border-amber-400/20 text-center">
                        Tu pourras relancer un live dans {cooldownSeconds}s — un petit délai entre deux directs.
                      </p>
                    )}

                    {startError && (
                      <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                        {startError}
                      </p>
                    )}

                    <button
                      onClick={handleStart}
                      disabled={!mediaReady || starting || cooldownSeconds > 0}
                      className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {starting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : cooldownSeconds > 0 ? (
                        <Timer size={15} />
                      ) : mode === 'auction' ? (
                        <Gavel size={15} />
                      ) : (
                        <Radio size={15} />
                      )}
                      {cooldownSeconds > 0
                        ? `Patiente encore ${cooldownSeconds}s`
                        : mode === 'auction'
                        ? "Démarrer l'enchère"
                        : 'Démarrer le live'}
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
                          <p className={`text-[12px] font-semibold text-center py-1.5 ${auctionResult.winnerId ? 'text-[#ffc94d]' : 'text-white/40'}`}>
                            {auctionResult.winnerId
                              ? `Manche précédente remportée à ${auctionResult.amount?.toFixed(2)} € 🎉`
                              : 'Manche précédente terminée sans mise.'}
                          </p>
                        )}

                        {roundActive ? (
                          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-1">
                            <p className="text-[13px] font-semibold text-white">{activeAuctionCapsule?.name || 'Produit aux enchères'}</p>
                            {currentBidderName ? (
                              <p className="text-[12px] text-white/40">Plus offrant : <span className="text-[#ffc94d] font-semibold">{currentBidderName}</span></p>
                            ) : (
                              <p className="text-[12px] text-white/40">En attente de la première enchère…</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                            {auctionRoundsLimit !== null && (
                              <p
                                className={`text-[11px] leading-relaxed rounded-lg px-2.5 py-2 border ${
                                  (live.auctionRoundsCount ?? 0) >= auctionRoundsLimit
                                    ? 'bg-red-400/10 text-red-300 border-red-400/20'
                                    : 'bg-white/[0.03] text-white/40 border-white/[0.06]'
                                }`}
                              >
                                {(live.auctionRoundsCount ?? 0) >= auctionRoundsLimit ? 'Limite atteinte — ' : ''}
                                Ton offre actuelle te permet {auctionRoundsLimit} manche{auctionRoundsLimit > 1 ? 's' : ''} d&apos;enchère par live.{' '}
                                <Link href="/profile/me?tab=capsules" className="underline font-semibold hover:brightness-110">
                                  Mettre à jour ton offre
                                </Link>{' '}
                                pour plus de manches.
                              </p>
                            )}

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
                                Lancer une enchère pour…
                              </p>
                              {myCapsules.length === 0 ? (
                                <Link
                                  href="/profile/me?tab=capsules&openCapsule=1"
                                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/15 text-white/50 text-xs font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
                                >
                                  <Package size={14} /> Crée d&apos;abord une capsule depuis ton profil
                                </Link>
                              ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide">
                                  {myCapsules.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => { setAuctionCapsuleId(c.id); setStartingBidInput(String(c.price)); }}
                                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                                        auctionCapsuleId === c.id ? 'border-[#ffc94d] bg-[#ffc94d]/10' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]'
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
                                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all"
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
                                          durationMinutes === min ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
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
                                  disabled={launching || (auctionRoundsLimit !== null && (live.auctionRoundsCount ?? 0) >= auctionRoundsLimit)}
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
                      <div className="space-y-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                            File de vente
                          </p>
                          <button
                            type="button"
                            onClick={() => setCapsulePickerOpen(true)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-[#ffc94d] hover:brightness-110 transition-all"
                          >
                            <Plus size={12} /> Ajouter
                          </button>
                        </div>

                        {live.featuredCapsule ? (
                          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-[#ffc94d]/40 bg-[#ffc94d]/10">
                            <div className="w-11 h-11 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                              {live.featuredCapsule.imageUrl ? (
                                <img src={live.featuredCapsule.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package size={16} className="text-white/25" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#ffc94d]">En vente maintenant</p>
                              <p className="text-sm font-semibold text-white truncate">{live.featuredCapsule.name}</p>
                            </div>
                            <span className="text-[#ffc94d] font-bold text-sm shrink-0">{live.featuredCapsule.price.toFixed(2)} €</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCapsulePickerOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/15 text-white/50 text-sm font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
                          >
                            <Package size={15} /> Choisir le premier produit
                          </button>
                        )}

                        {live.capsules && live.capsules.filter((c) => c.id !== live.featuredCapsuleId).length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">À suivre</p>
                            {live.capsules.filter((c) => c.id !== live.featuredCapsuleId).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setFeatured(c.id)}
                                className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-left transition-all"
                              >
                                <div className="w-8 h-8 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                                  {c.imageUrl ? (
                                    <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Package size={12} className="text-white/25" />
                                  )}
                                </div>
                                <span className="flex-1 min-w-0 text-[13px] text-white/70 truncate">{c.name}</span>
                                <span className="text-white/30 text-[12px] shrink-0">{c.price.toFixed(2)} €</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {live.capsules && live.capsules.length > 1 && (
                          <button
                            type="button"
                            onClick={advanceFeatured}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white text-sm font-semibold transition-all"
                          >
                            Suivant <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
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
              <div className="hidden md:w-[320px] md:shrink-0 md:flex flex-col gap-2">
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
                      {topDonors[0] ? `👑 ${topDonors[0].displayName || topDonors[0].username}` : 'Aucun cadeau encore'}
                    </span>
                  </span>
                </button>

                {topDonorsOpen && (
                  <div className="shrink-0 bg-[#341839] border border-[#f59e0b]/25 rounded-2xl p-3 max-h-64 overflow-y-auto scrollbar-hide">
                    {topDonors.length === 0 ? (
                      <p className="text-white/30 text-xs text-center py-4">Aucun cadeau reçu pour l&apos;instant sur ce live.</p>
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

                <div className="h-[70vh] md:h-auto md:flex-1 flex flex-col bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] text-white/70 text-xs font-bold uppercase tracking-wider">
                  Commentaires
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3 space-y-2.5">
                  {comments.length === 0 && (
                    <p className="text-white/25 text-xs text-center mt-4">Aucun commentaire pour l&apos;instant.</p>
                  )}
                  {comments.map((c) => {
                    const isHost = c.userId === myId;
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
                          <span className="w-5 h-5 rounded-full bg-[#ffc94d]/15 flex items-center justify-center shrink-0">
                            <Gavel size={11} className="text-[#ffc94d]" />
                          </span>
                          <p className="min-w-0">
                            <span className="font-semibold mr-1 text-[#ffc94d]">{c.username}</span>
                            <span className="text-[#ffc94d]/80 break-words font-medium">{c.text}</span>
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={c.id} className="group flex items-start justify-between gap-2 text-[13px] leading-snug">
                        <p className="min-w-0">
                          <span className={`font-semibold mr-1 ${isHost ? 'text-[#f59e0b]' : 'text-[#ffc94d]'}`}>
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
                              onClick={() => {
                                if (window.confirm('Mettre cet utilisateur en sourdine (il ne pourra plus commenter) ?')) {
                                  setMuted(c.userId, true);
                                }
                              }}
                              title="Mettre en sourdine"
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
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-3.5 py-2 text-white placeholder:text-white/25 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 transition-all"
                  />
                  <button
                    type="submit"
                    className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center shrink-0 transition-all"
                  >
                    <Send size={14} className="text-[#ffc94d]" />
                  </button>
                </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {capsulePickerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#341839] border border-white/[0.08] rounded-[20px] p-5">
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
                      live?.featuredCapsuleId === c.id
                        ? 'border-[#ffc94d] bg-[#ffc94d]/10'
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

      {live?.featuredCapsule && (
        <CapsuleDrawer
          capsules={[live.featuredCapsule]}
          open={capsuleDrawerOpen}
          onClose={() => setCapsuleDrawerOpen(false)}
        />
      )}

      {gameDrawerOpen && live && (
        <LiveGameDrawer liveId={live.id} isLiveOwner gameActive={gameActive} onClose={() => setGameDrawerOpen(false)} />
      )}

      {musicPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setMusicPanelOpen(false)}>
          <div className="w-full max-w-sm bg-[#341839] border border-white/[0.08] rounded-[20px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Music size={16} /> Musique
              </h2>
              <button onClick={() => setMusicPanelOpen(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-white/40 text-xs mb-4">
              Colle un lien YouTube — chaque spectateur l&apos;entendra en même temps que toi, en parallèle de la vidéo (pas mixé dans ton micro).
            </p>
            {musicState && (
              <div className="flex items-center justify-between bg-[#ffc94d]/10 border border-[#ffc94d]/25 rounded-xl px-3.5 py-2.5 mb-4">
                <p className="text-[12px] text-[#ffc94d] font-semibold">{musicState.playing ? 'En cours de lecture' : 'En pause'}</p>
                <div className="flex items-center gap-2">
                  <button onClick={toggleMusicPlay} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                    {musicState.playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={stopMusic} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                    <Square size={13} />
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={musicInput}
                onChange={(e) => { setMusicInput(e.target.value); setMusicInputError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && setMusicTrack()}
                placeholder="https://youtube.com/watch?v=…"
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30"
              />
              <button onClick={setMusicTrack} className="btn-skoleom px-4 rounded-xl text-sm shrink-0">
                {musicState ? 'Changer' : 'Lancer'}
              </button>
            </div>
            {musicInputError && <p className="text-red-400 text-xs mt-2">{musicInputError}</p>}
          </div>
        </div>
      )}

      {filterPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setFilterPanelOpen(false)}>
          <div className="w-full max-w-sm bg-[#341839] border border-white/[0.08] rounded-[20px] p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Wand2 size={16} /> Filtres
              </h2>
              <button onClick={() => setFilterPanelOpen(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {filterMlError && (
              <p className="text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 rounded-xl px-3.5 py-2.5 mb-4">{filterMlError}</p>
            )}

            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-2">Couleur</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {COLOR_FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterConfig((c) => ({ ...c, color: f.id }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filterConfig.color === f.id ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.05] text-white/70 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-2">Arrière-plan</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {BACKGROUND_FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterConfig((c) => ({ ...c, background: f.id }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filterConfig.background === f.id ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.05] text-white/70 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-2">Visage</p>
            <div className="flex flex-wrap gap-2">
              {FACE_FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterConfig((c) => ({ ...c, face: f.id }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filterConfig.face === f.id ? 'bg-[#ffc94d] text-black border-[#ffc94d]' : 'bg-white/[0.05] text-white/70 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {f.emoji} {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {duoPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setDuoPanelOpen(false)}>
          <div className="w-full max-w-sm bg-[#341839] border border-white/[0.08] rounded-[20px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Users size={16} /> Invités {guests.length > 0 ? `(${guests.length})` : ''}
              </h2>
              <button onClick={() => setDuoPanelOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <div className="flex gap-1 mb-4 bg-white/[0.04] rounded-xl p-1">
              {([
                { key: 'viewers', label: 'Spectateurs' },
                { key: 'search', label: 'Rechercher' },
                { key: 'following', label: 'Abonnements' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setInvitePanelTab(tab.key)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    invitePanelTab === tab.key ? 'bg-[#ffc94d] text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {guests.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffc94d]/80 px-1">Invités actuels</p>
                {guests.map((g) => (
                  <div key={g.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#ffc94d]/25 bg-[#ffc94d]/[0.06]">
                    <div className="w-8 h-8 rounded-full bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white/60">
                      {g.avatarUrl ? <img src={g.avatarUrl} alt="" className="w-full h-full object-cover" /> : g.username[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white flex-1 truncate">@{g.username}</span>
                    <button onClick={() => endDuo(g.id)} className="text-[11px] text-white/50 hover:text-white underline shrink-0">
                      Terminer
                    </button>
                  </div>
                ))}
              </div>
            )}

            {duoRequests.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffc94d]/80 px-1">Demandes de duo</p>
                {duoRequests.map((r) => (
                  <div key={r.userId} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#ffc94d]/25 bg-[#ffc94d]/[0.06]">
                    <div className="w-8 h-8 rounded-full bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white/60">
                      {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : r.username[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white flex-1 truncate">@{r.username}</span>
                    <button onClick={() => respondDuoRequest(r.userId, true)} className="w-8 h-8 rounded-full bg-[#ffc94d] text-black flex items-center justify-center shrink-0">
                      <Check size={14} />
                    </button>
                    <button onClick={() => respondDuoRequest(r.userId, false)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {viewRequests.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ffc94d]/80 px-1">Demandes d'accès (live privé)</p>
                {viewRequests.map((r) => (
                  <div key={r.userId} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#ffc94d]/25 bg-[#ffc94d]/[0.06]">
                    <div className="w-8 h-8 rounded-full bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white/60">
                      {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" /> : r.username[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white flex-1 truncate">@{r.username}</span>
                    <button onClick={() => respondViewRequest(r.userId, true)} className="w-8 h-8 rounded-full bg-[#ffc94d] text-black flex items-center justify-center shrink-0">
                      <Check size={14} />
                    </button>
                    <button onClick={() => respondViewRequest(r.userId, false)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {duoInviteStatus === 'inviting' && (
              <p className="text-white/50 text-xs text-center py-3 mb-2 bg-white/[0.04] rounded-xl">
                Invitation envoyée, en attente de réponse…
              </p>
            )}
            {duoInviteStatus === 'declined' && (
              <p className="text-red-400 text-xs text-center py-3 mb-2 bg-red-400/10 rounded-xl">
                Invitation refusée.
              </p>
            )}
            {duoInviteStatus === 'error' && (
              <p className="text-red-400 text-xs text-center py-3 mb-2 bg-red-400/10 rounded-xl">
                {duoErrorMsg}
              </p>
            )}

            {invitePanelTab === 'viewers' && (
              viewersList.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-6">
                  Aucun spectateur connecté pour l'instant.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-hide">
                  {viewersList.map((v) => (
                    <div
                      key={v.userId}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02]"
                    >
                      <div className="w-9 h-9 rounded-full bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white/60">
                        {v.avatarUrl ? <img src={v.avatarUrl} alt="" className="w-full h-full object-cover" /> : v.username[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white flex-1 min-w-0 truncate">@{v.username}</span>
                      {v.muted && (
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full shrink-0">muet</span>
                      )}
                      {/* Actions en ligne plutôt que dans un menu déroulant — un menu absolu
                          dans cette liste défilante se retrouvait coupé/invisible pour les lignes
                          proches du bas, ce qui donnait l'impression que rien n'était cliquable. */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!guests.some((g) => g.id === v.userId) && (
                          <button
                            onClick={() => inviteDuo(v.userId)}
                            disabled={duoInviteStatus === 'inviting'}
                            title="Inviter en duo"
                            className="w-7 h-7 rounded-full flex items-center justify-center border border-white/15 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
                          >
                            <Users2 size={13} />
                          </button>
                        )}
                        {live?.isPrivate && (
                          <button
                            onClick={() => inviteViewer(v.userId)}
                            disabled={grantedViewerIds.has(v.userId)}
                            title={grantedViewerIds.has(v.userId) ? 'Accès autorisé' : 'Autoriser à regarder'}
                            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                              grantedViewerIds.has(v.userId)
                                ? 'border-[#ffc94d]/40 text-[#ffc94d]'
                                : 'border-white/15 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {grantedViewerIds.has(v.userId) ? <Check size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        {gameActive && (
                          <button
                            onClick={() => inviteToGame(v.userId)}
                            disabled={gameInviteSentTo === v.userId}
                            title="Inviter à jouer"
                            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                              gameInviteSentTo === v.userId
                                ? 'border-[#ffc94d]/40 text-[#ffc94d]'
                                : 'border-white/15 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {gameInviteSentTo === v.userId ? <Check size={13} /> : <Gamepad2 size={13} />}
                          </button>
                        )}
                        <button
                          onClick={() => setMuted(v.userId, !v.muted)}
                          title={v.muted ? 'Réactiver le son' : 'Mettre en sourdine'}
                          className="w-7 h-7 rounded-full flex items-center justify-center border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <UserX size={13} />
                        </button>
                        <button
                          onClick={() => kickUser(v.userId)}
                          title="Exclure du live"
                          className="w-7 h-7 rounded-full flex items-center justify-center border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {invitePanelTab === 'search' && (
              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={inviteQuery}
                  onChange={(e) => setInviteQuery(e.target.value)}
                  placeholder="Chercher un pseudo…"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-full px-3.5 py-2 text-white placeholder:text-white/30 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50"
                />
                <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
                  {inviteQuery.trim() && inviteSearchResults.length === 0 && (
                    <p className="text-white/30 text-xs text-center py-4">Aucun résultat.</p>
                  )}
                  {inviteSearchResults.map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      <div className="w-8 h-8 rounded-full bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white/60">
                        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : u.username[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white flex-1 truncate">@{u.username}</span>
                      {live?.isPrivate && (
                        <button
                          onClick={() => inviteViewer(u.id)}
                          disabled={grantedViewerIds.has(u.id)}
                          title={grantedViewerIds.has(u.id) ? 'Accès autorisé' : 'Autoriser à regarder'}
                          className={`w-7 h-7 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                            grantedViewerIds.has(u.id)
                              ? 'border-[#ffc94d]/40 text-[#ffc94d]'
                              : 'border-white/15 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {grantedViewerIds.has(u.id) ? <Check size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => inviteDuo(u.id)}
                        disabled={guests.some((g) => g.id === u.id) || duoInviteStatus === 'inviting'}
                        className="text-[11px] font-semibold text-black bg-[#ffc94d] px-3 py-1.5 rounded-full disabled:opacity-40 shrink-0"
                      >
                        {guests.some((g) => g.id === u.id) ? 'Invité' : 'Inviter'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invitePanelTab === 'following' && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-hide">
                {followingList.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-4">Tu ne suis personne pour l'instant.</p>
                ) : (
                  followingList.map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      <div className="w-8 h-8 rounded-full bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white/60">
                        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : u.username[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white flex-1 truncate">@{u.username}</span>
                      {live?.isPrivate && (
                        <button
                          onClick={() => inviteViewer(u.id)}
                          disabled={grantedViewerIds.has(u.id)}
                          title={grantedViewerIds.has(u.id) ? 'Accès autorisé' : 'Autoriser à regarder'}
                          className={`w-7 h-7 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                            grantedViewerIds.has(u.id)
                              ? 'border-[#ffc94d]/40 text-[#ffc94d]'
                              : 'border-white/15 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {grantedViewerIds.has(u.id) ? <Check size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => inviteDuo(u.id)}
                        disabled={guests.some((g) => g.id === u.id) || duoInviteStatus === 'inviting'}
                        className="text-[11px] font-semibold text-black bg-[#ffc94d] px-3 py-1.5 rounded-full disabled:opacity-40 shrink-0"
                      >
                        {guests.some((g) => g.id === u.id) ? 'Invité' : 'Inviter'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {mobileTopDonorsOpen && (
        <div
          className="md:hidden fixed inset-0 z-[9999] flex items-end bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileTopDonorsOpen(false)}
        >
          <div className="w-full bg-[#341839] border-t border-[#f59e0b]/25 rounded-t-[24px] p-5 max-h-[75vh] overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Trophy size={16} className="text-[#f59e0b]" /> Top donateurs
              </h2>
              <button onClick={() => setMobileTopDonorsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <X size={16} className="text-white" />
              </button>
            </div>
            {topDonors.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-6">Aucun cadeau reçu pour l&apos;instant sur ce live.</p>
            ) : (
              <div className="space-y-1.5">
                {topDonors.map((donor, i) => (
                  <div key={donor.userId} className="flex items-center gap-2.5 px-1 py-1.5">
                    <span className="w-5 text-center text-[13px] font-bold text-white/40 shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold text-white/60">
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
        </div>
      )}

      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#341839] border border-white/[0.08] rounded-[20px] p-5">
            <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-3">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <h2 className="text-white font-bold text-base mb-1.5">Quitter le live en cours ?</h2>
            <p className="text-white/50 text-[13px] leading-relaxed mb-5">
              Si tu changes de page ou navigues ailleurs, ton live sera immédiatement éteint pour tous les spectateurs.
            </p>
            <div className="flex gap-2">
              <button
                onClick={cancelLeave}
                className="flex-1 py-2.5 rounded-full border border-white/10 text-white/70 text-[13px] font-semibold hover:text-white hover:border-white/25 transition-all"
              >
                Rester sur le live
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-all"
              >
                Quitter et éteindre
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
