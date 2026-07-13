import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard, Users, Film, Zap, DollarSign, Trophy, Gift, Video, Home,
  LogOut, ArrowLeft, ShieldAlert,
} from 'lucide-react';
import { clearSession, getToken, getStoredUser } from '../../../shared/api/http';

const NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { href: '/admin/posts', icon: Film, label: 'Posts' },
  { href: '/admin/boosts', icon: Zap, label: 'Boosts' },
  { href: '/admin/commissions', icon: DollarSign, label: 'Commissions' },
  { href: '/admin/top-creators', icon: Trophy, label: 'Top créateurs' },
  { href: '/admin/top-donors', icon: Gift, label: 'Top donateurs' },
  { href: '/live', icon: Video, label: 'Live' },
  { href: '/', icon: Home, label: 'Feed' },
];

export function AdminSidebar() {
  const router = useRouter();

  // Aucune page /admin/* ne vérifiait l'authentification avant de s'afficher — seul l'appel
  // API échouait silencieusement en 401. Le shell (sidebar, layout) restait visible même
  // sans session valide. Comme ce composant est monté sur toutes les pages admin, la garde
  // est centralisée ici plutôt que dupliquée dans chaque page.
  useEffect(() => {
    if (!getToken() || getStoredUser()?.role !== 'admin') {
      router.replace('/auth/login');
    }
  }, []);

  function handleLogout() {
    clearSession();
    router.push('/auth/login');
  }

  return (
    <aside className="hidden md:flex flex-col w-[240px] h-screen sticky top-0 bg-black border-r border-[#f59e0b]/[0.15] px-3 py-5 shrink-0">
      <div className="flex items-center gap-2 px-3 pb-1 pt-2">
        <img src="/skoleom-mark.png" alt="" className="h-6 object-contain" />
        <span className="text-white font-bold text-sm">skoleomLive</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 pb-5 mt-1">
        <ShieldAlert size={13} className="text-[#f59e0b]" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">Espace admin</span>
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all ${
                active
                  ? 'font-bold text-[#f59e0b] bg-[#f59e0b]/[0.1]'
                  : 'font-normal text-white/70 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.07] pt-3 mt-2 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-white/50 hover:text-white hover:bg-white/[0.05] transition-all"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Retour à l&apos;app
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
        >
          <LogOut size={16} strokeWidth={1.75} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
