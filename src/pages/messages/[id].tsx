import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Send, MessageCircle } from 'lucide-react';
import type { ConversationSummary, DirectMessage } from '../../shared/types/api';
import { api, ApiError, getToken, getStoredUser } from '../../shared/api/http';
import { getRealtimeSocket } from '../../shared/api/realtime';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { useLanguage } from '../../client/i18n/LanguageContext';

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = router.query as { id: string };
  const myId = getStoredUser()?.id;

  const [otherUser, setOtherUser] = useState<ConversationSummary['otherUser'] | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) { router.replace('/auth/login'); return; }
    if (!id) return;

    Promise.all([
      api.get<DirectMessage[]>(`/messages/conversations/${id}/messages`).catch((): DirectMessage[] => []),
      api.get<ConversationSummary[]>('/messages/conversations').catch((): ConversationSummary[] => []),
    ]).then(([msgs, convs]) => {
      setMessages(msgs);
      setOtherUser(convs.find((c) => c.id === id)?.otherUser ?? null);
    }).finally(() => setLoading(false));

    api.patch(`/messages/conversations/${id}/read`, {}).catch(() => {});
  }, [id, router]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;
    function onMessage(msg: DirectMessage) {
      if (msg.conversationId !== id) return;
      setMessages((prev) => [...prev, msg]);
      api.patch(`/messages/conversations/${id}/read`, {}).catch(() => {});
    }
    socket.on('dm:message', onMessage);
    return () => { socket.off('dm:message', onMessage); };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      const msg = await api.post<DirectMessage>(`/messages/conversations/${id}/messages`, { text: trimmed });
      setMessages((prev) => [...prev, msg]);
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Head><title>{otherUser ? `@${otherUser.username}` : t('messages.title')} — skoleomLive</title></Head>

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="relative flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
          {/* Orbes d'ambiance, tres discrets — la zone de chat reste lisible/dense, pas de
              distraction visuelle derriere les bulles. */}
          <div className="cosmic-orb w-56 h-56 bg-[#ffc94d]/[0.05] -top-16 -right-16 animate-float" style={{ animationDelay: '0s' }} />
          <div className="cosmic-orb w-40 h-40 bg-[#ff5470]/[0.04] bottom-24 -left-10 animate-float" style={{ animationDelay: '-5s' }} />

          <div className="relative z-10 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0 bg-black/20 backdrop-blur-sm">
            <button onClick={() => router.push('/messages')} className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors">
              <ArrowLeft size={16} className="text-white/80" />
            </button>
            {otherUser && (
              <Link href={`/profile/${otherUser.id}`} className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-extrabold text-black bg-gradient-to-br from-[#ffc94d] to-[#ff5470] ring-1 ring-white/10">
                  {otherUser.avatarUrl ? (
                    <img src={otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    otherUser.username[0]?.toUpperCase()
                  )}
                </div>
                <p className="text-[14px] font-semibold text-white truncate">{otherUser.displayName || otherUser.username}</p>
              </Link>
            )}
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide px-4 py-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/15 border-t-[#ffc94d] rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center py-20 text-white/40 text-sm">
                <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <MessageCircle size={22} className="text-white/25" />
                </div>
                {t('messages.noMessagesYet')}
              </div>
            ) : (
              <div className="max-w-[640px] mx-auto space-y-2">
                {messages.map((m) => {
                  const mine = m.senderId === myId;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-[20px] text-[13px] leading-snug ${
                        mine
                          ? 'bg-gradient-to-br from-[#ffc94d] to-[#ff5470] text-black shadow-[0_0_16px_rgba(255, 201, 77,0.18)]'
                          : 'bg-white/[0.07] border border-white/[0.08] text-white'
                      }`}>
                        {m.text}
                        <span className={`block text-[10px] mt-1 ${mine ? 'text-black/50' : 'text-white/35'}`}>
                          {formatTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="relative z-10 shrink-0 px-4 py-3.5 border-t border-white/[0.06] bg-black/20 backdrop-blur-sm pb-[max(14px,env(safe-area-inset-bottom))]">
            <div className="max-w-[640px] mx-auto flex items-center gap-2.5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('messages.typeMessage')}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-4 py-2.5 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="btn-skoleom w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 disabled:shadow-none transition-all hover:shadow-glow-lime-sm"
              >
                <Send size={16} />
              </button>
            </div>
            {error && <p className="max-w-[640px] mx-auto text-red-400 text-xs mt-2">{error}</p>}
          </form>
        </main>
      </div>
    </>
  );
}
