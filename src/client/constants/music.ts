export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  url: string;
}

// Bibliotheque de musiques attachables a un post — pistes placeholder generees pour tester le
// mecanisme (selection, apercu, lecture dans le feed). A remplacer par de vraies pistes libres
// de droit (ex: Pixabay Music, YouTube Audio Library) en gardant les memes noms de fichiers
// dans /public/music, ou en ajoutant nom/URL ici.
export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: 'chill-vibes', name: 'Chill Vibes', artist: 'skoleomLive', url: '/music/chill-vibes.wav' },
  { id: 'upbeat-loop', name: 'Upbeat Loop', artist: 'skoleomLive', url: '/music/upbeat-loop.wav' },
  { id: 'lofi-beat', name: 'Lo-fi Beat', artist: 'skoleomLive', url: '/music/lofi-beat.wav' },
];
