import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Send } from 'lucide-react';
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

        <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
            <button onClick={() => router.push('/messages')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
              <ArrowLeft size={16} className="text-white" />
            </button>
            {otherUser && (
              <Link href={`/profile/${otherUser.id}`} className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {otherUser.avatarUrl ? (
                    <img src={otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white/70 text-xs font-bold">{otherUser.username[0]?.toUpperCase()}</span>
                  )}
                </div>
                <p className="text-[14px] font-semibold text-white truncate">{otherUser.displayName || otherUser.username}</p>
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/20 border-t-[#a8ff35] rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16 text-white/40 text-sm">{t('messages.noMessagesYet')}</div>
            ) : (
              <div className="max-w-[640px] mx-auto space-y-1.5">
                {messages.map((m) => {
                  const mine = m.senderId === myId;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-[13px] leading-snug ${
                        mine ? 'bg-[#a8ff35] text-black' : 'bg-white/[0.08] text-white'
                      }`}>
                        {m.text}
                        <span className={`block text-[10px] mt-0.5 ${mine ? 'text-black/50' : 'text-white/35'}`}>
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

          <form onSubmit={handleSend} className="shrink-0 px-4 py-3 border-t border-white/[0.06] pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="max-w-[640px] mx-auto flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('messages.typeMessage')}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-4 py-2.5 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="w-10 h-10 rounded-full bg-[#a8ff35] flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              >
                <Send size={16} className="text-black" />
              </button>
            </div>
            {error && <p className="max-w-[640px] mx-auto text-red-400 text-xs mt-2">{error}</p>}
          </form>
        </main>
      </div>
    </>
  );
}
