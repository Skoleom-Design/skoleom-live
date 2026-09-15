import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface MusicSearchResult {
  id: number;
  title: string;
  artist: string;
  albumCover: string;
  previewUrl: string;
}

// Deezer expose une recherche publique sans cle/authentification, mais sans en-tetes CORS —
// un appel direct depuis le navigateur echoue silencieusement, d'ou ce proxy cote serveur.
// Les URLs de preview (30s) renvoyees sont, elles, directement jouables par le navigateur dans
// une balise <audio> (la restriction CORS ne s'applique qu'aux requetes JSON/fetch, pas a la
// lecture media), donc pas besoin de les re-proxier.
//
// ATTENTION : ces URLs de preview sont signees avec une expiration d'environ 15 minutes
// (parametre `exp` dans le hdnea de l'URL, verifie empiriquement). Ne JAMAIS les persister
// (DB, socket state...) au-dela de leur usage immediat — stocker le `id` du morceau et
// rappeler getTrackPreviewUrl() juste avant chaque lecture pour obtenir une URL fraiche.
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search';
const DEEZER_TRACK_URL = 'https://api.deezer.com/track';

@Injectable()
export class MusicService {
  async search(query: string): Promise<MusicSearchResult[]> {
    const { data } = await axios.get(DEEZER_SEARCH_URL, {
      params: { q: query, limit: 15 },
      timeout: 8000,
    });

    return (data.data || [])
      .filter((track: any) => track.preview)
      .map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.artist?.name || '',
        albumCover: track.album?.cover_medium || track.album?.cover || '',
        previewUrl: track.preview,
      }));
  }

  async getTrack(id: string): Promise<MusicSearchResult | null> {
    const { data } = await axios.get(`${DEEZER_TRACK_URL}/${encodeURIComponent(id)}`, { timeout: 8000 });
    if (!data || data.error || !data.preview) return null;
    return {
      id: data.id,
      title: data.title,
      artist: data.artist?.name || '',
      albumCover: data.album?.cover_medium || data.album?.cover || '',
      previewUrl: data.preview,
    };
  }
}
