import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import {
  Home, Search, Video, User, Settings2,
  Plus, X, Trash2, Crown, Zap,
  Package, BarChart2, Grid3x3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { GuideButton } from '../../client/components/Guide/GuideModal';

/* ── Plans ──────────────────────────────────────────────────── */
interface Plan {
  id: 'free' | 'premium' | 'ultra';
  name: string;
  price: string;
  maxCapsules: number | null;
  maxProductsPerCapsule: number;
  color: string;
  badge: string;
}

const PLANS: Plan[] = [
  { id: 'free',    name: 'Gratuit',       price: '0€',     maxCapsules: 2,    maxProductsPerCapsule: 2,  color: 'white',    badge: 'Gratuit' },
  { id: 'premium', name: 'Premium',       price: '9,90€',  maxCapsules: 15,   maxProductsPerCapsule: 5,  color: '#0066FF',  badge: 'Premium' },
  { id: 'ultra',   name: 'Ultra Premium', price: '29,90€', maxCapsules: null, maxProductsPerCapsule: 10, color: '#f59e0b',  badge: 'Ultra' },
];

/* ── Types ──────────────────────────────────────────────────── */
interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
}

interface Capsule {
  id: string;
  name: string;
  products: Product[];
}

/* ── Demo accounts ──────────────────────────────────────────── */
type AccountId = 'karim' | 'anis' | 'ultra';

interface DemoAccount {
  username: string;
  avatar: string;
  planId: 'free' | 'premium' | 'ultra';
  capsules: Capsule[];
}

const DEMO_ACCOUNTS: Record<AccountId, DemoAccount> = {
  karim: {
    username: 'karim.hmd',
    avatar: 'K',
    planId: 'free',
    capsules: [
      {
        id: 'cap-k1',
        name: 'Capsule Mode',
        products: [
          { id: 'pk1', name: 'Hoodie Skoleom', description: 'Oversize, coton bio 300g.', price: '69.90', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=300&h=300&fit=crop' },
        ],
      },
    ],
  },
  anis: {
    username: 'anis.live',
    avatar: 'A',
    planId: 'premium',
    capsules: [
      {
        id: 'cap-a1',
        name: 'Capsule Sneakers',
        products: [
          { id: 'pa1', name: 'Air Max Exclusif', description: 'Édition limitée 50 paires.', price: '189.00', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop' },
          { id: 'pa2', name: 'Jordan Retro OG', description: 'Coloris vintage, taille 40-45.', price: '159.00', imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=300&h=300&fit=crop' },
          { id: 'pa3', name: 'Chaussettes Sport x3', description: 'Pack 3 paires, coton bio.', price: '19.90', imageUrl: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=300&h=300&fit=crop' },
        ],
      },
      {
        id: 'cap-a2',
        name: 'Capsule Streetwear',
        products: [
          { id: 'pa4', name: 'Cargo Pants Black', description: 'Coupe droite, multi-poches.', price: '79.90', imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&h=300&fit=crop' },
          { id: 'pa5', name: 'Tee OG Logo', description: 'Coton peigné, coupe droite.', price: '34.90', imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop' },
        ],
      },
    ],
  },
  ultra: {
    username: 'lina.ultra',
    avatar: 'L',
    planId: 'ultra',
    capsules: [
      {
        id: 'cap-u1',
        name: 'Capsule Déco',
        products: [
          { id: 'pu1', name: 'Vase Céramique', description: 'Fait main, 30cm.', price: '45.00', imageUrl: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&h=300&fit=crop' },
          { id: 'pu2', name: 'Bougie Soja', description: '40h combustion.', price: '22.00', imageUrl: 'https://images.unsplash.com/photo-1602607140002-9e2bc40e72a2?w=300&h=300&fit=crop' },
          { id: 'pu3', name: 'Plaid Alpaga', description: '100% alpaga péruvien.', price: '89.00', imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=300&h=300&fit=crop' },
          { id: 'pu4', name: 'Miroir Laiton', description: 'Contour laiton brossé, 60cm.', price: '129.00', imageUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=300&h=300&fit=crop' },
        ],
      },
      {
        id: 'cap-u2',
        name: 'Capsule Cuisine',
        products: [
          { id: 'pu5', name: 'Cafetière Italienne', description: '6 tasses, inox brossé.', price: '39.00', imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop' },
          { id: 'pu6', name: 'Planche Bois Noyer', description: 'Bois de noyer massif, 40x25cm.', price: '55.00', imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop' },
        ],
      },
    ],
  },
};

/* ── Sidebar ────────────────────────────────────────────────── */
function InstaSidebar() {
  const router = useRouter();
  const NAV = [
    { href: '/live',       icon: Video,  label: 'Live' },
    { href: '/',           icon: Home,   label: 'Explorer' },
    { href: '/explore',    icon: Search, label: 'Rechercher' },
    { href: '/profile/me', icon: User,   label: 'Profil' },
  ];
  return (
    <aside className="hidden md:flex flex-col w-[244px] h-full bg-black border-r border-white/[0.06] px-3 py-5 shrink-0">
      <div className="px-3 pb-6 pt-2">
        <img src="/skoleom-mark.png" alt="skoleomLive" className="h-7 object-contain" />
      </div>
      <nav className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = router.pathname === item.href;
          return (
            <Link key={item.label} href={item.href}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-xl text-[15px] transition-colors ${
                isActive ? 'font-bold text-white bg-white/[0.06]' : 'font-normal text-white/80 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.75} />
              {item.label}
            </Link>
          );
        })}
        <GuideButton />
      </nav>
      <div className="border-t border-white/[0.06] pt-3 mt-2">
        <Link href="/admin" className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-[15px] text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors">
          <Settings2 size={22} strokeWidth={1.75} />
          Admin
        </Link>
      </div>
    </aside>
  );
}

/* ── Upgrade modal ──────────────────────────────────────────── */
function UpgradeModal({ reason, onClose }: { reason: 'capsule' | 'product'; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[6px]" onClick={onClose}>
      <div
        className="relative w-full max-w-[520px] bg-[#0d0d10] border border-white/[0.08] rounded-[28px] overflow-hidden"
        style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent" />
        <div className="px-7 pt-6 pb-7">
          <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.14] flex items-center justify-center text-white/50 hover:text-white transition-all">
            <X size={15} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center shrink-0">
              <Crown size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[17px] font-extrabold text-white leading-tight">Limite atteinte</p>
              <p className="text-[12px] text-white/45">
                {reason === 'capsule' ? 'Tu as utilisé toutes tes Capsules disponibles.' : 'Cette Capsule est pleine.'}
              </p>
            </div>
          </div>

          {/* Plans grid */}
          <div className="grid grid-cols-3 gap-2.5 my-5">
            {PLANS.map(plan => {
              const isGold = plan.id === 'ultra';
              const isBlue = plan.id === 'premium';
              return (
                <div
                  key={plan.id}
                  className={`rounded-[18px] p-4 border ${
                    isGold ? 'bg-[#f59e0b]/10 border-[#f59e0b]/35' :
                    isBlue ? 'bg-[#0066FF]/10 border-[#0066FF]/30' :
                    'bg-white/[0.03] border-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-[12px] font-bold uppercase tracking-wide ${isGold ? 'text-[#f59e0b]' : isBlue ? 'text-[#0066FF]' : 'text-white/40'}`}>
                      {plan.name}
                    </p>
                    {isGold && <Crown size={12} className="text-[#f59e0b]" />}
                    {isBlue && <Zap size={12} className="text-[#0066FF]" />}
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className={`text-[11px] font-semibold rounded-lg px-2 py-1 ${isGold ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : isBlue ? 'bg-[#0066FF]/10 text-[#7aabff]' : 'bg-white/[0.05] text-white/45'}`}>
                      {plan.maxCapsules === null ? '∞' : plan.maxCapsules} Capsules
                    </div>
                    <div className={`text-[11px] font-semibold rounded-lg px-2 py-1 ${isGold ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : isBlue ? 'bg-[#0066FF]/10 text-[#7aabff]' : 'bg-white/[0.05] text-white/45'}`}>
                      {plan.maxProductsPerCapsule} articles / Capsule
                    </div>
                  </div>

                  <p className="text-[18px] font-extrabold text-white">{plan.price}</p>
                  <p className="text-[10px] text-white/35">/mois</p>

                  {plan.id !== 'free' && (
                    <button className={`w-full mt-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                      isGold ? 'bg-[#f59e0b] text-black hover:brightness-110' : 'bg-[#0066FF] text-white hover:brightness-110'
                    }`}>
                      Choisir
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={onClose} className="w-full py-2.5 text-white/35 text-[13px] hover:text-white/60 transition-colors">
            Rester sur le plan gratuit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Add product modal ──────────────────────────────────────── */
function AddProductModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Product) => void }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '' });
  function submit() {
    if (!form.name.trim() || !form.price.trim()) return;
    onAdd({ id: Date.now().toString(), ...form, imageUrl: form.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop' });
    onClose();
  }
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[6px]" onClick={onClose}>
      <div className="relative w-full max-w-[440px] bg-[#0d0d10] border border-white/[0.08] rounded-[28px] overflow-hidden" style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <div className="h-px bg-gradient-to-r from-transparent via-[#0066FF] to-transparent" />
        <div className="px-6 pt-6 pb-7">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[#0066FF]/20 border border-[#0066FF]/30 flex items-center justify-center">
                <Package size={16} className="text-[#0066FF]" />
              </div>
              <p className="text-[16px] font-bold">Ajouter un article</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.14] flex items-center justify-center text-white/50 hover:text-white transition-all"><X size={15} /></button>
          </div>
          <div className="space-y-3">
            {[
              { key: 'name',        label: 'Nom *',                placeholder: 'ex: Hoodie Premium' },
              { key: 'price',       label: 'Prix (€) *',           placeholder: 'ex: 49.90' },
              { key: 'description', label: 'Description',          placeholder: 'Courte description...' },
              { key: 'imageUrl',    label: 'URL image (optionnel)', placeholder: 'https://...' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[11px] font-semibold text-white/45 mb-1.5 uppercase tracking-wide">{f.label}</label>
                <input type="text" placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-white/25 outline-none focus:border-[#0066FF]/60 transition-all"
                />
              </div>
            ))}
          </div>
          <button onClick={submit} disabled={!form.name.trim() || !form.price.trim()}
            className="w-full mt-5 py-3.5 rounded-full bg-[#0066FF] text-white text-[14px] font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Ajouter à la Capsule
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Add capsule modal ──────────────────────────────────────── */
function AddCapsuleModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[6px]" onClick={onClose}>
      <div className="relative w-full max-w-[400px] bg-[#0d0d10] border border-white/[0.08] rounded-[28px] overflow-hidden" style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <div className="h-px bg-gradient-to-r from-transparent via-[#0066FF] to-transparent" />
        <div className="px-6 pt-6 pb-7">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[16px] font-bold">Nouvelle Capsule</p>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.14] flex items-center justify-center text-white/50 hover:text-white transition-all"><X size={15} /></button>
          </div>
          <label className="block text-[11px] font-semibold text-white/45 mb-1.5 uppercase tracking-wide">Nom de la Capsule *</label>
          <input type="text" placeholder="ex: Capsule Mode Été" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-white/25 outline-none focus:border-[#0066FF]/60 transition-all mb-5" />
          <button onClick={() => { if (name.trim()) { onAdd(name.trim()); onClose(); } }} disabled={!name.trim()}
            className="w-full py-3.5 rounded-full bg-[#0066FF] text-white text-[14px] font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Créer la Capsule
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Capsule card ───────────────────────────────────────────── */
function CapsuleCard({
  capsule, maxProducts, onAddProduct, onRemoveProduct, onRemoveCapsule,
}: {
  capsule: Capsule;
  maxProducts: number;
  onAddProduct: (capsuleId: string) => void;
  onRemoveProduct: (capsuleId: string, productId: string) => void;
  onRemoveCapsule: (capsuleId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFull = capsule.products.length >= maxProducts;

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-[20px] overflow-hidden">
      {/* Capsule header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setOpen(o => !o)}>
          <div className="w-8 h-8 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/25 flex items-center justify-center shrink-0">
            <img src="/skoleom-mark.png" alt="" className="w-4 h-4 object-contain" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-white">{capsule.name}</p>
            <p className="text-[11px] text-white/40">{capsule.products.length}/{maxProducts} articles</p>
          </div>
          {open ? <ChevronUp size={16} className="text-white/30 ml-2" /> : <ChevronDown size={16} className="text-white/30 ml-2" />}
        </button>

        {/* Progress mini */}
        <div className="flex items-center gap-2 ml-3">
          <div className="flex gap-1">
            {Array.from({ length: maxProducts }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < capsule.products.length ? 'bg-[#0066FF]' : 'bg-white/[0.1]'}`} />
            ))}
          </div>
          <button onClick={() => onRemoveCapsule(capsule.id)} className="w-7 h-7 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/20 hover:text-red-400 transition-all ml-1">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Products */}
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/[0.05] pt-3">
          {capsule.products.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-white/[0.03] rounded-[14px] p-3 group">
              <img src={p.imageUrl} alt={p.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{p.name}</p>
                <p className="text-[13px] font-extrabold text-[#0066FF]">{p.price} €</p>
              </div>
              <button onClick={() => onRemoveProduct(capsule.id, p.id)} className="w-7 h-7 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {/* Add product slot */}
          {!isFull ? (
            <button onClick={() => onAddProduct(capsule.id)}
              className="w-full flex items-center gap-3 bg-white/[0.015] border border-dashed border-white/[0.1] rounded-[14px] p-3 hover:bg-white/[0.03] hover:border-white/[0.2] transition-all group">
              <div className="w-11 h-11 rounded-lg bg-white/[0.04] border border-dashed border-white/[0.1] flex items-center justify-center shrink-0">
                <Plus size={16} className="text-white/20 group-hover:text-white/40 transition-colors" />
              </div>
              <p className="text-[12px] text-white/30 group-hover:text-white/55 transition-colors">Ajouter un article</p>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#f59e0b]/06 border border-[#f59e0b]/20 rounded-[14px]">
              <Crown size={13} className="text-[#f59e0b] shrink-0" />
              <p className="text-[11px] text-[#f59e0b]/80">Capsule pleine — passe à Pro pour + d&apos;articles</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Profile page ───────────────────────────────────────────── */
type Tab = 'capsule' | 'posts' | 'stats';

export default function ProfilePage() {
  const [activeAccount, setActiveAccount] = useState<AccountId>('karim');
  const [tab, setTab] = useState<Tab>('capsule');
  const [capsules, setCapsules] = useState<Record<AccountId, Capsule[]>>({
    karim: DEMO_ACCOUNTS.karim.capsules,
    anis: DEMO_ACCOUNTS.anis.capsules,
    ultra: DEMO_ACCOUNTS.ultra.capsules,
  });
  const [upgrade, setUpgrade] = useState<'capsule' | 'product' | null>(null);
  const [addingProductTo, setAddingProductTo] = useState<string | null>(null);
  const [showAddCapsule, setShowAddCapsule] = useState(false);

  const account = DEMO_ACCOUNTS[activeAccount];
  const plan = PLANS.find(p => p.id === account.planId)!;
  const currentCapsules = capsules[activeAccount];
  const capsuleLimit = plan.maxCapsules;
  const capsuleFull = capsuleLimit !== null && currentCapsules.length >= capsuleLimit;

  function handleAddCapsule() {
    if (capsuleFull) { setUpgrade('capsule'); return; }
    setShowAddCapsule(true);
  }

  function addCapsule(name: string) {
    setCapsules(prev => ({
      ...prev,
      [activeAccount]: [...prev[activeAccount], { id: Date.now().toString(), name, products: [] }],
    }));
  }

  function removeCapsule(id: string) {
    setCapsules(prev => ({ ...prev, [activeAccount]: prev[activeAccount].filter(c => c.id !== id) }));
  }

  function handleAddProduct(capsuleId: string) {
    const cap = currentCapsules.find(c => c.id === capsuleId)!;
    if (cap.products.length >= plan.maxProductsPerCapsule) { setUpgrade('product'); return; }
    setAddingProductTo(capsuleId);
  }

  function addProduct(product: Product) {
    if (!addingProductTo) return;
    setCapsules(prev => ({
      ...prev,
      [activeAccount]: prev[activeAccount].map(c =>
        c.id === addingProductTo ? { ...c, products: [...c.products, product] } : c,
      ),
    }));
  }

  function removeProduct(capsuleId: string, productId: string) {
    setCapsules(prev => ({
      ...prev,
      [activeAccount]: prev[activeAccount].map(c =>
        c.id === capsuleId ? { ...c, products: c.products.filter(p => p.id !== productId) } : c,
      ),
    }));
  }

  const TABS = [
    { key: 'capsule' as Tab, label: 'Capsule', icon: Package },
    { key: 'posts'   as Tab, label: 'Posts',   icon: Grid3x3 },
    { key: 'stats'   as Tab, label: 'Stats',   icon: BarChart2 },
  ];

  const planColor = plan.id === 'ultra' ? '#f59e0b' : plan.id === 'premium' ? '#0066FF' : 'white';

  return (
    <>
      <Head><title>Mon profil — skoleomLive</title></Head>
      <div className="flex h-screen bg-black overflow-hidden">
        <InstaSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[700px] mx-auto px-4 py-8">

            {/* ── Account switcher (demo) ── */}
            <div className="flex gap-2 mb-6">
              {(Object.keys(DEMO_ACCOUNTS) as AccountId[]).map(key => {
                const acc = DEMO_ACCOUNTS[key];
                const p = PLANS.find(pl => pl.id === acc.planId)!;
                const isActive = activeAccount === key;
                const c = p.id === 'ultra' ? '#f59e0b' : p.id === 'premium' ? '#0066FF' : undefined;
                return (
                  <button key={key} onClick={() => setActiveAccount(key)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[12px] font-semibold border transition-all ${
                      isActive ? 'bg-white/[0.08] border-white/20 text-white' : 'border-white/[0.08] text-white/45 hover:text-white/70 hover:border-white/15'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: c ?? '#444' }}>{acc.avatar}</div>
                    {acc.username}
                    <span className="text-[10px] font-bold opacity-60" style={{ color: c }}>{p.badge}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Profile header ── */}
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-white shrink-0 ring-2 ring-offset-2 ring-offset-black"
                style={{ background: `linear-gradient(135deg, ${planColor === 'white' ? '#555' : planColor}, ${planColor === '#f59e0b' ? '#d97706' : planColor === '#0066FF' ? '#0044cc' : '#333'})`, ringColor: planColor }}>
                {account.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-[20px] font-extrabold text-white">{account.username}</h1>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                    style={{ color: planColor === 'white' ? 'rgba(255,255,255,0.5)' : planColor, borderColor: `${planColor === 'white' ? 'rgba(255,255,255,0.15)' : planColor}44`, background: `${planColor === 'white' ? 'rgba(255,255,255,0.06)' : planColor}18` }}>
                    {plan.name}
                  </span>
                </div>
                <div className="flex gap-1.5 text-[12px] text-white/40 mb-3">
                  <span>{capsuleLimit === null ? '∞' : capsuleLimit} Capsules max</span>
                  <span>·</span>
                  <span>{plan.maxProductsPerCapsule} articles/Capsule</span>
                </div>
                <div className="flex gap-6">
                  {[{ label: 'Capsules', value: currentCapsules.length }, { label: 'Ventes', value: 24 }, { label: 'Revenus', value: '1 284€' }].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-[16px] font-extrabold text-white">{s.value}</p>
                      <p className="text-[11px] text-white/40">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 border-b border-white/[0.06] mb-6">
              {TABS.map(t => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all -mb-px ${active ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                    <Icon size={15} />{t.label}
                  </button>
                );
              })}
            </div>

            {/* ── Capsule tab ── */}
            {tab === 'capsule' && (
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[14px] font-bold text-white mb-0.5">Mes Capsules</p>
                    <p className="text-[12px] text-white/40">
                      {currentCapsules.length}/{capsuleLimit === null ? '∞' : capsuleLimit} Capsules
                      {capsuleFull && <span className="text-[#f59e0b] ml-2 font-semibold">— Limite atteinte</span>}
                    </p>
                  </div>
                  <button onClick={handleAddCapsule}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold transition-all ${
                      capsuleFull
                        ? 'bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/25'
                        : 'bg-[#0066FF] text-white hover:brightness-110 hover:shadow-[0_0_20px_rgba(0,102,255,0.35)]'
                    }`}
                  >
                    {capsuleFull ? <><Crown size={14} /><span>Passer à Pro</span></> : <><Plus size={14} /><span>Nouvelle Capsule</span></>}
                  </button>
                </div>

                {/* Capsule progress bar */}
                {capsuleLimit !== null && (
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-6 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${capsuleFull ? 'bg-[#f59e0b]' : 'bg-[#0066FF]'}`}
                      style={{ width: `${Math.min((currentCapsules.length / capsuleLimit) * 100, 100)}%` }} />
                  </div>
                )}

                {/* Capsules list */}
                <div className="space-y-3">
                  {currentCapsules.map(cap => (
                    <CapsuleCard key={cap.id} capsule={cap} maxProducts={plan.maxProductsPerCapsule}
                      onAddProduct={handleAddProduct} onRemoveProduct={removeProduct} onRemoveCapsule={removeCapsule} />
                  ))}

                  {/* Empty slot */}
                  {!capsuleFull && (
                    <button onClick={handleAddCapsule}
                      className="w-full flex items-center gap-4 bg-white/[0.015] border border-dashed border-white/[0.1] rounded-[20px] p-4 hover:bg-white/[0.03] hover:border-white/[0.2] transition-all group">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-dashed border-white/[0.1] flex items-center justify-center shrink-0">
                        <Plus size={18} className="text-white/20 group-hover:text-white/40 transition-colors" />
                      </div>
                      <p className="text-[13px] text-white/30 group-hover:text-white/55 transition-colors">Créer une nouvelle Capsule</p>
                    </button>
                  )}

                  {/* Upsell when full */}
                  {capsuleFull && (
                    <button onClick={() => setUpgrade('capsule')}
                      className="w-full flex items-center gap-4 bg-gradient-to-r from-[#f59e0b]/08 to-[#0066FF]/06 border border-dashed border-[#f59e0b]/30 rounded-[20px] p-4 hover:from-[#f59e0b]/14 hover:border-[#f59e0b]/50 transition-all group">
                      <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center shrink-0">
                        <Crown size={18} className="text-[#f59e0b]" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-bold text-[#f59e0b]">Débloquer plus de Capsules</p>
                        <p className="text-[12px] text-white/35 mt-0.5">Premium : 15 Capsules · Ultra : illimitées</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === 'posts' && (
              <div className="grid grid-cols-3 gap-1">
                {[...Array(9)].map((_, i) => <div key={i} className="aspect-square bg-white/[0.04] rounded-lg" />)}
              </div>
            )}

            {tab === 'stats' && (
              <div className="flex flex-col items-center justify-center py-16 text-white/30">
                <BarChart2 size={40} className="mb-3 opacity-30" />
                <p className="text-[14px]">Analytics disponibles bientôt</p>
              </div>
            )}

          </div>
        </main>
      </div>

      {upgrade && <UpgradeModal reason={upgrade} onClose={() => setUpgrade(null)} />}
      {showAddCapsule && <AddCapsuleModal onClose={() => setShowAddCapsule(false)} onAdd={addCapsule} />}
      {addingProductTo && <AddProductModal onClose={() => setAddingProductTo(null)} onAdd={p => { addProduct(p); setAddingProductTo(null); }} />}
    </>
  );
}
