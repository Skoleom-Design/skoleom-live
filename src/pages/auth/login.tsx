import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError, getToken, setSession, getStoredUser } from '../../shared/api/http';
import { useLanguage } from '../../client/i18n/LanguageContext';

type Tab = 'login' | 'register';

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_ACCOUNTS = [
  { plan: 'free', label: 'Free', email: 'demo-free@skoleom.live', username: 'demo_free', color: 'white' },
  { plan: 'premium', label: 'Premium', email: 'demo-premium@skoleom.live', username: 'demo_premium', color: '#00ffff' },
  { plan: 'ultra', label: 'Ultra', email: 'demo-ultra@skoleom.live', username: 'demo_ultra', color: '#f59e0b' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (getToken()) {
      router.replace(getStoredUser()?.role === 'admin' ? '/admin' : '/');
      return;
    }
    if (router.query.suspended === '1') {
      setError(t('auth.suspended'));
    }
  }, [router.query.suspended]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (tab === 'register' && !username.trim()) {
      setError(t('auth.enterUsername'));
      return;
    }

    setLoading(true);
    try {
      const { token, user } =
        tab === 'login'
          ? await api.post('/auth/login', { email, password })
          : await api.post('/auth/register', { email, username: username.trim(), password });

      setSession(token, user);
      router.push(user.role === 'admin' ? '/admin' : tab === 'login' ? '/' : '/studio');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setLoading(false);
    }
  }

  async function loginAsDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setError('');
    setDemoLoading(account.plan);
    try {
      let session;
      try {
        session = await api.post('/auth/login', { email: account.email, password: DEMO_PASSWORD });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          session = await api.post('/auth/register', {
            email: account.email,
            username: account.username,
            password: DEMO_PASSWORD,
            plan: account.plan,
          });
        } else {
          throw err;
        }
      }
      setSession(session.token, session.user);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <>
      <Head>
        <title>
          {tab === 'login' ? t('auth.login') : t('auth.register')} — skoleomLive
        </title>
      </Head>

      <div className="cosmic-bg min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={16} className="text-white/70" />
          </Link>
          <div className="flex items-center gap-2">
            <img src="/skoleom-mark.png" alt="" className="w-6 h-6 object-contain" />
            <span className="text-white font-bold text-sm">skoleomLive</span>
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#a8ff35]/10 border border-[#a8ff35]/20 flex items-center justify-center mx-auto mb-4">
                <img src="/skoleom-mark.png" alt="" className="w-8 h-8 object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {tab === 'login' ? t('auth.welcome') : t('auth.createAccount')}
              </h1>
              <p className="text-white/45 text-sm">
                {tab === 'login' ? t('auth.pleaseLogin') : t('auth.pleaseRegister')}
              </p>
            </div>

            {/* Tab toggle */}
            <div className="flex bg-white/[0.05] rounded-full p-1 mb-7">
              {(['login', 'register'] as Tab[]).map((tabOption) => (
                <button
                  key={tabOption}
                  onClick={() => { setTab(tabOption); setError(''); }}
                  className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${
                    tab === tabOption
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {tabOption === 'login' ? t('auth.login') : t('auth.register')}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'register' && (
                <div>
                  <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                    {t('auth.username')}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('auth.usernamePlaceholder')}
                    autoComplete="username"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {tab === 'login' ? t('auth.emailOrUsername') : t('auth.email')}
                </label>
                <input
                  type={tab === 'login' ? 'text' : 'email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tab === 'login' ? t('auth.emailOrUsernamePlaceholder') : t('auth.emailPlaceholder')}
                  autoComplete="email"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2 mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  tab === 'login' ? t('auth.loginButton') : t('auth.registerButton')
                )}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[11px] text-white/30 uppercase tracking-wider">{t('auth.demoAccounts')}</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.plan}
                    type="button"
                    onClick={() => loginAsDemo(account)}
                    disabled={demoLoading !== null}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-all disabled:opacity-50"
                    style={{ borderColor: `${account.color}33` }}
                  >
                    {demoLoading === account.plan ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: account.color === 'white' ? 'rgba(255,255,255,0.7)' : account.color,
                          background: `${account.color === 'white' ? 'rgba(255,255,255,0.08)' : account.color}1a`,
                        }}
                      >
                        {account.label}
                      </span>
                    )}
                    <span className="text-[10px] text-white/30">{t('auth.try')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-white/25 mt-6">
              {t('auth.termsPrefix')}{' '}
              <span className="text-white/40 underline cursor-pointer">{t('auth.termsLink')}</span>
              {' '}{t('auth.termsSuffix')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
