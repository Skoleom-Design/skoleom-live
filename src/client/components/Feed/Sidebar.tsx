import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Search, User, Settings2 } from 'lucide-react';

export function Sidebar() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('skoleom:authToken'));
  }, [router.pathname]);

  const NAV = [
    { href: '/', icon: Home, label: 'Feed' },
    { href: '/explore', icon: Search, label: 'Explorer' },
    { href: isLoggedIn ? '/profile/me' : '/auth/login', icon: User, label: 'Profil' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-full bg-surface-card border-r border-white/5 p-4 pt-16">
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? router.pathname === '/'
              : router.pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand/10 text-brand'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 pt-4 mt-4">
        <Link
          href="/admin"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings2 size={20} strokeWidth={1.75} />
          Admin
        </Link>
      </div>
    </aside>
  );
}
