import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Gavel, Timer, Loader2 } from 'lucide-react';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import { api } from '../shared/api/http';
import type { Capsule } from '../shared/types/api';

interface AuctionLive {
  id: string;
  title?: string;
  mode: 'live' | 'auction';
  creator: { username: string; displayName?: string; avatarUrl?: string };
  auctionCapsule?: Capsule;
  startingBid?: number;
  currentBid?: number;
  auctionEndsAt?: string;
  auctionActive: boolean;
}

function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [seconds, setSeconds] = useState(() => (new Date(endsAt).getTime() - Date.now()) / 1000);

  useEffect(() => {
    const iv = setInterval(() => setSeconds((new Date(endsAt).getTime() - Date.now()) / 1000), 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return <>{fmtCountdown(seconds)}</>;
}

/* ── Auction page — liste les vraies enchères en cours, la mise et le bid en direct
   se passent sur /live/[id] (LiveKit + WebSocket), pas ici. ──────────────────── */
export default function AuctionPage() {
  const [auctions, setAuctions] = useState<AuctionLive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuctionLive[]>('/lives/active')
      .then((lives) => setAuctions(lives.filter((l) => l.mode === 'auction')))
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head><title>skoleomLive — Enchère</title></Head>
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[900px] mx-auto px-4 py-8 pb-20 md:pb-8">
            <h1 className="text-white text-lg font-bold mb-6">Enchères en direct</h1>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-white/30" size={24} />
              </div>
            ) : auctions.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-16">Aucune enchère en direct pour le moment.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {auctions.map((live) => (
                  <Link
                    key={live.id}
                    href={`/live/${live.id}`}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] group hover:border-[#ffc94d]/40 transition-all"
                  >
                    {live.auctionCapsule?.imageUrl ? (
                      <img src={live.auctionCapsule.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gavel size={32} className="text-white/15" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                    <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-extrabold px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </span>

                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-[13px] font-semibold truncate">
                        {live.title || live.auctionCapsule?.name || 'Enchère'}
                      </p>
                      <p className="text-white/50 text-[11px] mb-1.5">@{live.creator.username}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[#ffc94d] font-bold text-[14px]">
                          {(live.currentBid ?? live.startingBid ?? 0).toFixed(2)} €
                        </p>
                        {live.auctionActive && live.auctionEndsAt && (
                          <div className="flex items-center gap-1 text-white/70 text-[11px] font-semibold">
                            <Timer size={11} />
                            <Countdown endsAt={live.auctionEndsAt} />
                          </div>
                        )}
                      </div>
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
