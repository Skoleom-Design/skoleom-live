import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Radio, Loader2, Lock } from 'lucide-react';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { api } from '../shared/api/http';
import type { Capsule } from '../shared/types/api';

interface ActiveLive {
  id: string;
  title?: string;
  mode: 'live' | 'auction';
  creator: { username: string; displayName?: string; avatarUrl?: string };
  featuredCapsule?: Capsule;
  isPrivate?: boolean;
}

/* ── Live page — liste les vrais lives classiques en cours ; la diffusion, le chat et la
   vente de capsules (file de vente) se passent sur /live/[id]. ────────────────────────── */
export default function LivePage() {
  const [lives, setLives] = useState<ActiveLive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ActiveLive[]>('/lives/active')
      .then((all) => setLives(all.filter((l) => l.mode === 'live')))
      .catch(() => setLives([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head><title>skoleomLive — Live</title></Head>
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[900px] mx-auto px-4 py-8 pb-20 md:pb-8">
            <h1 className="text-white text-lg font-bold mb-6">Lives en direct</h1>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-white/30" size={24} />
              </div>
            ) : lives.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-16">Aucun live en direct pour le moment.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {lives.map((live) => (
                  <Link
                    key={live.id}
                    href={`/live/${live.id}`}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] group hover:border-[#ffc94d]/40 transition-all"
                  >
                    {live.featuredCapsule?.imageUrl ? (
                      <img src={live.featuredCapsule.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio size={32} className="text-white/15" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                    <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-extrabold px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </span>
                    {live.isPrivate && (
                      <span className="absolute top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60">
                        <Lock size={11} className="text-white/80" />
                      </span>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-[13px] font-semibold truncate">
                        {live.title || live.featuredCapsule?.name || 'Live'}
                      </p>
                      <p className="text-white/50 text-[11px] mb-1.5">@{live.creator.username}</p>
                      {live.featuredCapsule && (
                        <p className="text-[#ffc94d] font-bold text-[14px]">
                          {live.featuredCapsule.price.toFixed(2)} €
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
