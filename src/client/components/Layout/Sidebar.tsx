import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Compass, Search, Video, User, Settings2, PlusCircle, ShieldAlert } from 'lucide-react';
import { GuideButton } from '../Guide/GuideModal';
import { getStoredUser } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';

export function AppSidebar() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const user = getStoredUser();
    setIsAdmin(user?.role === 'admin');
    setAvatarUrl(user?.avatarUrl);
  }, []);

  // Home/loupe/carre+ sont les pictogrammes exacts d'Instagram — Compass colle en plus au sens
  // du label "Explorer", et un rond+ (au lieu d'un carre+) suffit a rompre la ressemblance.
  const NAV = [
    { href: '/live', icon: Video, label: t('sidebar.live') },
    { href: '/', icon: Compass, label: t('sidebar.explore') },
    { href: '/explore', icon: Search, label: t('sidebar.search') },
    ...(isAdmin ? [] : [{ href: '/studio', icon: PlusCircle, label: t('sidebar.studio') }]),
    isAdmin
      ? { href: '/admin', icon: ShieldAlert, label: t('sidebar.profile') }
      : { href: '/profile/me', icon: User, label: t('sidebar.profile'), avatarUrl },
  ];

  return (
    <aside className="cosmic-bg relative hidden md:flex flex-col w-[244px] h-full px-3 py-5 shrink-0 overflow-hidden">
      {/* Bordure droite en filet degrade, au lieu d'un trait plat */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#a8ff35]/25 to-transparent" />

      {/* Orbes d'ambiance — tres discrets, juste pour donner de la profondeur au fond */}
      <div className="cosmic-orb w-24 h-24 bg-[#00ffff]/10 -top-6 -right-10 animate-float" style={{ animationDelay: '0s' }} />
      <div className="cosmic-orb w-20 h-20 bg-[#faee21]/[0.06] bottom-16 -left-8 animate-float" style={{ animationDelay: '-3s' }} />

      <div className="relative px-3 pb-6 pt-2">
        <div className="absolute left-1 top-0 w-11 h-11 rounded-full bg-skoleom-gradient-warm opacity-25 blur-xl animate-pulse-glow" />
        <img src="/skoleom-mark.png" alt="skoleomLive" className="relative h-7 object-contain" />
      </div>

      <nav className="relative flex-1 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);
          const avatar = 'avatarUrl' in item ? item.avatarUrl : undefined;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-[15px] transition-all ${
                isActive
                  ? 'font-bold text-black bg-skoleom-gradient-warm shadow-glow-lime-sm'
                  : 'font-normal text-white/80 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {avatar ? (
                <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 ${isActive ? 'ring-2 ring-black/30' : 'ring-1 ring-white/20'}`}>
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  fill={isActive ? 'currentColor' : 'none'}
                  fillOpacity={isActive ? 0.18 : undefined}
                />
              )}
              {item.label}
            </Link>
          );
        })}
        <GuideButton />
      </nav>

      {!isAdmin && (
        <div className="relative border-t border-white/[0.06] pt-3 mt-2">
          <Link
            href="/admin"
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-[15px] text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <Settings2 size={22} strokeWidth={1.75} />
            {t('sidebar.admin')}
          </Link>
        </div>
      )}
    </aside>
  );
}
