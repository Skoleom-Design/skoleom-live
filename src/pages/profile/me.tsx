import { useState, useEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LogOut, Plus, Trash2, Package, BarChart2, Grid3x3, Loader2, Pencil, Camera, X,
  Heart, Zap, Wallet, ArrowDownToLine, ArrowUpFromLine, Radio, Settings, Check,
  ShoppingBag, Gift, Clock, Truck, MoreVertical, Landmark, CreditCard,
  Image as ImageIcon, Bell, MessageCircle, UserPlus, Video, Sparkles, Upload,
} from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { BoostModal } from '../../client/components/Boost/BoostModal';
import { CapsuleProductForm, CapsuleProductFormHandle } from '../../client/components/Capsule/CapsuleProductForm';
import { CameraCaptureModal } from '../../client/components/Post/CameraCaptureModal';
import { AvatarCategoryPicker } from '../../client/components/Onboarding/AvatarCategoryPicker';
import { PRESET_AVATARS } from '../../client/constants/avatars';
import { api, ApiError, getToken, getStoredUser, clearSession, uploadFile } from '../../shared/api/http';
import type { CapsuleCondition, CapsuleCategory, AppNotification } from '../../shared/types/api';
import { categoryLabel, conditionLabel, subcategoryLabel } from '../../client/constants/capsule';
import { useLanguage } from '../../client/i18n/LanguageContext';

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
  pendingBalance?: number;
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
] as const;

const PLANS: { key: PlanKey; price: string }[] = [
  { key: 'free', price: '0€' },
  { key: 'premium', price: '9,90€' },
  { key: 'ultra', price: '29,90€' },
];

interface CapsuleData {
  id: string;
  name: string;
  brand?: string;
  price: number;
  currency: string;
  stock: number;
  soldCount: number;
  imageUrl?: string;
  condition?: CapsuleCondition;
  category?: CapsuleCategory;
  subcategory?: string;
  size?: string;
  colors?: string[];
  groupId?: string;
  group?: { id: string; name: string };
}

interface PostData {
  id: string;
  caption?: string;
  tags?: string[];
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

interface WalletTransactionData {
  id: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
}

interface OrderData {
  id: string;
  status: 'pending' | 'paid' | 'delivered' | 'refunded';
  amount: number;
  creatorAmount: number;
  currency: string;
  capsule?: { id: string; name: string; imageUrl?: string };
  buyer?: { id: string; username: string; displayName?: string };
  creator?: { id: string; username: string; displayName?: string };
  createdAt: string;
}

interface BuyerStats {
  totalSpent: number;
  capsulesBought: number;
  giftsSent: number;
  giftsSentAmount: number;
}

type Tab = 'posts' | 'capsules' | 'favoris' | 'wallet' | 'stats' | 'notifications';
type StatsView = 'creator' | 'buyer';

export default function ProfilePage() {
  const router = useRouter();
  const { language, setLanguage, t, dict } = useLanguage();
  const [user, setUser] = useState<MeUser | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [myCapsules, setMyCapsules] = useState<CapsuleData[]>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  // Choix d'un avatar preset (gamerpic) — une URL statique, jamais uploadee (voir handleSaveProfile).
  // Mutuellement exclusif avec editAvatarFile : choisir l'un remet l'autre a zero.
  const [editAvatarPresetUrl, setEditAvatarPresetUrl] = useState<string | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarGridOpen, setAvatarGridOpen] = useState(false);
  const [avatarCameraOpen, setAvatarCameraOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [capsuleModalOpen, setCapsuleModalOpen] = useState(false);
  const [newCapsulePostId, setNewCapsulePostId] = useState('');
  const [newCapsuleError, setNewCapsuleError] = useState('');
  const [newCapsuleSaving, setNewCapsuleSaving] = useState(false);
  const newCapsuleFormRef = useRef<CapsuleProductFormHandle>(null);

  // Regroupe les capsules par capsule-groupe (une capsule nommée = plusieurs produits).
  // Les capsules sans groupe (créées avant ce champ) restent affichées seules.
  const capsuleGroups = useMemo(() => {
    const map = new Map<string, { name: string | null; items: CapsuleData[] }>();
    for (const c of myCapsules) {
      const key = c.groupId || `standalone-${c.id}`;
      if (!map.has(key)) map.set(key, { name: c.group?.name || null, items: [] });
      map.get(key)!.items.push(c);
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [myCapsules]);

  const [likedPosts, setLikedPosts] = useState<LikedPost[]>([]);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [boostOpen, setBoostOpen] = useState(false);
  const [boostPost, setBoostPost] = useState<PostData | null>(null);

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('20');
  const [topupError, setTopupError] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMethod, setTopupMethod] = useState<'card' | 'skoleom'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');

  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionData[]>([]);
  const [ordersData, setOrdersData] = useState<{ purchases: OrderData[]; sales: OrderData[] }>({ purchases: [], sales: [] });
  const [buyerStats, setBuyerStats] = useState<BuyerStats | null>(null);
  const [statsView, setStatsView] = useState<StatsView>('creator');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editPostOpen, setEditPostOpen] = useState(false);
  const [editPostTarget, setEditPostTarget] = useState<PostData | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editPostError, setEditPostError] = useState('');
  const [editPostSaving, setEditPostSaving] = useState(false);

  // Remplacement du media (photo/video) — reste vide (media d'origine conserve) tant que
  // l'utilisateur n'a pas choisi un nouveau fichier.
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState('');
  const [editCameraOpen, setEditCameraOpen] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Capsules rattachees au post en cours d'edition — attach/detach sont immediats (comme
  // partout ailleurs dans l'app), independants du bouton "Enregistrer" de la modale.
  const [editAttachedCapsules, setEditAttachedCapsules] = useState<CapsuleData[]>([]);
  const [editCapsuleActionId, setEditCapsuleActionId] = useState<string | null>(null);
  const [editCapsulePickerOpen, setEditCapsulePickerOpen] = useState(false);
  const [editMyCapsules, setEditMyCapsules] = useState<CapsuleData[] | null>(null);
  const [editCapsuleError, setEditCapsuleError] = useState('');

  const [livesCount, setLivesCount] = useState(0);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Independant de l'onglet actif — sert au point rouge sur l'onglet "Notifications" lui-meme
  // (avant, tout /profile/me marquait les notifications comme lues, meme sans ouvrir cet onglet).
  useEffect(() => {
    api.get<{ count: number }>('/notifications/unread-count').then((res) => setUnreadNotifCount(res.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'notifications') return;
    setNotifLoading(true);
    api.get<AppNotification[]>('/notifications').then(setNotifications).catch(() => {}).finally(() => setNotifLoading(false));
    if (unreadNotifCount > 0) {
      api.patch('/notifications/read-all', {}).then(() => setUnreadNotifCount(0)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function showComingSoon(label: string) {
    setNotice(t('profile.comingSoon', { label }));
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
        const [me, stats, liked, capsules, transactions, orders, buyer, lives] = await Promise.all([
          api.get<MeUser>('/auth/me'),
          api.get<Analytics>('/posts/analytics/me'),
          api.get<LikedPost[]>('/posts/liked/me').catch(() => []),
          api.get<CapsuleData[]>('/capsules/mine').catch(() => []),
          api.get<WalletTransactionData[]>('/payments/wallet/transactions').catch(() => []),
          api.get<{ purchases: OrderData[]; sales: OrderData[] }>('/orders/me').catch(() => ({ purchases: [], sales: [] })),
          api.get<BuyerStats>('/orders/me/buyer-stats').catch(() => null),
          api.get<{ count: number }>('/lives/mine/count').catch(() => ({ count: 0 })),
        ]);
        setUser(me);
        setAnalytics(stats);
        setLikedPosts(liked);
        setMyCapsules(capsules);
        setWalletTransactions(transactions);
        setOrdersData(orders);
        setBuyerStats(buyer);
        setLivesCount(lives.count);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('common.genericError'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const queryTab = router.query.tab;
    if (typeof queryTab === 'string' && ['posts', 'capsules', 'favoris', 'wallet', 'transactions', 'stats'].includes(queryTab)) {
      setTab(queryTab as Tab);
    }
    // Permet aux autres pages (ex: le picker d'enchère du studio, sans capsule disponible) de
    // renvoyer directement ici avec la modale de création déjà ouverte.
    if (router.query.openCapsule === '1') openCapsuleModal();
  }, [router.isReady, router.query.tab, router.query.openCapsule]);

  async function handleMarkDelivered(orderId: string) {
    setDeliveringId(orderId);
    try {
      await api.patch(`/orders/${orderId}/deliver`, {});
      const refreshed = await api.get<{ purchases: OrderData[]; sales: OrderData[] }>('/orders/me');
      setOrdersData(refreshed);
      const me = await api.get<MeUser>('/auth/me');
      setUser(me);
    } catch {
      // silent — la liste reflète toujours l'état serveur au prochain rechargement
    } finally {
      setDeliveringId(null);
    }
  }

  async function handleChangePlan(plan: PlanKey) {
    if (!user || plan === user.plan) return;
    setPlanSaving(true);
    setPlanError('');
    try {
      const updated = await api.patch<MeUser>('/users/me', { plan });
      setUser((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setPlanSaving(false);
    }
  }

  async function refreshWalletTransactions() {
    try {
      const transactions = await api.get<WalletTransactionData[]>('/payments/wallet/transactions');
      setWalletTransactions(transactions);
    } catch {
      // best-effort — le solde affiché reste correct meme si l'historique ne se rafraichit pas
    }
  }

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    setTopupError('');
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) {
      setTopupError(t('profile.invalidAmount'));
      return;
    }
    // Aucun vrai processeur de paiement n'est branché — ces coordonnées bancaires ne sont
    // jamais envoyées au serveur, elles ne servent qu'à simuler un vrai formulaire de paiement.
    if (topupMethod === 'card') {
      if (!/^\d{16}$/.test(cardNumber.replace(/\s/g, ''))) {
        setTopupError(t('profile.invalidCard'));
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
        setTopupError(t('profile.invalidCardExpiry'));
        return;
      }
      if (!/^\d{3}$/.test(cardCvc)) {
        setTopupError(t('profile.invalidCardCvc'));
        return;
      }
    }
    setTopupLoading(true);
    try {
      const res = await api.post<{ walletBalance: number }>('/payments/wallet/topup', { amount });
      setUser((prev) => (prev ? { ...prev, walletBalance: res.walletBalance } : prev));
      await refreshWalletTransactions();
      setTopupOpen(false);
      setTopupAmount('20');
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
    } catch (err) {
      setTopupError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setTopupLoading(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError('');
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setWithdrawError(t('profile.invalidAmount'));
      return;
    }
    setWithdrawLoading(true);
    try {
      const res = await api.post<{ walletBalance: number }>('/payments/wallet/withdraw', { amount });
      setUser((prev) => (prev ? { ...prev, walletBalance: res.walletBalance } : prev));
      await refreshWalletTransactions();
      setWithdrawOpen(false);
      setWithdrawAmount('');
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setWithdrawLoading(false);
    }
  }

  async function handleRemoveCapsule(capsuleId: string) {
    try {
      await api.delete(`/capsules/${capsuleId}`);
      setMyCapsules((prev) => prev.filter((c) => c.id !== capsuleId));
    } catch {
      // silent — la liste reflète toujours l'état serveur au prochain rechargement
    }
  }

  async function handleDeletePost(postId: string) {
    if (!window.confirm(t('profile.confirmDeletePost'))) return;
    try {
      await api.delete(`/posts/${postId}`);
      setAnalytics((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev));
    } catch {
      // silent — la liste reflète toujours l'état serveur au prochain rechargement
    }
  }

  function openEditPost(post: PostData) {
    setEditPostTarget(post);
    setEditCaption(post.caption || '');
    setEditTags(post.tags || []);
    setEditTagInput('');
    setEditFile(null);
    setEditPreview('');
    setEditAttachedCapsules(post.capsules || []);
    setEditCapsulePickerOpen(false);
    setEditCapsuleError('');
    setEditPostError('');
    setEditPostOpen(true);
    setOpenMenuPostId(null);
  }

  function applyEditFile(file: File) {
    setEditFile(file);
    setEditPreview(URL.createObjectURL(file));
  }

  function onEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) applyEditFile(f);
  }

  async function openEditCapsulePicker() {
    setEditCapsuleError('');
    setEditCapsulePickerOpen(true);
    if (editMyCapsules === null) {
      try {
        setEditMyCapsules(await api.get<CapsuleData[]>('/capsules/mine'));
      } catch {
        setEditMyCapsules([]);
      }
    }
  }

  // Garde la carte du post (sous la modale) synchronisee avec les attach/detach immediats,
  // pour ne pas afficher un nombre de capsules perime tant que la modale est ouverte.
  function syncPostCapsules(postId: string, capsules: CapsuleData[]) {
    setEditPostTarget((prev) => (prev && prev.id === postId ? { ...prev, capsules } : prev));
    setAnalytics((prev) =>
      prev ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? { ...p, capsules } : p)) } : prev,
    );
  }

  async function attachExistingCapsule(capsule: CapsuleData) {
    if (!editPostTarget) return;
    setEditCapsuleActionId(capsule.id);
    setEditCapsuleError('');
    try {
      await api.post(`/capsules/${capsule.id}/attach`, { postId: editPostTarget.id });
      const updated = [...editAttachedCapsules, capsule];
      setEditAttachedCapsules(updated);
      syncPostCapsules(editPostTarget.id, updated);
      setEditCapsulePickerOpen(false);
    } catch (err) {
      setEditCapsuleError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setEditCapsuleActionId(null);
    }
  }

  async function detachCapsule(capsuleId: string) {
    if (!editPostTarget) return;
    setEditCapsuleActionId(capsuleId);
    setEditCapsuleError('');
    try {
      await api.post(`/capsules/${capsuleId}/detach`, { postId: editPostTarget.id });
      const updated = editAttachedCapsules.filter((c) => c.id !== capsuleId);
      setEditAttachedCapsules(updated);
      syncPostCapsules(editPostTarget.id, updated);
    } catch (err) {
      setEditCapsuleError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setEditCapsuleActionId(null);
    }
  }

  function addEditTag() {
    const tag = editTagInput.trim().replace(/^#/, '');
    if (!tag || editTags.includes(tag)) {
      setEditTagInput('');
      return;
    }
    setEditTags((prev) => [...prev, tag]);
    setEditTagInput('');
  }

  function removeEditTag(tag: string) {
    setEditTags((prev) => prev.filter((x) => x !== tag));
  }

  async function handleUpdatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!editPostTarget) return;
    setEditPostError('');
    setEditPostSaving(true);
    try {
      let media: { mediaUrl: string; type: 'photo' | 'video' } | undefined;
      if (editFile) {
        const mediaUrl = await uploadFile(editFile, 'posts');
        media = { mediaUrl, type: editFile.type.startsWith('video/') ? 'video' : 'photo' };
      }
      const updated = await api.patch<PostData>(`/posts/${editPostTarget.id}`, {
        caption: editCaption.trim() || undefined,
        tags: editTags,
        ...media,
      });
      setAnalytics((prev) =>
        prev
          ? { ...prev, posts: prev.posts.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) }
          : prev,
      );
      setEditFile(null);
      setEditPreview('');
      setEditPostOpen(false);
    } catch (err) {
      setEditPostError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setEditPostSaving(false);
    }
  }

  function handleLogout() {
    api.post('/auth/logout').catch(() => {});
    clearSession();
    router.push('/auth/login');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/users/me');
      clearSession();
      router.push('/auth/login');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t('profile.deleteAccountError'));
      setDeleting(false);
    }
  }

  function openEdit() {
    if (!user) return;
    setEditDisplayName(user.displayName || '');
    setEditBio(user.bio || '');
    setEditAvatarFile(null);
    setEditAvatarPresetUrl(null);
    setEditAvatarPreview(user.avatarUrl || '');
    setEditError('');
    setEditOpen(true);
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditAvatarFile(f);
    setEditAvatarPresetUrl(null);
    setEditAvatarPreview(URL.createObjectURL(f));
    setAvatarMenuOpen(false);
  }

  function pickPresetAvatar(url: string) {
    setEditAvatarPresetUrl(url);
    setEditAvatarFile(null);
    setEditAvatarPreview(url);
    setAvatarGridOpen(false);
  }

  function onAvatarCaptured(file: File) {
    setEditAvatarFile(file);
    setEditAvatarPresetUrl(null);
    setEditAvatarPreview(URL.createObjectURL(file));
    setAvatarCameraOpen(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;

      if (editAvatarPresetUrl) {
        avatarUrl = editAvatarPresetUrl;
      } else if (editAvatarFile) {
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
        if (!putRes.ok) throw new Error(t('profile.photoUploadFailed'));
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
      setEditError(err instanceof ApiError || err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setEditSaving(false);
    }
  }

  function openCapsuleModal() {
    setNewCapsulePostId('');
    setNewCapsuleError('');
    setCapsuleModalOpen(true);
  }

  async function handleCreateCapsule(e: React.FormEvent) {
    e.preventDefault();
    setNewCapsuleError('');

    const name = newCapsuleFormRef.current?.getGroupName();
    if (!name) return;
    const products = newCapsuleFormRef.current?.getProducts();
    if (!products) return;

    setNewCapsuleSaving(true);
    try {
      await api.post('/capsules/groups', {
        name,
        postId: newCapsulePostId || undefined,
        products,
      });
      const refreshed = await api.get<CapsuleData[]>('/capsules/mine');
      setMyCapsules(refreshed);
      setCapsuleModalOpen(false);
    } catch (err) {
      setNewCapsuleError(err instanceof ApiError ? err.message : t('common.genericError'));
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

  const TABS = [
    { key: 'posts' as Tab, label: t('profile.posts'), icon: Grid3x3 },
    { key: 'capsules' as Tab, label: t('profile.capsules'), icon: Package },
    { key: 'favoris' as Tab, label: t('profile.favorites'), icon: Heart },
    { key: 'wallet' as Tab, label: t('profile.wallet'), icon: Wallet },
    { key: 'stats' as Tab, label: t('profile.stats'), icon: BarChart2 },
    { key: 'notifications' as Tab, label: t('profile.notifications'), icon: Bell },
  ];

  return (
    <>
      <Head><title>{t('profile.myProfile')} — skoleomLive</title></Head>
      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[700px] mx-auto px-4 py-8 pb-20 md:pb-8">

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
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link href="/studio"
                  className="btn-skoleom flex items-center gap-2 px-4 py-2 rounded-full text-[13px] hover:shadow-glow-lime-sm transition-all">
                  <Plus size={14} /> {t('profile.newPost')}
                </Link>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => router.push('/studio/live')}
                    title={t('profile.startLive')}
                    className="w-9 h-9 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <Radio size={15} className="text-red-400" />
                  </button>
                  <button
                    onClick={() => { setBoostPost(null); setBoostOpen(true); }}
                    title={t('profile.boostAccount')}
                    className="w-9 h-9 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <Zap size={15} className="text-[#a8ff35]" />
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    title={t('profile.settings')}
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
              {TABS.map((tabItem) => {
                const Icon = tabItem.icon;
                const active = tab === tabItem.key;
                return (
                  <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all -mb-px ${active ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                    <span className="relative">
                      <Icon size={15} />
                      {tabItem.key === 'notifications' && unreadNotifCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-black/80" />
                      )}
                    </span>
                    {tabItem.label}
                  </button>
                );
              })}
            </div>

            {tab === 'posts' && (
              analytics.posts.length === 0 ? (
                <EmptyState text={t('profile.noPostsYet')} />
              ) : (
                <>
                {openMenuPostId && (
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuPostId(null)} />
                )}
                <div className="grid grid-cols-3 gap-1">
                  {analytics.posts.map((post) => (
                    <div key={post.id} className="relative aspect-square group">
                      {/* Bordure degradee cyan/lime — meme traitement que sur /post/[id] et le studio */}
                      <div className="absolute inset-0 rounded-lg p-[1.5px] bg-gradient-to-br from-[#00ffff]/50 via-[#a8ff35]/45 to-[#00ffff]/15">
                        <div className="w-full h-full rounded-lg overflow-hidden bg-white/[0.04]">
                          <Link href={`/post/${post.id}`} className="block w-full h-full">
                            {post.thumbnailUrl || post.type === 'photo' ? (
                              <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
                            )}
                          </Link>
                        </div>
                      </div>
                      <button
                        onClick={() => { setBoostPost(post); setBoostOpen(true); }}
                        title={t('profile.boostPost')}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all"
                      >
                        <Zap size={13} className="text-[#a8ff35]" />
                      </button>
                      <div
                        className={`absolute top-1.5 left-1.5 transition-opacity ${
                          openMenuPostId === post.id ? 'opacity-100 z-20' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <button
                          onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                          title={t('profile.postOptions')}
                          className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/80 transition-all"
                        >
                          <MoreVertical size={13} className="text-white" />
                        </button>
                        {openMenuPostId === post.id && (
                          <div className="absolute top-9 left-0 w-44 bg-[#0d0d0f] border border-white/[0.08] rounded-xl shadow-xl overflow-hidden">
                            <button
                              onClick={() => openEditPost(post)}
                              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-white hover:bg-white/[0.08] transition-all"
                            >
                              <Pencil size={14} /> {t('profile.editPost')}
                            </button>
                            <button
                              onClick={() => { setOpenMenuPostId(null); handleDeletePost(post.id); }}
                              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 size={14} /> {t('profile.moveToTrash')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )
            )}

            {tab === 'capsules' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[13px] font-semibold text-white/70 uppercase tracking-wider mb-3">
                    {t('profile.subscriptionTitle')}
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
                            {active && <span className="text-[10px] font-bold text-[#a8ff35]">{t('profile.current')}</span>}
                          </div>
                          <p className="text-[12px] text-white/40 mb-2">{p.price}{t('profile.perMonth')}</p>
                          <ul className="space-y-1">
                            {dict.profile.planPerks[p.key].map((perk) => (
                              <li key={perk} className="text-[11px] text-white/50">• {perk}</li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                  {planError && <p className="text-red-400 text-xs">{planError}</p>}
                  <p className="text-[11px] text-white/25">
                    {t('profile.planNoPayment')}
                  </p>
                </div>

                <button
                  onClick={openCapsuleModal}
                  className="btn-skoleom flex items-center gap-2 px-4 py-2 rounded-full text-[13px] hover:shadow-glow-lime-sm transition-all"
                >
                  <Plus size={14} /> {t('profile.createCapsule')}
                </button>

                {myCapsules.length === 0 ? (
                  <EmptyState text={t('profile.noCapsulesYet')} />
                ) : (
                  <div className="space-y-3">
                    {capsuleGroups.map((group) => (
                    <div key={group.key} className="bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-3 space-y-2">
                      {group.name && (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a8ff35] px-1">
                          Capsule · {group.name}
                        </p>
                      )}
                      {group.items.map((c) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-white/25" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-white truncate">{c.name}{c.brand ? ` · ${c.brand}` : ''}</p>
                            <p className="text-[12px] text-white/40">
                              {c.price.toFixed(2)} {c.currency} · {c.soldCount} {t('profile.sold')} · {c.stock} {t('profile.inStock')}
                              {c.category && c.subcategory && ` · ${subcategoryLabel(t, c.category, c.subcategory)}`}
                              {c.category && !c.subcategory && ` · ${categoryLabel(t, c.category)}`}
                              {c.size && ` · ${c.size}`}
                              {c.condition && ` · ${conditionLabel(t, c.condition)}`}
                            </p>
                          </div>
                          <button onClick={() => handleRemoveCapsule(c.id)}
                            className="w-8 h-8 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/25 hover:text-red-400 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'favoris' && (
              likedPosts.length === 0 ? (
                <EmptyState text={t('profile.noFavoritesYet')} />
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
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">{t('profile.walletBalance')}</p>
                  <p className="text-[32px] font-extrabold text-white mb-4">
                    {(user.walletBalance ?? 0).toFixed(2)} €
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setTopupOpen(true); setTopupError(''); setTopupMethod('card'); }}
                      className="btn-skoleom flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[13px] hover:shadow-glow-lime-sm transition-all"
                    >
                      <ArrowDownToLine size={14} /> {t('profile.addFunds')}
                    </button>
                    <button
                      onClick={() => { setWithdrawOpen(true); setWithdrawError(''); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full border border-white/10 text-white/70 text-[13px] font-semibold hover:text-white hover:border-white/25 transition-all"
                    >
                      <ArrowUpFromLine size={14} /> {t('profile.withdraw')}
                    </button>
                  </div>
                  <button
                    onClick={() => showComingSoon('Skoleom Wallet')}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-full border border-dashed border-white/10 text-white/40 text-[12px] font-medium hover:text-white/60 hover:border-white/20 transition-all"
                  >
                    <Landmark size={13} /> {t('profile.comingSoon', { label: 'Skoleom Wallet' })}
                  </button>
                </div>
                {(user.pendingBalance ?? 0) > 0 && (
                  <div className="bg-amber-400/[0.06] border border-amber-400/20 rounded-[16px] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-400/15 flex items-center justify-center shrink-0">
                      <Clock size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[12px] text-amber-400/80">{t('profile.pendingBalance')}</p>
                      <p className="text-[16px] font-bold text-white">{(user.pendingBalance ?? 0).toFixed(2)} €</p>
                    </div>
                  </div>
                )}

                <div className="bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
                  <p className="text-[12px] text-white/40">{t('profile.totalRevenue')}</p>
                  <p className="text-[18px] font-bold text-white">{(user.totalEarnings ?? 0).toFixed(2)} €</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={12} /> {t('profile.myPurchases')}
                  </p>
                  {ordersData.purchases.length === 0 ? (
                    <EmptyState text={t('profile.noPurchases')} />
                  ) : (
                    <div className="space-y-2">
                      {ordersData.purchases.map((o) => (
                        <div key={o.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-[14px] p-3">
                          <div className="w-11 h-11 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                            {o.capsule?.imageUrl ? (
                              <img src={o.capsule.imageUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Package size={16} className="text-white/25" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-white truncate">{o.capsule?.name || '—'}</p>
                            <p className="text-[11px] text-white/40">{o.amount.toFixed(2)} {o.currency} · {new Date(o.createdAt).toLocaleDateString()}</p>
                          </div>
                          <StatusBadge status={o.status} t={t} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2 flex items-center gap-1.5">
                    <Package size={12} /> {t('profile.mySales')}
                  </p>
                  {ordersData.sales.length === 0 ? (
                    <EmptyState text={t('profile.noSales')} />
                  ) : (
                    <div className="space-y-2">
                      {ordersData.sales.map((o) => (
                        <div key={o.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-[14px] p-3">
                          <div className="w-11 h-11 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                            {o.capsule?.imageUrl ? (
                              <img src={o.capsule.imageUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Package size={16} className="text-white/25" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-white truncate">{o.capsule?.name || '—'}</p>
                            <p className="text-[11px] text-white/40">{o.creatorAmount.toFixed(2)} {o.currency} · {new Date(o.createdAt).toLocaleDateString()}</p>
                          </div>
                          {o.status === 'paid' ? (
                            <button
                              onClick={() => handleMarkDelivered(o.id)}
                              disabled={deliveringId === o.id}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#a8ff35] text-black text-[11px] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                              {deliveringId === o.id ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
                              {t('profile.markDelivered')}
                            </button>
                          ) : (
                            <StatusBadge status={o.status} t={t} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">
                    {t('profile.transactionHistory')}
                  </p>
                  {walletTransactions.length === 0 ? (
                    <p className="text-[13px] text-white/30">{t('profile.noTransactions')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {walletTransactions.map((wtx) => (
                        <div key={wtx.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-3.5 py-2.5">
                          <div className="min-w-0">
                            <p className="text-[13px] text-white/80 truncate">{wtx.description || t(`profile.txType.${wtx.type}`)}</p>
                            <p className="text-[11px] text-white/30">{new Date(wtx.createdAt).toLocaleDateString()}</p>
                          </div>
                          <p className={`text-[13px] font-bold shrink-0 ${wtx.amount >= 0 ? 'text-green-400' : 'text-white/60'}`}>
                            {wtx.amount >= 0 ? '+' : ''}{wtx.amount.toFixed(2)} €
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <div className="max-w-sm">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setStatsView('creator')}
                    className={`flex-1 py-2 rounded-full text-[13px] font-semibold border transition-all ${
                      statsView === 'creator' ? 'bg-[#a8ff35] text-black border-[#a8ff35]' : 'bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {t('profile.statsCreator')}
                  </button>
                  <button
                    onClick={() => setStatsView('buyer')}
                    className={`flex-1 py-2 rounded-full text-[13px] font-semibold border transition-all ${
                      statsView === 'buyer' ? 'bg-[#a8ff35] text-black border-[#a8ff35]' : 'bg-white/[0.04] text-white/60 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {t('profile.statsBuyer')}
                  </button>
                </div>

                {statsView === 'creator' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: t('profile.totalViews'), value: analytics.totals.views },
                      { label: t('profile.totalLikes'), value: analytics.totals.likes },
                      { label: t('profile.capsulesSold'), value: analytics.totals.sold },
                      { label: t('profile.netRevenue'), value: `${analytics.totals.revenue.toFixed(2)} €` },
                      { label: t('profile.totalPosts'), value: analytics.posts.length },
                      { label: t('profile.totalLives'), value: livesCount },
                    ].map((s) => (
                      <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
                        <p className="text-[20px] font-extrabold text-white">{s.value}</p>
                        <p className="text-[12px] text-white/40 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: t('profile.capsulesBought'), value: buyerStats?.capsulesBought ?? 0 },
                        { label: t('profile.giftsSent'), value: buyerStats?.giftsSent ?? 0 },
                      ].map((s) => (
                        <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
                          <p className="text-[20px] font-extrabold text-white">{s.value}</p>
                          <p className="text-[12px] text-white/40 mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const totalSpent = buyerStats?.totalSpent ?? 0;
                      const { next, progress, remaining } = getSpendProgress(totalSpent);
                      return (
                        <div className="bg-gradient-to-r from-[#a8ff35]/10 to-[#6fe600]/5 border border-[#a8ff35]/20 rounded-[16px] p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[13px] font-bold text-white flex items-center gap-1.5">
                              <Gift size={14} className="text-[#a8ff35]" />
                              {next ? t('profile.nextReward', { reward: next.reward }) : t('profile.allRewardsUnlocked')}
                            </p>
                            <p className="text-[12px] text-white/40">{totalSpent.toFixed(2)} €</p>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#a8ff35] to-[#6fe600] rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {next && (
                            <p className="text-[11px] text-white/35 mt-1.5">
                              {t('profile.remainingToUnlock', { amount: remaining.toFixed(2) })}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {tab === 'notifications' && (
              notifLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-white/40" size={24} />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState text={t('profile.noNotificationsYet')} />
              ) : (
                <div className="space-y-1.5">
                  {notifications.map((n) => {
                    const Icon = { like: Heart, comment: MessageCircle, follow: UserPlus, new_post: Grid3x3, live_started: Video }[n.type] || Bell;
                    const href = n.type === 'follow'
                      ? `/profile/${n.actor.id}`
                      : n.type === 'live_started' && n.live
                        ? `/live/${n.live.id}`
                        : n.post
                          ? `/post/${n.post.id}`
                          : `/profile/${n.actor.id}`;
                    return (
                      <Link
                        key={n.id}
                        href={href}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${n.read ? 'hover:bg-white/[0.03]' : 'bg-white/[0.04] hover:bg-white/[0.06]'}`}
                      >
                        <div className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {n.actor.avatarUrl ? (
                            <img src={n.actor.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white/70 text-xs font-bold">{n.actor.username[0]?.toUpperCase()}</span>
                          )}
                          <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#0d0d0f] border border-white/10 flex items-center justify-center">
                            <Icon size={9} className="text-[#a8ff35]" />
                          </span>
                        </div>
                        <p className="flex-1 text-[13px] text-white/85 leading-snug">
                          <span className="font-semibold text-white">{n.actor.displayName || n.actor.username}</span>{' '}
                          {t(`profile.notifText.${n.type}`)}
                        </p>
                        {(n.post?.thumbnailUrl || n.post?.mediaUrl) && (
                          <img src={n.post.thumbnailUrl || n.post.mediaUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        )}
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#a8ff35] shrink-0" />}
                      </Link>
                    );
                  })}
                </div>
              )
            )}

          </div>
        </main>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="cosmic-modal w-full max-w-sm overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">{t('profile.editProfile')}</h2>
              <button onClick={() => setEditOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="relative flex flex-col items-center gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((o) => !o)}
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
                  onClick={() => setAvatarMenuOpen((o) => !o)}
                  className="text-xs text-[#a8ff35] font-semibold hover:underline"
                >
                  {t('profile.changePhoto')}
                </button>

                {avatarMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setAvatarMenuOpen(false)} />
                    <div className="absolute top-full mt-1 z-30 w-56 bg-[#181818] border border-white/[0.1] rounded-xl shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setAvatarMenuOpen(false); setAvatarCameraOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Camera size={15} /> {t('profile.takePhoto')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAvatarMenuOpen(false); setAvatarGridOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Sparkles size={15} /> {t('profile.chooseAvatarPreset')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAvatarMenuOpen(false); avatarInputRef.current?.click(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Upload size={15} /> {t('profile.importPhoto')}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.displayName')}
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
                  {t('profile.bio')}
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
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
                {editSaving ? <Loader2 size={16} className="animate-spin" /> : t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {avatarGridOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="cosmic-modal w-full max-w-sm overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">{t('profile.chooseAvatarPreset')}</h2>
              <button onClick={() => setAvatarGridOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <AvatarCategoryPicker cosmicOptions={PRESET_AVATARS} value={editAvatarPresetUrl || ''} onChange={pickPresetAvatar} />
          </div>
        </div>
      )}

      <CameraCaptureModal open={avatarCameraOpen} onClose={() => setAvatarCameraOpen(false)} onCapture={onAvatarCaptured} photoOnly />

      {capsuleModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="cosmic-modal w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <h2 className="text-white font-bold text-base">{t('profile.createCapsule')}</h2>
              <button onClick={() => setCapsuleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateCapsule} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-1">
                <div>
                  <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                    {t('profile.attachToPost')}
                  </label>
                  <select
                    value={newCapsulePostId}
                    onChange={(e) => setNewCapsulePostId(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                  >
                    <option value="" className="bg-[#0d0d0f]">{t('studio.noPost')}</option>
                    {analytics.posts.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0d0d0f]">
                        {p.caption || `Post ${p.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <CapsuleProductForm ref={newCapsuleFormRef} />

                {newCapsuleError && (
                  <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                    {newCapsuleError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={newCapsuleSaving}
                className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2 mt-4 shrink-0"
              >
                {newCapsuleSaving ? <Loader2 size={16} className="animate-spin" /> : t('studio.addCapsule')}
              </button>
            </form>
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
          <div className="cosmic-modal w-full max-w-sm overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">{t('profile.addFundsTitle')}</h2>
              <button onClick={() => setTopupOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleTopup} className="space-y-4">
              <div className="relative flex bg-white/[0.05] rounded-full p-1">
                <div
                  className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out"
                  style={{ transform: topupMethod === 'skoleom' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
                />
                <button
                  type="button"
                  onClick={() => setTopupMethod('card')}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-semibold transition-colors duration-300 ${
                    topupMethod === 'card' ? 'text-black' : 'text-white/50'
                  }`}
                >
                  <CreditCard size={13} /> {t('profile.addFundsMethodCard')}
                </button>
                <button
                  type="button"
                  onClick={() => setTopupMethod('skoleom')}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-semibold transition-colors duration-300 ${
                    topupMethod === 'skoleom' ? 'text-black' : 'text-white/50'
                  }`}
                >
                  <Landmark size={13} /> {t('profile.addFundsMethodWallet')}
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.amount')}
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

              {topupMethod === 'card' ? (
                <div key="card" className="space-y-3 animate-fade-in">
                  <div>
                    <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                      {t('profile.cardNumber')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                        {t('profile.cardExpiry')}
                      </label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        maxLength={5}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                        {t('profile.cardCvc')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        maxLength={3}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p key="skoleom" className="text-[12px] text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 animate-fade-in">
                  {t('profile.addFundsSkoleomWalletHint')}
                </p>
              )}

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
                {topupLoading ? <Loader2 size={16} className="animate-spin" /> : t('profile.continueToPayment')}
              </button>
            </form>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="cosmic-modal w-full max-w-sm overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">{t('profile.withdrawTitle')}</h2>
              <button onClick={() => setWithdrawOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <p className="text-[12px] text-white/40">
                {t('profile.availableBalance', { amount: (user.walletBalance ?? 0).toFixed(2) })}
              </p>
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.amount')}
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
                {withdrawLoading ? <Loader2 size={16} className="animate-spin" /> : t('profile.requestWithdraw')}
              </button>
            </form>
          </div>
        </div>
      )}

      {editPostOpen && editPostTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="cosmic-modal w-full max-w-md max-h-[88vh] overflow-y-auto scrollbar-hide border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base">{t('profile.editPost')}</h2>
              <button onClick={() => setEditPostOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleUpdatePost} className="space-y-4">
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.mediaLabel')}
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/[0.05] border border-white/[0.08] shrink-0 flex items-center justify-center">
                    {editPreview ? (
                      editFile?.type.startsWith('video/') ? (
                        <video src={editPreview} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={editPreview} className="w-full h-full object-cover" alt="" />
                      )
                    ) : editPostTarget.type === 'video' ? (
                      <video src={editPostTarget.mediaUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={editPostTarget.mediaUrl} className="w-full h-full object-cover" alt="" />
                    )}
                    {editPreview && (
                      <button
                        type="button"
                        onClick={() => { setEditFile(null); setEditPreview(''); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
                      >
                        <X size={11} className="text-white" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditCameraOpen(true)}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 text-[11px] font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
                    >
                      <Camera size={16} />
                      {t('capsuleForm.takePhoto')}
                    </button>
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 text-[11px] font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
                    >
                      <ImageIcon size={16} />
                      {t('capsuleForm.importPhoto')}
                    </button>
                  </div>
                  <input ref={editFileInputRef} type="file" accept="image/*,video/*" onChange={onEditFileChange} className="hidden" />
                </div>
                {editPreview && (
                  <p className="text-[11px] text-[#a8ff35] mt-1.5">{t('profile.newMediaReady')}</p>
                )}
                <CameraCaptureModal open={editCameraOpen} onClose={() => setEditCameraOpen(false)} onCapture={applyEditFile} />
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.captionLabel')}
                </label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={3}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.tagsLabel')}
                </label>
                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-full pl-2.5 pr-1.5 py-1 text-[12px] text-white/70">
                        #{tag}
                        <button type="button" onClick={() => removeEditTag(tag)} className="w-4 h-4 rounded-full hover:bg-white/20 flex items-center justify-center">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditTag(); } }}
                    placeholder={t('studio.addTagPlaceholder')}
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addEditTag}
                    disabled={!editTagInput.trim()}
                    className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.1] disabled:opacity-40 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.attachedCapsulesLabel')}
                </label>
                {editAttachedCapsules.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {editAttachedCapsules.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-xl p-2">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={12} className="text-white/25" />
                          )}
                        </div>
                        <span className="flex-1 min-w-0 text-[13px] text-white truncate">{c.name}</span>
                        <button
                          type="button"
                          onClick={() => detachCapsule(c.id)}
                          disabled={editCapsuleActionId === c.id}
                          className="w-6 h-6 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/30 hover:text-red-400 transition-all disabled:opacity-40 shrink-0"
                        >
                          {editCapsuleActionId === c.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {editCapsulePickerOpen ? (
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2">
                    {editMyCapsules === null ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-white/30" />
                      </div>
                    ) : (
                      (() => {
                        const available = editMyCapsules.filter((c) => !editAttachedCapsules.some((a) => a.id === c.id));
                        return available.length === 0 ? (
                          <p className="text-white/30 text-xs text-center py-2">{t('profile.noOtherCapsuleAvailable')}</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                            {available.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => attachExistingCapsule(c)}
                                disabled={editCapsuleActionId === c.id}
                                className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-left transition-all disabled:opacity-50"
                              >
                                <div className="w-8 h-8 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                                  {c.imageUrl ? (
                                    <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Package size={12} className="text-white/25" />
                                  )}
                                </div>
                                <span className="flex-1 min-w-0 text-[13px] text-white truncate">{c.name}</span>
                                {editCapsuleActionId === c.id && <Loader2 size={12} className="animate-spin text-white/40 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        );
                      })()
                    )}
                    <button
                      type="button"
                      onClick={() => setEditCapsulePickerOpen(false)}
                      className="w-full py-1.5 text-white/35 hover:text-white/60 text-[11px] transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openEditCapsulePicker}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 text-[12px] font-medium hover:bg-white/[0.04] hover:text-white hover:border-white/25 transition-all"
                  >
                    <Plus size={13} /> {t('profile.attachExistingCapsule')}
                  </button>
                )}

                {editCapsuleError && (
                  <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-xl border border-red-400/20 mt-2">
                    {editCapsuleError}
                  </p>
                )}
              </div>

              {editPostError && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                  {editPostError}
                </p>
              )}
              <button
                type="submit"
                disabled={editPostSaving}
                className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
              >
                {editPostSaving ? <Loader2 size={16} className="animate-spin" /> : t('profile.saveChanges')}
              </button>
            </form>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="cosmic-modal w-full max-w-sm overflow-hidden border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">{t('profile.settings')}</h2>
              <button onClick={() => { setSettingsOpen(false); setDeleteConfirmOpen(false); setDeleteError(''); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <button
              onClick={() => { setSettingsOpen(false); openEdit(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] text-white/80 hover:text-white text-[13px] font-medium transition-all mb-4"
            >
              <Pencil size={15} /> {t('profile.editProfile')}
            </button>

            <div className="mb-5">
              <label className="block text-[11px] text-white/40 mb-2 font-medium uppercase tracking-wider">
                {t('profile.language')}
              </label>
              <div className="space-y-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => (l.code === 'fr' || l.code === 'en' ? setLanguage(l.code) : showComingSoon(l.label))}
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-red-500/20 text-red-400 text-[13px] font-semibold hover:bg-red-500/10 transition-all mb-3"
            >
              <LogOut size={14} /> {t('profile.logout')}
            </button>

            {deleteConfirmOpen ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-3.5">
                <p className="text-red-300/90 text-[12px] leading-relaxed mb-3">
                  {t('profile.deleteAccountWarning')}
                </p>
                {deleteError && (
                  <p className="text-red-400 text-[12px] mb-3">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteConfirmOpen(false); setDeleteError(''); }}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-full text-[12px] font-semibold text-white/60 border border-white/[0.1] hover:bg-white/[0.05] transition-all disabled:opacity-50"
                  >
                    {t('profile.deleteAccountCancel')}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-full text-[12px] font-bold text-white bg-red-500/90 hover:bg-red-500 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : t('profile.deleteAccountConfirm')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-white/30 text-[12px] font-medium hover:text-red-400 transition-all"
              >
                <Trash2 size={13} /> {t('profile.deleteAccount')}
              </button>
            )}
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

const ORDER_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending: { color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
  paid: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  delivered: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  refunded: { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const style = ORDER_STATUS_STYLE[status] || ORDER_STATUS_STYLE.pending;
  return (
    <span
      className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
      style={{ color: style.color, background: style.bg }}
    >
      {t(`profile.orderStatus.${status}`)}
    </span>
  );
}

// Paliers de dépense cumulée (achats + cadeaux) qui débloquent une récompense — purement
// une mécanique d'engagement affichée côté client, aucune livraison de cadeau réelle.
const SPEND_TIERS = [
  { threshold: 20, reward: 'Badge Bronze 🥉' },
  { threshold: 50, reward: 'Cadeau surprise 🎁' },
  { threshold: 100, reward: 'Badge Or 🏆 + cadeau premium' },
];

function getSpendProgress(totalSpent: number) {
  const next = SPEND_TIERS.find((tier) => totalSpent < tier.threshold);
  if (!next) return { next: null as typeof SPEND_TIERS[number] | null, progress: 100, remaining: 0 };
  const prevThreshold = [...SPEND_TIERS].reverse().find((tier) => tier.threshold <= totalSpent)?.threshold ?? 0;
  const progress = ((totalSpent - prevThreshold) / (next.threshold - prevThreshold)) * 100;
  return { next, progress: Math.max(0, Math.min(100, progress)), remaining: next.threshold - totalSpent };
}
