import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  type LucideIcon,
  BarChart3, Bell, BookMarked, BookOpen, Bot, Brain, Building2,
  Calendar, ClipboardList, Cloud, Coins, Cpu, CreditCard, Dumbbell,
  FileScan, FileSpreadsheet, FileText, Film, Gamepad2, GraduationCap,
  HardDrive, History, Heart, Hotel, KeyRound, Landmark, LayoutGrid,
  Layers, Library, Mail, Megaphone, MessageSquare, Mic, Music,
  Newspaper, Package, Palette, Plane, Presentation, QrCode, Radio,
  Receipt, Server, Settings2, Share2, Shield, Shirt, ShoppingCart,
  Sparkles, Store, TrendingUp, Tv, Umbrella, User, UserPlus, Users,
  Video, Wallet2, Wrench,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  user: User, wallet2: Wallet2, receipt: Receipt, settings2: Settings2,
  shield: Shield, history: History, heart: Heart, layers: Layers,
  palette: Palette, cpu: Cpu, sparkles: Sparkles, brain: Brain, bot: Bot,
  megaphone: Megaphone, messageSquare: MessageSquare, mail: Mail,
  video: Video, tv: Tv, share2: Share2, radio: Radio, store: Store,
  shirt: Shirt, dumbbell: Dumbbell, music: Music, film: Film,
  gamepad2: Gamepad2, laptop: Cpu, home: Layers, shoppingCart: ShoppingCart,
  users2: Users, package: Package, barChart3: BarChart3, building2: Building2,
  userPlus: UserPlus, fileText: FileText, creditCard: CreditCard,
  hardDrive: HardDrive, fileSpreadsheet: FileSpreadsheet,
  presentation: Presentation, clipboardList: ClipboardList, calendar: Calendar,
  bookMarked: BookMarked, trendingUp: TrendingUp, landmark: Landmark,
  coins: Coins, umbrella: Umbrella, cloud: Cloud, gradCap: GraduationCap,
  bookOpen: BookOpen, library: Library, kids: Sparkles, plane: Plane,
  hotel: Hotel, mic: Mic, newspaper: Newspaper, server: Server,
  fileScan: FileScan, qrCode: QrCode, keyRound: KeyRound, wrench: Wrench,
  bell: Bell, users: Users,
};

interface LinkItem { label: string; href: string; iconKey: string }
interface Column { title: string; tileClass: string; links: readonly LinkItem[] }

const COLUMNS: readonly Column[] = [
  {
    title: 'MON UNIVERS', tileClass: 'from-amber-300/95 to-amber-600/90',
    links: [
      { label: 'Mon compte', href: '/profile/me', iconKey: 'user' },
      { label: 'Skoleom Wallet', href: '#', iconKey: 'wallet2' },
      { label: 'Abonnements', href: '#', iconKey: 'receipt' },
      { label: 'Préférences', href: '#', iconKey: 'settings2' },
      { label: 'Sécurité', href: '#', iconKey: 'shield' },
      { label: 'Historique', href: '#', iconKey: 'history' },
      { label: 'Favoris', href: '#', iconKey: 'heart' },
      { label: 'Collections', href: '#', iconKey: 'layers' },
    ],
  },
  {
    title: 'CRÉATION & IA', tileClass: 'from-violet-400/95 to-fuchsia-600/90',
    links: [
      { label: 'skoleomLive Studio', href: '/profile/me', iconKey: 'palette' },
      { label: 'SeSync', href: '#', iconKey: 'sparkles' },
      { label: 'Skoleom Pulse', href: '#', iconKey: 'cpu' },
      { label: 'AI Studio', href: '#', iconKey: 'brain' },
      { label: 'Skoleom GPT', href: '#', iconKey: 'bot' },
      { label: 'AI Image Studio', href: '#', iconKey: 'palette' },
      { label: 'AI Video Studio', href: '#', iconKey: 'video' },
      { label: 'AI Voice Studio', href: '#', iconKey: 'mic' },
      { label: 'AI Music Studio', href: '#', iconKey: 'music' },
    ],
  },
  {
    title: 'COMMUNICATION & RÉSEAUX', tileClass: 'from-emerald-400/95 to-teal-600/90',
    links: [
      { label: 'Skoleom Chat', href: '#', iconKey: 'messageSquare' },
      { label: 'Skoleom Mail', href: '#', iconKey: 'mail' },
      { label: 'Skoleom Meet', href: '#', iconKey: 'video' },
      { label: 'Skoleom Spaces', href: '#', iconKey: 'users' },
      { label: 'Skoleom Connect', href: '#', iconKey: 'share2' },
      { label: 'Skoleom Live', href: '/', iconKey: 'radio' },
      { label: 'Skoleom Broadcast', href: '#', iconKey: 'tv' },
      { label: 'Skoleom Social Hub', href: '#', iconKey: 'megaphone' },
    ],
  },
  {
    title: 'BOUTIQUES AUDIOVISUELLES', tileClass: 'from-orange-400/95 to-red-600/85',
    links: [
      { label: 'Toutes les boutiques', href: '#', iconKey: 'store' },
      { label: 'Mode & Style', href: '#', iconKey: 'shirt' },
      { label: 'Sport', href: '#', iconKey: 'dumbbell' },
      { label: 'Musique', href: '#', iconKey: 'music' },
      { label: 'Films & Séries', href: '#', iconKey: 'film' },
      { label: 'Jeux Vidéo', href: '#', iconKey: 'gamepad2' },
      { label: 'Technologie', href: '#', iconKey: 'laptop' },
      { label: 'Maison & Living', href: '#', iconKey: 'home' },
    ],
  },
  {
    title: 'BUSINESS & MONÉTISATION', tileClass: 'from-sky-400/95 to-blue-700/90',
    links: [
      { label: 'Skoleom Shop', href: '#', iconKey: 'shoppingCart' },
      { label: 'Skoleom Ads', href: '#', iconKey: 'megaphone' },
      { label: 'Skoleom Affiliate', href: '#', iconKey: 'userPlus' },
      { label: 'Skoleom Dropship', href: '#', iconKey: 'package' },
      { label: 'Skoleom Analytics', href: '#', iconKey: 'barChart3' },
      { label: 'Skoleom CRM', href: '#', iconKey: 'building2' },
      { label: 'Skoleom Leads', href: '#', iconKey: 'users2' },
      { label: 'Skoleom Invoicing', href: '#', iconKey: 'fileText' },
    ],
  },
  {
    title: 'PRODUCTIVITÉ', tileClass: 'from-cyan-400/95 to-indigo-600/90',
    links: [
      { label: 'Skoleom Drive', href: '#', iconKey: 'hardDrive' },
      { label: 'Skoleom Docs', href: '#', iconKey: 'fileText' },
      { label: 'Skoleom Sheets', href: '#', iconKey: 'fileSpreadsheet' },
      { label: 'Skoleom Slides', href: '#', iconKey: 'presentation' },
      { label: 'Skoleom Notes', href: '#', iconKey: 'bookMarked' },
      { label: 'Skoleom Tasks', href: '#', iconKey: 'clipboardList' },
      { label: 'Skoleom Calendar', href: '#', iconKey: 'calendar' },
      { label: 'Skoleom Keep', href: '#', iconKey: 'sparkles' },
    ],
  },
  {
    title: 'FINANCE & INVESTISSEMENT', tileClass: 'from-lime-300/90 to-yellow-400/95',
    links: [
      { label: 'Skoleom Invest', href: '#', iconKey: 'trendingUp' },
      { label: 'Skoleom Banking', href: '#', iconKey: 'landmark' },
      { label: 'Skoleom Pay', href: '#', iconKey: 'wallet2' },
      { label: 'Skoleom Cards', href: '#', iconKey: 'creditCard' },
      { label: 'Skoleom Crypto', href: '#', iconKey: 'coins' },
      { label: 'Skoleom Insurance', href: '#', iconKey: 'umbrella' },
      { label: 'Skoleom Crowdfunding', href: '#', iconKey: 'megaphone' },
    ],
  },
  {
    title: 'FORMATION & ÉDUCATION', tileClass: 'from-pink-400/95 to-rose-700/85',
    links: [
      { label: 'Skoleom Learn', href: '#', iconKey: 'gradCap' },
      { label: 'Skoleom Academy', href: '#', iconKey: 'bookOpen' },
      { label: 'Skoleom Courses', href: '#', iconKey: 'library' },
      { label: 'Skoleom Certify', href: '#', iconKey: 'shield' },
      { label: 'Skoleom Library', href: '#', iconKey: 'bookMarked' },
      { label: 'Skoleom Tutor', href: '#', iconKey: 'users' },
      { label: 'Skoleom Kids', href: '#', iconKey: 'kids' },
    ],
  },
  {
    title: 'VOYAGE & EXPÉRIENCES', tileClass: 'from-amber-200/95 to-orange-600/90',
    links: [
      { label: 'Skoleom Travel', href: '#', iconKey: 'plane' },
      { label: 'Skoleom Hotels', href: '#', iconKey: 'hotel' },
      { label: 'Skoleom Flights', href: '#', iconKey: 'plane' },
      { label: 'Skoleom Events', href: '#', iconKey: 'calendar' },
      { label: 'Skoleom Guide', href: '#', iconKey: 'bookOpen' },
      { label: 'Skoleom Experiences', href: '#', iconKey: 'sparkles' },
      { label: 'Skoleom Booking', href: '#', iconKey: 'calendar' },
    ],
  },
  {
    title: 'CONTENUS & DIVERTISSEMENT', tileClass: 'from-purple-400/95 to-violet-800/85',
    links: [
      { label: 'Skoleom Watch', href: '/', iconKey: 'tv' },
      { label: 'Skoleom Music', href: '#', iconKey: 'music' },
      { label: 'Skoleom Podcast', href: '#', iconKey: 'mic' },
      { label: 'Skoleom Book', href: '#', iconKey: 'bookOpen' },
      { label: 'Skoleom Games', href: '#', iconKey: 'gamepad2' },
      { label: 'Skoleom News', href: '#', iconKey: 'newspaper' },
      { label: 'Skoleom Radio', href: '#', iconKey: 'radio' },
    ],
  },
  {
    title: 'OUTILS & UTILITAIRES', tileClass: 'from-slate-400/90 to-slate-700/90',
    links: [
      { label: 'Skoleom Cloud', href: '#', iconKey: 'cloud' },
      { label: 'Skoleom Transfer', href: '#', iconKey: 'server' },
      { label: 'Skoleom Scan', href: '#', iconKey: 'fileScan' },
      { label: 'Skoleom QR', href: '#', iconKey: 'qrCode' },
      { label: 'Skoleom Password', href: '#', iconKey: 'keyRound' },
      { label: 'Skoleom VPN', href: '#', iconKey: 'shield' },
      { label: 'Skoleom Backup', href: '#', iconKey: 'hardDrive' },
    ],
  },
  {
    title: 'SUPPORT & COMMUNAUTÉ', tileClass: 'from-green-400/95 to-emerald-800/90',
    links: [
      { label: 'Skoleom Help Center', href: '#', iconKey: 'bookOpen' },
      { label: 'Skoleom Support', href: '#', iconKey: 'messageSquare' },
      { label: 'Skoleom Feedback', href: '#', iconKey: 'bell' },
      { label: 'Skoleom Community', href: '#', iconKey: 'users' },
      { label: 'Skoleom Ambassadors', href: '#', iconKey: 'sparkles' },
      { label: 'Skoleom Updates', href: '#', iconKey: 'newspaper' },
      { label: 'Skoleom Status', href: '#', iconKey: 'wrench' },
    ],
  },
];

const ROW_A = COLUMNS.slice(0, 6);
const ROW_B = COLUMNS.slice(6, 12);

const HEADER_H = 71; // px — same as md:h-[71px]

function ColumnBlock({ column, onNavigate }: { column: Column; onNavigate: () => void }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[9px] font-bold uppercase leading-tight tracking-[0.14em] text-white/80 md:text-[10px] md:tracking-[0.15em] lg:text-[11px]">
        {column.title}
      </h3>
      <ul className="flex flex-col gap-y-0.5 lg:gap-y-1">
        {column.links.map((item) => {
          const Icon = ICON_MAP[item.iconKey] ?? Sparkles;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="group flex items-center gap-2 rounded-md py-0.5 text-left transition-colors md:gap-2.5 lg:gap-3 lg:py-1"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-inner shadow-black/25 ring-[0.5px] ring-white/10 md:size-8 md:rounded-[10px] lg:size-9 lg:rounded-[11px] ${column.tileClass}`}
                >
                  <Icon
                    className="size-[11px] text-black/90 drop-shadow-sm md:size-[13px] lg:size-[15px]"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1 text-[10px] font-semibold leading-snug text-white/75 transition-colors group-hover:text-[#0066FF] md:text-[11px] lg:text-[13px]">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GridRow({ columns, onNavigate }: { columns: readonly Column[]; onNavigate: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-6 md:gap-x-4 lg:gap-x-5 xl:gap-x-6 [&>*]:min-w-0">
      {columns.map((col) => (
        <ColumnBlock key={col.title} column={col} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

interface Props { open: boolean; onClose: () => void }

export default function UniverseMegaMenu({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [open, onClose]);

  const handleNavigate = useCallback(() => onClose(), [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9997] bg-black/40 backdrop-blur-md transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: `${HEADER_H}px` }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed left-0 right-0 z-[9998] transition-all duration-200 ease-out ${
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
        style={{ top: `${HEADER_H + 8}px`, maxHeight: `calc(100dvh - ${HEADER_H + 12}px)` }}
      >
        <div className="mx-auto max-w-[1600px] px-3 sm:px-4 md:px-6 lg:px-8">
          <div
            className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0a0a]/85 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-[40px] md:rounded-[1.35rem] lg:rounded-[1.5rem]"
            style={{ maxHeight: `calc(100dvh - ${HEADER_H + 20}px)` }}
          >
            {/* Scrollable grid */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6 md:py-6 lg:px-9 lg:py-7">
              <div className="flex flex-col gap-5">
                <GridRow columns={ROW_A} onNavigate={handleNavigate} />
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                <GridRow columns={ROW_B} onNavigate={handleNavigate} />
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/10 bg-white/[0.03] px-5 py-3 md:px-7 md:py-3.5 lg:px-9 lg:py-4">
              <div className="flex justify-center">
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-2 text-[11px] font-semibold text-white transition hover:border-[#0066FF]/40 hover:bg-white/10 hover:text-[#0066FF] md:px-6 md:py-2.5 md:text-[13px] lg:py-3 lg:text-sm"
                >
                  <LayoutGrid className="size-[14px] shrink-0 text-[#0066FF] md:size-[16px]" strokeWidth={2} aria-hidden />
                  Voir tous les +50 outils Skoleom
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
