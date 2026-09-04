import { useEffect, useRef } from 'react';

// Musique d'ambiance en live, version simple : pas de mixage audio dans le flux LiveKit (ça
// demanderait de re-router l'audio du createur via Web Audio API, hors budget) — a la place,
// chaque client (createur ET spectateurs) charge et joue la MEME video YouTube dans son propre
// navigateur, synchronisee via l'etat recu par socket (voir lives.gateway.ts#MusicState). Le son
// n'est donc pas "dans" la video du createur mais joue en parallele, cote client.

export interface MusicState {
  youtubeId: string;
  playing: boolean;
  position: number; // secondes, valables a `updatedAt`
  updatedAt: number; // epoch secondes
}

// Reconnait un ID brut (11 caracteres) ou une URL youtube.com/youtu.be classique, y compris
// /shorts/. Retourne null si rien d'exploitable n'a ete reconnu (l'appelant garde alors le champ
// tel quel et affiche une erreur plutot que d'envoyer un id invalide au serveur).
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch {
    return null;
  }
  return null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;
function loadYoutubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
  });
  return apiLoadPromise;
}

export function YoutubeMusicPlayer({ state, elementId, muted = false }: { state: MusicState | null; elementId: string; muted?: boolean }) {
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    let disposed = false;
    loadYoutubeApi().then(() => {
      if (disposed) return;
      playerRef.current = new window.YT.Player(elementId, {
        height: '100%',
        width: '100%',
        playerVars: { playsinline: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            // Reflete le prop `muted` a cet instant : si l'appelant demarre deja "actif" (un vrai
            // geste utilisateur vient de se produire, ex. le createur qui clique "Lancer"),
            // l'autoplay non-muet passe. Sinon (un spectateur qui rejoint sans geste "frais" sur
            // CE client), on reste muet par defaut — meme principe que `soundBlocked` pour
            // l'audio LiveKit ailleurs sur cette page, avec un bouton explicite pour reactiver.
            if (mutedRef.current) playerRef.current.mute?.();
            else playerRef.current.unMute?.();
            applyState(stateRef.current);
          },
        },
      });
    });
    return () => {
      disposed = true;
      readyRef.current = false;
      playerRef.current?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (muted) playerRef.current?.mute?.();
    else playerRef.current?.unMute?.();
  }, [muted]);

  function applyState(next: MusicState | null) {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    if (!next) {
      lastIdRef.current = null;
      player.stopVideo?.();
      return;
    }
    const elapsed = next.playing ? Date.now() / 1000 - next.updatedAt : 0;
    const targetSeconds = Math.max(0, next.position + elapsed);

    if (lastIdRef.current !== next.youtubeId) {
      lastIdRef.current = next.youtubeId;
      player.loadVideoById(next.youtubeId, targetSeconds);
      if (!next.playing) setTimeout(() => player.pauseVideo?.(), 400);
      return;
    }
    if (next.playing) {
      const current = player.getCurrentTime?.() ?? targetSeconds;
      if (Math.abs(current - targetSeconds) > 1.5) player.seekTo(targetSeconds, true);
      player.playVideo?.();
    } else {
      player.seekTo(targetSeconds, true);
      player.pauseVideo?.();
    }
  }

  useEffect(() => {
    applyState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.youtubeId, state?.playing, state?.position, state?.updatedAt]);

  return <div id={elementId} className="w-full h-full" />;
}
