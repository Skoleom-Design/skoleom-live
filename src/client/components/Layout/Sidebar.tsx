import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Orbit, Video, User, PlusCircle, ShieldAlert, Gavel, Send } from 'lucide-react';
import { GuideButton } from '../Guide/GuideModal';
import { api, getStoredUser, getToken } from '../../../shared/api/http';
import { getRealtimeSocket } from '../../../shared/api/realtime';
import { useLanguage } from '../../i18n/LanguageContext';

const NOTIFICATIONS_POLL_MS = 30_000;

export function AppSidebar() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const user = getStoredUser();
    setIsAdmin(user?.role === 'admin');
    setAvatarUrl(user?.avatarUrl);
  }, []);

  // Le polling reste le filet de securite (fonctionne meme si le socket temps reel a rate un
  // evenement) ; le socket ci-dessous rend juste le badge instantane au lieu d'attendre le
  // prochain intervalle.
  useEffect(() => {
    if (!getToken()) return;
    function fetchCounts() {
      api.get<{ count: number }>('/notifications/unread-count').then((res) => setUnreadCount(res.count)).catch(() => {});
      api.get<{ count: number }>('/messages/unread-count').then((res) => setUnreadMessages(res.count)).catch(() => {});
    }
    fetchCounts();
    const interval = setInterval(fetchCounts, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;
    const onNotification = () => setUnreadCount((c) => c + 1);
    const onMessage = () => {
      if (router.pathname.startsWith('/messages')) return;
      setUnreadMessages((c) => c + 1);
    };
    socket.on('notification', onNotification);
    socket.on('dm:message', onMessage);
    return () => {
      socket.off('notification', onNotification);
      socket.off('dm:message', onMessage);
    };
  }, [router.pathname]);

  // Le marquage "lu" se fait desormais uniquement en ouvrant l'onglet Notifications du profil
  // (voir profile/me.tsx) — visiter /profile/me sur un autre onglet (Posts, Wallet...) ne doit
  // plus effacer le badge sans que l'utilisateur ait reellement vu ses notifications.

  // Visiter la messagerie remet a zero le badge — chaque conversation ouverte marque ses
  // propres messages comme lus (voir pages/messages/[id].tsx), ce badge ne fait que suivre.
  useEffect(() => {
    if (router.pathname.startsWith('/messages') && unreadMessages > 0) {
      setUnreadMessages(0);
    }
  }, [router.pathname, unreadMessages]);

  // Home/loupe/carre+ sont les pictogrammes exacts d'Instagram — Orbit rattache "Explorer" au
  // theme Univers cosmique de la DA, et un rond+ (au lieu d'un carre+) suffit a rompre la ressemblance.
  const NAV = [
    { href: '/live', icon: Video, label: t('sidebar.live') },
    { href: '/enchere', icon: Gavel, label: t('sidebar.auction') },
    { href: '/', icon: Orbit, label: t('sidebar.explore') },
    ...(isAdmin ? [] : [{ href: '/messages', icon: Send, label: t('sidebar.messages'), badge: unreadMessages }]),
    ...(isAdmin ? [] : [{ href: '/studio', icon: PlusCircle, label: t('sidebar.studio') }]),
    isAdmin
      ? { href: '/admin', icon: ShieldAlert, label: t('sidebar.profile') }
      : { href: '/profile/me', icon: User, label: t('sidebar.profile'), avatarUrl, badge: unreadCount },
  ];

  return (
    <>
      <DesktopSidebar NAV={NAV} router={router} />
      <MobileNavBar NAV={NAV} router={router} />
    </>
  );
}

type NavItem = {
  href: string;
  icon: typeof Orbit;
  label: string;
  disabled?: boolean;
  avatarUrl?: string;
  badge?: number;
};

function DesktopSidebar({
  NAV,
  router,
}: {
  NAV: NavItem[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <aside className="cosmic-bg relative hidden md:flex flex-col w-[272px] h-full px-3 py-5 shrink-0 overflow-hidden">
      {/* Bordure droite en filet degrade, au lieu d'un trait plat */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#ffc94d]/25 to-transparent" />

      {/* Orbes d'ambiance — tres discrets, juste pour donner de la profondeur au fond */}
      <div className="cosmic-orb w-24 h-24 bg-[#ff5470]/10 -top-6 -right-10 animate-float" style={{ animationDelay: '0s' }} />
      <div className="cosmic-orb w-20 h-20 bg-[#ffc94d]/[0.06] bottom-16 -left-8 animate-float" style={{ animationDelay: '-3s' }} />

      <div className="relative px-3 pb-7 pt-2 flex items-center gap-2.5">
        <div className="relative shrink-0">
          <div className="absolute -inset-2 rounded-full bg-skoleom-gradient-warm opacity-20 blur-xl animate-pulse-glow" />
          <img src="/logo.png" alt="skoleomLive" className="relative h-8 object-contain" />
        </div>
      </div>

      <nav className="relative flex-1 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);
          const avatar = 'avatarUrl' in item ? item.avatarUrl : undefined;
          const disabled = 'disabled' in item && item.disabled;

          const content = (
            <>
              {/* Chaque icone vit dans sa propre pastille — pas un glyphe nu flottant a cote
                  du libelle comme sur Insta/X/LinkedIn. */}
              <span
                className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  disabled ? 'bg-white/[0.03] border border-white/[0.06]' : isActive ? 'bg-black/15' : 'bg-white/[0.06] border border-white/10'
                }`}
              >
                {avatar ? (
                  <span className={`w-full h-full rounded-full overflow-hidden ${isActive ? 'ring-2 ring-black/30' : 'ring-1 ring-white/20'}`}>
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  </span>
                ) : (
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    fill={isActive ? 'currentColor' : 'none'}
                    fillOpacity={isActive ? 0.18 : undefined}
                  />
                )}
                {(item.badge ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-black/80" />
                )}
              </span>
              {item.label}
            </>
          );

          if (disabled) {
            return (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center gap-3.5 pl-2 pr-5 py-2 rounded-full text-base font-normal text-white/25 cursor-not-allowed select-none"
              >
                {content}
              </span>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3.5 pl-2 pr-5 py-2 rounded-full text-base transition-all ${
                isActive
                  ? 'font-bold text-black bg-skoleom-gradient-warm shadow-glow-lime-sm'
                  : 'font-normal text-white/80 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {content}
            </Link>
          );
        })}
        <GuideButton />
      </nav>
    </aside>
  );
}

// Barre de nav mobile — la sidebar est entierement masquee sous md (768px), sans cette barre
// il n'y a plus aucun moyen de naviguer sur telephone/tablette portrait. Fixed + icones seules
// (pas de libelle texte, pas de place) ; meme seuil `md` que la sidebar desktop, pour ne jamais
// avoir les deux caches ou les deux visibles en meme temps.
function MobileNavBar({
  NAV,
  router,
}: {
  NAV: NavItem[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <nav className="cosmic-bg md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t border-white/10 px-1 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);
        const disabled = item.disabled;

        const iconEl = (
          <span className="relative w-7 h-7 rounded-full flex items-center justify-center">
            {item.avatarUrl ? (
              <span className={`w-full h-full rounded-full overflow-hidden ${isActive ? 'ring-2 ring-[#ffc94d]' : 'ring-1 ring-white/20'}`}>
                <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
              </span>
            ) : (
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.75}
                fill={isActive ? 'currentColor' : 'none'}
                fillOpacity={isActive ? 0.15 : undefined}
                className={disabled ? 'text-white/25' : isActive ? 'text-[#ffc94d]' : 'text-white/70'}
              />
            )}
            {(item.badge ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-black/80" />
            )}
          </span>
        );

        if (disabled) {
          return (
            <span key={item.label} aria-disabled="true" className="flex flex-col items-center justify-center flex-1 py-1 cursor-not-allowed select-none">
              {iconEl}
            </span>
          );
        }

        return (
          <Link key={item.label} href={item.href} className="flex flex-col items-center justify-center flex-1 py-1">
            {iconEl}
          </Link>
        );
      })}
    </nav>
  );
}
