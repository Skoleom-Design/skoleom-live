import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Send } from 'lucide-react';
import type { ConversationSummary } from '../../shared/types/api';
import { api, getToken } from '../../shared/api/http';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { useLanguage } from '../../client/i18n/LanguageContext';

function timeAgo(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export default function MessagesIndexPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth/login'); return; }
    api.get<ConversationSummary[]>('/messages/conversations').then(setConversations).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <Head><title>{t('messages.title')} — skoleomLive</title></Head>

      <div className="flex h-screen cosmic-bg overflow-hidden relative">
        {/* Orbes d'ambiance — meme traitement que la sidebar/le studio, pour ne pas laisser
            cette page a plat par rapport au reste de l'app. */}
        <div className="cosmic-orb w-40 h-40 bg-[#a8ff35]/[0.07] -top-10 right-10 animate-float" style={{ animationDelay: '0s' }} />
        <div className="cosmic-orb w-32 h-32 bg-[#00ffff]/[0.05] bottom-10 left-1/3 animate-float" style={{ animationDelay: '-4s' }} />

        <AppSidebar />

        <main className="relative flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[560px] mx-auto px-4 py-8 pb-20 md:pb-8">
            <h1 className="display-text text-gradient text-[28px] mb-6">{t('messages.title')}</h1>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-7 h-7 border-2 border-white/15 border-t-[#a8ff35] rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-20 text-white/40 text-sm flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Send size={22} className="text-white/25" />
                </div>
                {t('messages.noConversations')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/messages/${c.id}`}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 border transition-all ${
                      c.unreadCount > 0
                        ? 'bg-white/[0.05] border-white/[0.1] hover:border-[#a8ff35]/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-extrabold text-black bg-gradient-to-br from-[#a8ff35] to-[#6fe600] ${
                      c.unreadCount > 0 ? 'ring-2 ring-[#a8ff35]/50 ring-offset-2 ring-offset-black' : ''
                    }`}>
                      {c.otherUser.avatarUrl ? (
                        <img src={c.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.otherUser.username[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">
                        {c.otherUser.displayName || c.otherUser.username}
                      </p>
                      <p className={`text-[12.5px] truncate ${c.unreadCount > 0 ? 'text-white/75' : 'text-white/40'}`}>
                        {c.lastMessageText || '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {c.lastMessageAt && <span className="text-[11px] text-white/30">{timeAgo(c.lastMessageAt)}</span>}
                      {c.unreadCount > 0 && (
                        <span className="min-w-[19px] h-[19px] px-1 rounded-full bg-gradient-to-br from-[#a8ff35] to-[#6fe600] text-black text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(168,255,53,0.5)]">
                          {c.unreadCount}
                        </span>
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
