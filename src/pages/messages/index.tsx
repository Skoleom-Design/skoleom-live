import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { MessageCircle } from 'lucide-react';
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

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[560px] mx-auto px-4 py-8 pb-20 md:pb-8">
            <h1 className="text-[20px] font-extrabold text-white mb-6">{t('messages.title')}</h1>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/20 border-t-[#a8ff35] rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-16 text-white/40 text-sm flex flex-col items-center gap-2">
                <MessageCircle size={28} className="text-white/20" />
                {t('messages.noConversations')}
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/messages/${c.id}`}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${c.unreadCount > 0 ? 'bg-white/[0.04] hover:bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                  >
                    <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {c.otherUser.avatarUrl ? (
                        <img src={c.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white/70 text-sm font-bold">{c.otherUser.username[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">
                        {c.otherUser.displayName || c.otherUser.username}
                      </p>
                      <p className={`text-[12px] truncate ${c.unreadCount > 0 ? 'text-white/80' : 'text-white/40'}`}>
                        {c.lastMessageText || '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {c.lastMessageAt && <span className="text-[11px] text-white/30">{timeAgo(c.lastMessageAt)}</span>}
                      {c.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#a8ff35] text-black text-[10px] font-bold flex items-center justify-center">
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
