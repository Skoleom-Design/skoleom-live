import { api } from './http';

interface MusicSource {
  musicTrackId?: string;
  musicUrl?: string;
}

// Les URLs de preview Deezer expirent au bout de ~15min (voir music.service.ts cote serveur) —
// jamais fiable de rejouer post.musicUrl tel quel une fois le post un peu ancien. On repasse par
// l'id du morceau pour obtenir une URL fraiche ; musicUrl ne sert que de filet pour les posts
// publies avant l'ajout de musicTrackId (ou si Deezer est momentanement indisponible).
export async function resolveMusicUrl(source: MusicSource): Promise<string | null> {
  if (source.musicTrackId) {
    try {
      const track = await api.get<{ previewUrl: string } | null>(`/music/track/${source.musicTrackId}`);
      if (track?.previewUrl) return track.previewUrl;
    } catch {
      // on retombe sur le fallback ci-dessous
    }
  }
  return source.musicUrl || null;
}
