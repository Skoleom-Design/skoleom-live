import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LogOut, Plus, Trash2, Package, BarChart2, Grid3x3, Loader2, Pencil, Camera, X,
  Heart, Zap, Wallet, ArrowDownToLine, ArrowUpFromLine, Radio, Settings, Check,
} from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { BoostModal } from '../../client/components/Boost/BoostModal';
import { api, ApiError, getToken, getStoredUser, clearSession } from '../../shared/api/http';

type PlanKey = 'free' | 'premium' | 'ultra';

interface MeUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  role: string;
  plan?: PlanKey;
  walletBalance?: number;
  totalEarnings?: number;
}

const PLAN_BADGE: Record<PlanKey, { label: string; color: string }> = {
  free: { label: 'Free', color: 'rgba(255,255,255,0.5)' },
  premium: { label: 'Premium', color: '#00ffff' },
  ultra: { label: 'Ultra', color: '#f59e0b' },
};

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ar', label: 'العربية' },
];

const PLANS: { key: PlanKey; price: string; perks: string[] }[] = [
  { key: 'free', price: '0€/mois', perks: ['2 capsules par post', 'Fonctionnalités de base'] },
  { key: 'premium', price: '9,90€/mois', perks: ['15 capsules par post', 'Badge Premium', 'Support prioritaire'] },
  { key: 'ultra', price: '29,90€/mois', perks: ['Capsules illimitées', 'Badge Ultra', 'Mise en avant boostée'] },
];

interface CapsuleData {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  soldCount: number;
  imageUrl?: string;
}

interface PostData {
  id: string;
  caption?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  type: 'photo' | 'video';
  viewCount: number;
  likeCount: number;
  capsules: CapsuleData[];
}

interface LikedPost {
  id: string;
  caption?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  type: 'photo' | 'video' | 'youtube';
  creator: { id: string; username: string };
}

interface Analytics {
  posts: PostData[];
  totals: { views: number; likes: number; sold: number; revenue: number };
}

type Tab = 'posts' | 'capsules' | 'favoris' | 'wallet' | 'stats';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [capsuleModalOpen, setCapsuleModalOpen] = useState(false);
  const [newCapsulePostId, setNewCapsulePostId] = useState('');
  const [newCapsuleName, setNewCapsuleName] = useState('');
  const [newCapsulePrice, setNewCapsulePrice] = useState('');
  const [newCapsuleStock, setNewCapsuleStock] = useState('');
  const [newCapsuleError, setNewCapsuleError] = useState('');
  const [newCapsuleSaving, setNewCapsuleSaving] = useState(false);

  const [likedPosts, setLikedPosts] = useState<LikedPost[]>([]);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [boostOpen, setBoostOpen] = useState(false);
  const [boostPost, setBoostPost] = useState<PostData | null>(null);

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('20');
  const [topupError, setTopupError] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('fr');
  const [notice, setNotice] = useState('');

  function showComingSoon(label: string) {
    setNotice(`${label} — bientôt disponible 🚧`);
    setTimeout(() => setNotice(''), 3000);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth/login');
      return;
    }
    if (getStoredUser()?.role === 'admin') {
      router.replace('/admin');
      return;
    }
    (async () => {
      try {
        const [me, stats, liked] = await Promise.all([
          api.get<MeUser>('/auth/me'),
          api.get<Analytics>('/posts/analytics/me'),
          api.get<LikedPost[]>('/posts/liked/me').catch(() => []),
        ]);
        setUser(me);
        setAnalytics(stats);
        setLikedPosts(liked);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Impossible de charger le profil.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleChangePlan(plan: PlanKey) {
    if (!user || plan === user.plan) return;
    setPlanSaving(true);
    setPlanError('');
    try {
      const updated = await api.patch<MeUser>('/users/me', { plan });
      setUser((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setPlanSaving(false);
    }
  }

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    setTopupError('');
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) {
      setTopupError('Montant invalide.');
      return;
    }
    setTopupLoading(true);
    try {
      const { clientSecret } = await api.post<{ clientSecret: string }>('/payments/wallet/topup', { amount });
      router.push(`/checkout/wallet?client_secret=${clientSecret}`);
    } catch (err) {
      setTopupError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      setTopupLoading(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError('');
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setWithdrawError('Montant invalide.');
      return;
    }
    setWithdrawLoading(true);
    try {
      const res = await api.post<{ walletBalance: number }>('/payments/wallet/withdraw', { amount });
      setUser((prev) => (prev ? { ...prev, walletBalance: res.walletBalance } : prev));
      setWithdrawOpen(false);
      setWithdrawAmount('');
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setWithdrawLoading(false);
    }
  }

  async function handleRemoveCapsule(capsuleId: string) {
    try {
      await api.delete(`/capsules/${capsuleId}`);
      setAnalytics((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) => ({
                ...p,
                capsules: p.capsules.filter((c) => c.id !== capsuleId),
              })),
            }
          : prev,
      );
    } catch {
      // silent — la liste reflète toujours l'état serveur au prochain rechargement
    }
  }

  async function handleDeletePost(postId: string) {
    if (!window.confirm('Supprimer ce post ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/posts/${postId}`);
      setAnalytics((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev));
    } catch {
      // silent — la liste reflète toujours l'état serveur au prochain rechargement
    }
  }

  function handleLogout() {
    clearSession();
    router.push('/auth/login');
  }

  function openEdit() {
    if (!user) return;
    setEditDisplayName(user.displayName || '');
    setEditBio(user.bio || '');
    setEditAvatarFile(null);
    setEditAvatarPreview(user.avatarUrl || '');
    setEditError('');
    setEditOpen(true);
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditAvatarFile(f);
    setEditAvatarPreview(URL.createObjectURL(f));
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;

      if (editAvatarFile) {
        const extension = editAvatarFile.name.split('.').pop() || 'jpg';
        const { uploadUrl, fileUrl } = await api.post('/files/upload-url', {
          folder: 'avatars',
          mimeType: editAvatarFile.type,
          extension,
        });
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': editAvatarFile.type },
          body: editAvatarFile,
        });
        if (!putRes.ok) throw new Error("Échec de l'upload de la photo.");
        avatarUrl = fileUrl;
      }

      const updated = await api.patch<MeUser>('/users/me', {
        displayName: editDisplayName.trim() || undefined,
        bio: editBio.trim() || undefined,
        avatarUrl,
      });
      setUser((prev) => (prev ? { ...prev, ...updated } : updated));
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof ApiError || err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setEditSaving(false);
    }
  }

  function openCapsuleModal() {
    setNewCapsulePostId(analytics?.posts[0]?.id || '');
    setNewCapsuleName('');
    setNewCapsulePrice('');
    setNewCapsuleStock('');
    setNewCapsuleError('');
    setCapsuleModalOpen(true);
  }

  async function handleCreateCapsule(e: React.FormEvent) {
    e.preventDefault();
    setNewCapsuleError('');

    const price = parseFloat(newCapsulePrice);
    const stock = parseInt(newCapsuleStock, 10);
    if (!newCapsulePostId) {
      setNewCapsuleError('Créez d\'abord un post pour pouvoir y attacher une capsule.');
      return;
    }
    if (!newCapsuleName.trim() || !price || !stock) {
      setNewCapsuleError('Nom, prix et stock sont requis.');
      return;
    }
    if (price < 1) {
      setNewCapsuleError('Le prix minimum est de 1€.');
      return;
    }

    setNewCapsuleSaving(true);
    try {
      const created = await api.post<CapsuleData>('/capsules', {
        postId: newCapsulePostId,
        name: newCapsuleName.trim(),
        price,
        stock,
      });
      setAnalytics((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) =>
                p.id === newCapsulePostId ? { ...p, capsules: [...p.capsules, created] } : p,
              ),
            }
          : prev,
      );
      setCapsuleModalOpen(false);
    } catch (err) {
      setNewCapsuleError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setNewCapsuleSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  if (error || !user || !analytics) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black text-white/60">
        <p>{error || 'Profil introuvable.'}</p>
        <Link href="/auth/login" className="text-[#a8ff35] underline text-sm">Se reconnecter</Link>
      </div>
    );
  }

  const capsules = analytics.posts.flatMap((post) =>
    post.capsules.map((c) => ({ ...c, post })),
  );

  const TABS = [
    { key: 'posts' as Tab, label: 'Posts', icon: Grid3x3 },
    { key: 'capsules' as Tab, label: 'Capsules', icon: Package },
    { key: 'favoris' as Tab, label: 'Favoris', icon: Heart },
    { key: 'wallet' as Tab, label: 'Wallet', icon: Wallet },
    { key: 'stats' as Tab, label: 'Stats', icon: BarChart2 },
  ];

  return (
    <>
      <Head><title>Mon profil — skoleomLive</title></Head>
      <div className="flex h-screen bg-black overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[700px] mx-auto px-4 py-8">

            {/* Profile header */}
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-black shrink-0 bg-gradient-to-br from-[#a8ff35] to-[#6fe600] overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  (user.displayName || user.username)[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-[20px] font-extrabold text-white">{user.displayName || user.username}</h1>
                  <span className="text-[11px] text-white/40">@{user.username}</span>
                  {user.plan && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        color: PLAN_BADGE[user.plan].color,
                        background: `${PLAN_BADGE[user.plan].color === 'rgba(255,255,255,0.5)' ? 'rgba(255,255,255,0.08)' : PLAN_BADGE[user.plan].color}1a`,
                      }}
                    >
                      {PLAN_BADGE[user.plan].label}
                    </span>
                  )}
                </div>
                {user.bio && <p className="text-[13px] text-white/45 mb-3">{user.bio}</p>}
                <div className="flex gap-6">
                  {[
                    { label: 'Vues', value: analytics.totals.views },
                    { label: 'Ventes', value: analytics.totals.sold },
                    { label: 'Revenus', value: `${analytics.totals.revenue.toFixed(2)} €` },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-[16px] font-extrabold text-white">{s.value}</p>
                      <p className="text-[11px] text-white/40">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link href="/studio"
                  className="btn-skoleom flex items-center gap-2 px-4 py-2 rounded-full text-[13px] hover:shadow-glow-lime-sm transition-all">
                  <Plus size={14} /> Nouveau post
                </Link>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => router.push('/studio/live')}
                    title="Démarrer un live"
                    className="w-9 h-9 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <Radio size={15} className="text-red-400" />
                  </button>
                  <button
                    onClick={() => { setBoostPost(null); setBoostOpen(true); }}
                    title="Booster mon compte"
                    className="w-9 h-9 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <Zap size={15} className="text-[#a8ff35]" />
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    title="Paramètres"
                    className="w-9 h-9 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <Settings size={15} className="text-white/70" />
                  </button>
                </div>
              </div>
            </div>

            {notice && (
              <p className="mb-5 text-center text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2.5">
                {notice}
              </p>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/[0.06] mb-6">
              {TABS.map((t) => {
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

            {tab === 'posts' && (
              analytics.posts.length === 0 ? (
                <EmptyState text="Aucun post publié pour l'instant." />
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {analytics.posts.map((post) => (
                    <div key={post.id} className="relative aspect-square bg-white/[0.04] rounded-lg overflow-hidden group">
                      <Link href={`/post/${post.id}`} className="block w-full h-full">
                        {post.thumbnailUrl || post.type === 'photo' ? (
                          <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
                        )}
                      </Link>
                      <button
                        onClick={() => { setBoostPost(post); setBoostOpen(true); }}
                        title="Mettre en avant"
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all"
                      >
                        <Zap size={13} className="text-[#a8ff35]" />
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        title="Supprimer ce post"
                        className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/70 transition-all"
                      >
                        <Trash2 size={13} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'capsules' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[13px] font-semibold text-white/70 uppercase tracking-wider mb-3">
                    Abonnement — plus de capsules par post
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                    {PLANS.map((p) => {
                      const active = user.plan === p.key;
                      return (
                        <button
                          key={p.key}
                          onClick={() => handleChangePlan(p.key)}
                          disabled={planSaving}
                          className={`text-left p-4 rounded-[16px] border transition-all disabled:opacity-60 ${
                            active
                              ? 'border-[#a8ff35] bg-[#a8ff35]/10 shadow-glow-lime-sm'
                              : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="text-[13px] font-bold"
                              style={{ color: active ? PLAN_BADGE[p.key].color : 'white' }}
                            >
                              {PLAN_BADGE[p.key].label}
                            </span>
                            {active && <span className="text-[10px] font-bold text-[#a8ff35]">Actuel</span>}
                          </div>
                          <p className="text-[12px] text-white/40 mb-2">{p.price}</p>
                          <ul className="space-y-1">
                            {p.perks.map((perk) => (
                              <li key={perk} className="text-[11px] text-white/50">• {perk}</li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                  {planError && <p className="text-red-400 text-xs">{planError}</p>}
                  <p className="text-[11px] text-white/25">
                    Changement de palier immédiat — aucun paiement réel n&apos;est requis pour l&apos;instant.
                  </p>
                </div>

                <button
                  onClick={openCapsuleModal}
                  className="btn-skoleom flex items-center gap-2 px-4 py-2 rounded-full text-[13px] hover:shadow-glow-lime-sm transition-all"
                >
                  <Plus size={14} /> Créer une capsule
                </button>

                {capsules.length === 0 ? (
                  <EmptyState text="Aucune capsule créée pour l'instant." />
                ) : (
                  <div className="space-y-3">
                    {capsules.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-3">
                      <div className="w-12 h-12 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={18} className="text-white/25" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">{c.name}</p>
                        <p className="text-[12px] text-white/40">
                          {c.price.toFixed(2)} {c.currency} · {c.soldCount} vendues · {c.stock} en stock
                        </p>
                      </div>
                      <button onClick={() => handleRemoveCapsule(c.id)}
                        className="w-8 h-8 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/25 hover:text-red-400 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'favoris' && (
              likedPosts.length === 0 ? (
                <EmptyState text="Aucun post mis en favori pour l'instant." />
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {likedPosts.map((post) => (
                    <Link key={post.id} href={`/post/${post.id}`} className="relative aspect-square bg-white/[0.04] rounded-lg overflow-hidden group">
                      {post.thumbnailUrl || post.type === 'photo' ? (
                        <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                      ) : post.type === 'video' ? (
                        <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                          <Heart size={20} className="text-white/15" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[11px] text-white/90 truncate">@{post.creator.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}

            {tab === 'wallet' && (
              <div className="space-y-5 max-w-sm">
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-[20px] p-5">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Solde disponible</p>
                  <p className="text-[32px] font-extrabold text-white mb-4">
                    {(user.walletBalance ?? 0).toFixed(2)} €
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setTopupOpen(true); setTopupError(''); }}
                      className="btn-skoleom flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[13px] hover:shadow-glow-lime-sm transition-all"
                    >
                      <ArrowDownToLine size={14} /> Ajouter des fonds
                    </button>
                    <button
                      onClick={() => { setWithdrawOpen(true); setWithdrawError(''); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full border border-white/10 text-white/70 text-[13px] font-semibold hover:text-white hover:border-white/25 transition-all"
                    >
                      <ArrowUpFromLine size={14} /> Retirer
                    </button>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
                  <p className="text-[12px] text-white/40">Revenus totaux (ventes de capsules)</p>
                  <p className="text-[18px] font-bold text-white">{(user.totalEarnings ?? 0).toFixed(2)} €</p>
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Vues totales', value: analytics.totals.views },
                  { label: 'Likes totaux', value: analytics.totals.likes },
                  { label: 'Capsules vendues', value: analytics.totals.sold },
                  { label: 'Revenu net', value: `${analytics.totals.revenue.toFixed(2)} €` },
                ].map((s) => (
                  <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
                    <p className="text-[20px] font-extrabold text-white">{s.value}</p>
                    <p className="text-[12px] text-white/40 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </main>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Modifier le profil</h2>
              <button onClick={() => setEditOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#a8ff35] to-[#6fe600] flex items-center justify-center text-2xl font-extrabold text-black"
                >
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (editDisplayName || user.username)[0]?.toUpperCase()
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#a8ff35] border-2 border-[#0d0d0f] flex items-center justify-center">
                    <Camera size={11} className="text-black" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs text-[#a8ff35] font-semibold hover:underline"
                >
                  Changer la photo
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Nom affiché
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder={user.username}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Parle de toi en quelques mots..."
                  rows={3}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all resize-none"
                />
              </div>

              {editError && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                  {editError}
                </p>
              )}

              <button
                type="submit"
                disabled={editSaving}
                className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
              >
                {editSaving ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {capsuleModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Créer une capsule</h2>
              <button onClick={() => setCapsuleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            {analytics.posts.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">
                Créez d'abord un post — une capsule doit toujours être rattachée à un post.
              </p>
            ) : (
              <form onSubmit={handleCreateCapsule} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                    Rattacher au post
                  </label>
                  <select
                    value={newCapsulePostId}
                    onChange={(e) => setNewCapsulePostId(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                  >
                    {analytics.posts.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0d0d0f]">
                        {p.caption || `Post du ${p.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={newCapsuleName}
                  onChange={(e) => setNewCapsuleName(e.target.value)}
                  placeholder="Nom du produit"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={newCapsulePrice}
                  onChange={(e) => setNewCapsulePrice(e.target.value)}
                  placeholder="Prix (€)"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
                <input
                  type="number"
                  value={newCapsuleStock}
                  onChange={(e) => setNewCapsuleStock(e.target.value)}
                  placeholder="Stock"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />

                {newCapsuleError && (
                  <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                    {newCapsuleError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={newCapsuleSaving}
                  className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
                >
                  {newCapsuleSaving ? <Loader2 size={16} className="animate-spin" /> : 'Créer la capsule'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {boostOpen && (
        <BoostModal
          post={boostPost ?? undefined}
          open={boostOpen}
          onClose={() => { setBoostOpen(false); setBoostPost(null); }}
        />
      )}

      {topupOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Ajouter des fonds</h2>
              <button onClick={() => setTopupOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleTopup} className="space-y-4">
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Montant (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
              </div>
              {topupError && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                  {topupError}
                </p>
              )}
              <button
                type="submit"
                disabled={topupLoading}
                className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
              >
                {topupLoading ? <Loader2 size={16} className="animate-spin" /> : 'Continuer vers le paiement'}
              </button>
            </form>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">Retirer vers mon compte bancaire</h2>
              <button onClick={() => setWithdrawOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <p className="text-[12px] text-white/40">
                Solde disponible : {(user.walletBalance ?? 0).toFixed(2)} €
              </p>
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Montant (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
              </div>
              {withdrawError && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                  {withdrawError}
                </p>
              )}
              <button
                type="submit"
                disabled={withdrawLoading}
                className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
              >
                {withdrawLoading ? <Loader2 size={16} className="animate-spin" /> : 'Demander le retrait'}
              </button>
            </form>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">Paramètres</h2>
              <button onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <button
              onClick={() => { setSettingsOpen(false); openEdit(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] text-white/80 hover:text-white text-[13px] font-medium transition-all mb-4"
            >
              <Pencil size={15} /> Modifier le profil
            </button>

            <div className="mb-5">
              <label className="block text-[11px] text-white/40 mb-2 font-medium uppercase tracking-wider">
                Langue
              </label>
              <div className="space-y-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => (l.code === 'fr' ? setLanguage('fr') : showComingSoon(`Langue ${l.label}`))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                      l.code === language
                        ? 'bg-[#a8ff35]/10 text-[#a8ff35]'
                        : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'
                    }`}
                  >
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 tracking-wider">
                      {l.code.toUpperCase()}
                    </span>
                    <span className="flex-1 text-left">{l.label}</span>
                    {l.code === language && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-red-500/20 text-red-400 text-[13px] font-semibold hover:bg-red-500/10 transition-all"
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/30">
      <Package size={40} className="mb-3 opacity-30" />
      <p className="text-[14px]">{text}</p>
    </div>
  );
}
