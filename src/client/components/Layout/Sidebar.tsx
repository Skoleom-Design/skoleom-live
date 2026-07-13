import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Search, Video, User, Settings2, PlusSquare, ShieldAlert } from 'lucide-react';
import { GuideButton } from '../Guide/GuideModal';
import { getStoredUser } from '../../../shared/api/http';

export function AppSidebar() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(getStoredUser()?.role === 'admin');
  }, []);

  const NAV = [
    { href: '/live', icon: Video, label: 'Live' },
    { href: '/', icon: Home, label: 'Explorer' },
    { href: '/explore', icon: Search, label: 'Rechercher' },
    ...(isAdmin ? [] : [{ href: '/studio', icon: PlusSquare, label: 'Studio' }]),
    isAdmin
      ? { href: '/admin', icon: ShieldAlert, label: 'Profil' }
      : { href: '/profile/me', icon: User, label: 'Profil' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-[244px] h-full bg-black border-r border-white/[0.06] px-3 py-5 shrink-0">
      <div className="px-3 pb-6 pt-2">
        <img src="/skoleom-mark.png" alt="skoleomLive" className="h-7 object-contain" />
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-[15px] transition-all ${
                isActive
                  ? 'font-bold text-[#a8ff35] bg-[#a8ff35]/[0.08] shadow-glow-lime-sm'
                  : 'font-normal text-white/80 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.75} />
              {item.label}
            </Link>
          );
        })}
        <GuideButton />
      </nav>

      {!isAdmin && (
        <div className="border-t border-white/[0.06] pt-3 mt-2">
          <Link
            href="/admin"
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-[15px] text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <Settings2 size={22} strokeWidth={1.75} />
            Admin
          </Link>
        </div>
      )}
    </aside>
  );
}
