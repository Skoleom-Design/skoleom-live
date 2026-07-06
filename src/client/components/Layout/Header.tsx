import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Search, PlusSquare, User } from 'lucide-react';

const NAV = [
  { href: '/', icon: Home, label: 'Feed' },
  { href: '/explore', icon: Search, label: 'Explorer' },
  { href: '/studio', icon: PlusSquare, label: 'Publier' },
  { href: '/profile/me', icon: User, label: 'Profil' },
];

export function Header() {
  const router = useRouter();

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-surface-card/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-black text-brand">skoleomLive</span>
          <span className="text-xs text-gray-500 font-normal">Discover &amp; Shop</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-brand/10 text-brand' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/admin" className="text-xs text-gray-500 hover:text-white transition-colors">
          Admin ⚙️
        </Link>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-card/90 backdrop-blur-md border-t border-white/5 flex items-center justify-around py-2 px-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-colors ${
                active ? 'text-brand' : 'text-gray-500'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
