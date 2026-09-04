import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Camera, Image as ImageIcon, Loader2, Package, Radio, Gavel, Import, Plus, X, Music, Play, Pause, Sparkles } from 'lucide-react';
import { AppSidebar } from '../../client/components/Layout/Sidebar';
import { CameraCaptureModal } from '../../client/components/Post/CameraCaptureModal';
import { InstagramImportModal } from '../../client/components/Post/InstagramImportModal';
import { CapsuleProductForm, CapsuleProductFormHandle } from '../../client/components/Capsule/CapsuleProductForm';
import { api, ApiError, getToken, getStoredUser } from '../../shared/api/http';
import type { Capsule } from '../../shared/types/api';
import { useLanguage } from '../../client/i18n/LanguageContext';
import { MUSIC_LIBRARY } from '../../client/constants/music';

type Step = 'form' | 'capsule' | 'done';
type CapsuleMode = 'existing' | 'new';

interface StudioUser {
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export default function StudioPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<StudioUser | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [musicTrackId, setMusicTrackId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);

  const [postId, setPostId] = useState<string>('');
  const [capsuleMode, setCapsuleMode] = useState<CapsuleMode>('new');
  const [myCapsules, setMyCapsules] = useState<Capsule[] | null>(null);
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string>('');
  const [capsuleError, setCapsuleError] = useState('');
  const [capsuleLoading, setCapsuleLoading] = useState(false);
  const productFormRef = useRef<CapsuleProductFormHandle>(null);

  useEffect(() => {
    return () => previewAudioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth/login');
      return;
    }
    if (getStoredUser()?.role === 'admin') {
      router.replace('/admin');
      return;
    }
    api.get<StudioUser>('/auth/me').then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const { instagram, ...rest } = router.query;
    if (instagram === 'connected') {
      setNotice(t('studio.instagramConnected'));
      setInstagramModalOpen(true);
      setTimeout(() => setNotice(''), 3000);
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    } else if (instagram === 'error') {
      setNotice(t('studio.instagramError'));
      setTimeout(() => setNotice(''), 4000);
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router.isReady]);

  function applyFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    applyFile(f);
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t || tags.includes(t)) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function togglePreview(trackId: string, url: string) {
    if (previewingId === trackId) {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    if (!previewAudioRef.current) previewAudioRef.current = new Audio();
    const audioEl = previewAudioRef.current;
    audioEl.src = url;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
    setPreviewingId(trackId);
  }

  function selectMusic(trackId: string) {
    setMusicTrackId((prev) => (prev === trackId ? null : trackId));
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!file) {
      setError(t('studio.choosePhotoOrVideo'));
      return;
    }

    setLoading(true);
    try {
      const extension = file.name.split('.').pop() || 'bin';
      const { uploadUrl, fileUrl } = await api.post('/files/upload-url', {
        folder: 'posts',
        mimeType: file.type,
        extension,
      });

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(t('studio.uploadFailed'));

      const selectedTrack = MUSIC_LIBRARY.find((m) => m.id === musicTrackId);
      const type = file.type.startsWith('image/') ? 'photo' : 'video';
      const post = await api.post('/posts', {
        type,
        mediaUrl: fileUrl,
        caption: caption.trim() || undefined,
        tags,
        musicName: selectedTrack?.name,
        musicUrl: selectedTrack?.url,
      });

      setPostId(post.id);
      setStep('capsule');

      try {
        const capsules = await api.get<Capsule[]>('/capsules/mine');
        setMyCapsules(capsules);
        setCapsuleMode(capsules.length > 0 ? 'existing' : 'new');
      } catch {
        setMyCapsules([]);
        setCapsuleMode('new');
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachCapsule(e: React.FormEvent) {
    e.preventDefault();
    setCapsuleError('');

    if (!selectedCapsuleId) {
      setCapsuleError(t('studio.chooseCapsule'));
      return;
    }

    setCapsuleLoading(true);
    try {
      await api.post(`/capsules/${selectedCapsuleId}/attach`, { postId });
      setStep('done');
    } catch (err) {
      setCapsuleError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setCapsuleLoading(false);
    }
  }

  async function handleAddCapsule(e: React.FormEvent) {
    e.preventDefault();
    setCapsuleError('');

    const name = productFormRef.current?.getGroupName();
    if (!name) return;
    const products = productFormRef.current?.getProducts();
    if (!products) return;

    setCapsuleLoading(true);
    try {
      await api.post('/capsules/groups', { name, postId, products });
      setStep('done');
    } catch (err) {
      setCapsuleError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setCapsuleLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Studio — skoleomLive</title>
      </Head>

      <div className="flex h-screen cosmic-bg overflow-hidden">
        <AppSidebar />

        <main className="relative flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-hide">
          {/* Halos d'ambiance — meme esprit que la sidebar, pour que le studio ne soit plus
              un simple aplat noir autour d'une colonne etroite. */}
          <div className="cosmic-orb w-64 h-64 bg-[#ffc94d]/[0.07] -top-16 -right-20 animate-float" style={{ animationDelay: '0s' }} />
          <div className="cosmic-orb w-48 h-48 bg-[#ff5470]/[0.06] top-1/3 -left-24 animate-float" style={{ animationDelay: '-4s' }} />
          <div className="cosmic-orb w-56 h-56 bg-[#ffc94d]/[0.04] bottom-0 right-0 animate-float" style={{ animationDelay: '-2s' }} />

          <div className="relative flex items-center gap-3 px-4 py-4">
            <Link
              href="/"
              className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={16} className="text-white/70" />
            </Link>
            <span className="text-white font-bold text-sm">{t('studio.title')}</span>

            {me && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-white/40 text-xs font-medium">{me.displayName || me.username}</span>
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#ffc94d] to-[#ff5470] flex items-center justify-center text-xs font-bold text-black shrink-0">
                  {me.avatarUrl ? (
                    <img src={me.avatarUrl} alt={me.username} className="w-full h-full object-cover" />
                  ) : (
                    (me.displayName || me.username)[0]?.toUpperCase()
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-1 flex flex-col items-center px-4 py-8 pb-20 md:pb-8">
          <div className="w-full max-w-sm">
            {notice && (
              <p className="mb-4 text-center text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2.5">
                {notice}
              </p>
            )}

            {step === 'form' && (
              <div className="animate-fade-in">
                <div className="text-center mb-7">
                  <h1 className="display-text text-gradient text-3xl mb-1.5">{t('studio.title')}</h1>
                  <p className="text-white/40 text-[13px]">{t('studio.heroSubtitle')}</p>
                </div>

                {/* ── Section : Direct ─────────────────────────────── */}
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2.5">
                  <Radio size={11} /> {t('studio.sectionLive')}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-7">
                  <button
                    type="button"
                    onClick={() => router.push('/studio/live')}
                    className="group relative aspect-square rounded-3xl p-[1.5px] bg-gradient-to-br from-red-400/50 via-red-500/25 to-transparent hover:from-red-400/80 hover:via-red-500/40 transition-all"
                  >
                    <div className="relative w-full h-full rounded-3xl bg-[#341839] overflow-hidden flex flex-col items-center justify-center gap-3">
                      <div className="absolute w-20 h-20 bg-red-500/25 rounded-full blur-2xl group-hover:bg-red-500/40 transition-all" />
                      <span className="relative w-12 h-12 rounded-full bg-red-500/15 border border-red-400/30 flex items-center justify-center">
                        <Radio size={20} className="text-red-400" />
                      </span>
                      <span className="relative text-white text-sm font-bold">{t('studio.startLive')}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/studio/live?mode=auction')}
                    className="group relative aspect-square rounded-3xl p-[1.5px] bg-gradient-to-br from-[#ffc94d]/50 via-[#ff5470]/25 to-transparent hover:from-[#ffc94d]/80 hover:via-[#ff5470]/40 transition-all"
                  >
                    <div className="relative w-full h-full rounded-3xl bg-[#341839] overflow-hidden flex flex-col items-center justify-center gap-3">
                      <div className="absolute w-20 h-20 bg-[#ffc94d]/20 rounded-full blur-2xl group-hover:bg-[#ffc94d]/35 transition-all" />
                      <span className="relative w-12 h-12 rounded-full bg-[#ffc94d]/15 border border-[#ffc94d]/30 flex items-center justify-center">
                        <Gavel size={20} className="text-[#ffc94d]" />
                      </span>
                      <span className="relative text-white text-sm font-bold">{t('studio.startAuction')}</span>
                    </div>
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-7">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                  <span className="text-[11px] text-white/25 uppercase tracking-wider">{t('common.or')}</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                </div>

                {/* ── Section : Nouveau post ───────────────────────── */}
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2.5">
                  <Sparkles size={11} /> {t('studio.sectionPost')}
                </p>

                <form onSubmit={handlePublish} className="space-y-4">
                <input
                  ref={importInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={onFileChange}
                  className="hidden"
                />

                {preview ? (
                  <div className="relative w-full aspect-square rounded-3xl border border-white/15 overflow-hidden shadow-glow-lime-sm">
                    {file?.type.startsWith('video/') ? (
                      <video src={preview} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={preview} className="w-full h-full object-cover" alt="" />
                    )}
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreview(''); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Bordure degradee cyan/lime (meme esprit "cosmique" que le filet de la
                        sidebar) au lieu d'un simple border-white/10 qui se voyait a peine. */}
                    <div className="group relative aspect-square rounded-3xl p-[1.5px] bg-gradient-to-br from-[#ff5470]/50 via-[#ffc94d]/45 to-[#ff5470]/15 hover:from-[#ff5470]/80 hover:via-[#ffc94d]/65 hover:to-[#ff5470]/30 transition-all">
                      <button
                        type="button"
                        onClick={() => setCameraOpen(true)}
                        className="relative w-full h-full rounded-3xl bg-[#341839] overflow-hidden hover:bg-[#111113] flex flex-col items-center justify-center gap-3 transition-all"
                      >
                        <div className="absolute w-16 h-16 bg-[#ff5470]/15 rounded-full blur-2xl group-hover:bg-[#ff5470]/25 transition-all" />
                        <span className="relative w-11 h-11 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
                          <Camera size={20} className="text-white/80" />
                        </span>
                        <span className="relative text-white/80 text-sm font-semibold">{t('studio.createPost')}</span>
                      </button>
                    </div>
                    <div className="group relative aspect-square rounded-3xl p-[1.5px] bg-gradient-to-br from-[#ff5470]/50 via-[#ffc94d]/45 to-[#ff5470]/15 hover:from-[#ff5470]/80 hover:via-[#ffc94d]/65 hover:to-[#ff5470]/30 transition-all">
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="relative w-full h-full rounded-3xl bg-[#341839] overflow-hidden hover:bg-[#111113] flex flex-col items-center justify-center gap-3 transition-all"
                      >
                        <div className="absolute w-16 h-16 bg-[#ffc94d]/15 rounded-full blur-2xl group-hover:bg-[#ffc94d]/25 transition-all" />
                        <span className="relative w-11 h-11 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
                          <ImageIcon size={20} className="text-white/80" />
                        </span>
                        <span className="relative text-white/80 text-sm font-semibold">{t('studio.import')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {!preview && (
                  <button
                    type="button"
                    onClick={() => setInstagramModalOpen(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-white/35 hover:text-white/60 text-[12px] font-medium transition-colors"
                  >
                    <Import size={13} className="shrink-0" />
                    {t('studio.importSocial')}
                  </button>
                )}

                {/* Legende/tags/musique/publication — masques tant qu'aucun media n'est
                    choisi, sinon l'ecran est deja trop long avant meme d'avoir commence. */}
                {preview && (
                <>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t('studio.captionPlaceholder')}
                  rows={3}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all resize-none"
                />

                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder={t('studio.addTagPlaceholder')}
                      className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffc94d]/50 focus:border-[#ffc94d]/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={!tagInput.trim()}
                      className="w-11 h-11 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center text-[#ffc94d] disabled:opacity-30 transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[#ffc94d]/10 border border-[#ffc94d]/25 text-[#ffc94d] text-xs font-medium"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="w-4 h-4 rounded-full hover:bg-[#ffc94d]/20 flex items-center justify-center transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-2 flex items-center gap-1.5">
                    <Music size={12} /> {t('studio.music')}
                  </p>
                  <div className="space-y-1.5">
                    {MUSIC_LIBRARY.map((track) => {
                      const selected = musicTrackId === track.id;
                      const playing = previewingId === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                            selected ? 'border-[#ffc94d]/50 bg-[#ffc94d]/10' : 'border-white/[0.08] bg-white/[0.02]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => togglePreview(track.id, track.url)}
                            className="w-8 h-8 shrink-0 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center text-white transition-all"
                          >
                            {playing ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => selectMusic(track.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className={`text-[13px] font-medium truncate ${selected ? 'text-[#ffc94d]' : 'text-white'}`}>
                              {track.name}
                            </p>
                            <p className="text-[11px] text-white/35 truncate">{track.artist}</p>
                          </button>
                          {selected && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffc94d] shrink-0">
                              {t('studio.musicSelected')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : t('studio.publish')}
                </button>
                </>
                )}
                </form>
              </div>
            )}

            {step === 'capsule' && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-white font-bold text-lg">{t('studio.postPublished')}</h2>
                  <p className="text-white/45 text-sm">{t('studio.addOptionalCapsule')}</p>
                </div>

                {myCapsules === null ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-white/30" />
                  </div>
                ) : (
                  <>
                    <div className="relative flex bg-white/[0.05] rounded-full p-1">
                      <div
                        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out"
                        style={{ transform: capsuleMode === 'new' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
                      />
                      {(['existing', 'new'] as CapsuleMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setCapsuleMode(m); setCapsuleError(''); }}
                          className={`relative z-10 flex-1 py-2 rounded-full text-sm font-medium transition-colors duration-300 ${
                            capsuleMode === m ? 'text-black' : 'text-white/45 hover:text-white/70'
                          }`}
                        >
                          {m === 'existing' ? `${t('studio.existingCapsule')}${myCapsules.length ? ` (${myCapsules.length})` : ''}` : t('studio.newCapsuleTab')}
                        </button>
                      ))}
                    </div>

                    {capsuleMode === 'existing' ? (
                      myCapsules.length === 0 ? (
                        <p key="existing-empty" className="text-center text-white/30 text-sm py-6 animate-fade-in">
                          {t('studio.noCapsuleYet')}
                        </p>
                      ) : (
                      <form key="existing" onSubmit={handleAttachCapsule} className="space-y-4 animate-fade-in">
                        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
                          {myCapsules.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedCapsuleId(c.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                selectedCapsuleId === c.id
                                  ? 'border-[#ffc94d] bg-[#ffc94d]/10'
                                  : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="w-11 h-11 rounded-lg bg-white/[0.05] overflow-hidden shrink-0 flex items-center justify-center">
                                {c.imageUrl ? (
                                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package size={16} className="text-white/25" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{c.name}{c.group?.name ? ` · ${c.group.name}` : ''}</p>
                                <p className="text-xs text-white/40">{c.price.toFixed(2)} {c.currency} · {t('studio.inStock', { count: c.stock })}</p>
                              </div>
                            </button>
                          ))}
                        </div>

                        {capsuleError && (
                          <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                            {capsuleError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={capsuleLoading}
                          className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
                        >
                          {capsuleLoading ? <Loader2 size={16} className="animate-spin" /> : t('studio.useThisCapsule')}
                        </button>
                      </form>
                      )
                    ) : (
                      <form key="new" onSubmit={handleAddCapsule} className="space-y-4 animate-fade-in">
                        <CapsuleProductForm ref={productFormRef} />

                        {capsuleError && (
                          <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                            {capsuleError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={capsuleLoading}
                          className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
                        >
                          {capsuleLoading ? <Loader2 size={16} className="animate-spin" /> : t('studio.addCapsule')}
                        </button>
                      </form>
                    )}
                  </>
                )}

                <button
                  onClick={() => router.push('/profile/me?tab=posts')}
                  className="w-full py-3 text-white/45 text-sm hover:text-white/70 transition-colors"
                >
                  {t('studio.skipStep')}
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center space-y-4">
                <h2 className="text-white font-bold text-lg">{t('studio.capsuleAdded')}</h2>
                <button
                  onClick={() => router.push('/profile/me?tab=posts')}
                  className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98]"
                >
                  {t('studio.viewPost')}
                </button>
              </div>
            )}
          </div>
          </div>
        </main>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={applyFile}
      />

      <InstagramImportModal
        open={instagramModalOpen}
        onClose={() => setInstagramModalOpen(false)}
        onImported={(count) => {
          setNotice(t('studio.importedCount', { count, plural: count > 1 ? 's' : '' }));
          setTimeout(() => setNotice(''), 3000);
        }}
      />
    </>
  );
}
