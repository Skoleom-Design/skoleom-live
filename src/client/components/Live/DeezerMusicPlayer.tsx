import { useEffect, useRef } from 'react';
import { api } from '../../../shared/api/http';

// Musique d'ambiance en live : pas de mixage audio dans le flux LiveKit (ça demanderait de
// re-router l'audio du createur via Web Audio API, hors budget) — a la place, chaque client
// (createur ET spectateurs) charge et joue le MEME extrait Deezer dans son propre navigateur,
// synchronise via l'etat recu par socket (voir lives.gateway.ts#MusicState). Le son n'est donc
// pas "dans" la video du createur mais joue en parallele, cote client.
//
// On ne stocke/broadcast jamais l'URL de preview elle-meme (voir music.service.ts : elle expire
// au bout de ~15min) — seulement le trackId. Ce composant resout une URL fraiche via
// /music/track/:id a chaque fois que le trackId change, jamais avant.
export interface MusicState {
  trackId: string;
  title: string;
  artist: string;
  playing: boolean;
  position: number; // secondes, valables a `updatedAt`
  updatedAt: number; // epoch secondes
}

export function DeezerMusicPlayer({ state, muted = false }: { state: MusicState | null; muted?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.muted = muted;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!state) {
      lastTrackIdRef.current = null;
      audio.pause();
      audio.removeAttribute('src');
      return;
    }

    if (lastTrackIdRef.current !== state.trackId) {
      lastTrackIdRef.current = state.trackId;
      const trackId = state.trackId;
      api.get<{ previewUrl: string } | null>(`/music/track/${trackId}`).then((track) => {
        // La reponse peut arriver apres un nouveau changement de morceau (ou un stop) — on
        // ignore alors ce resultat perime plutot que d'ecraser l'etat courant.
        if (!track?.previewUrl || lastTrackIdRef.current !== trackId) return;
        audio.src = track.previewUrl;
        if (state.playing) audio.play().catch(() => {});
      });
      return;
    }

    if (state.playing) audio.play().catch(() => {});
    else audio.pause();
  }, [state?.trackId, state?.playing]);

  return null;
}
