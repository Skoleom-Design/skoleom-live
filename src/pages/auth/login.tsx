import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';

type Tab = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (localStorage.getItem('skoleom:authToken')) {
      router.replace('/studio');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (tab === 'register' && !name.trim()) {
      setError('Veuillez entrer votre nom.');
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));

    localStorage.setItem('skoleom:authToken', `sk_${Date.now()}`);
    localStorage.setItem(
      'skoleom:user',
      JSON.stringify({ name: name.trim() || email.split('@')[0], email })
    );

    router.push('/studio');
  }

  return (
    <>
      <Head>
        <title>
          {tab === 'login' ? 'Connexion' : 'Inscription'} — skoleomLive
        </title>
      </Head>

      <div className="min-h-screen bg-[#050505] flex flex-col">
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
              <div className="w-14 h-14 rounded-2xl bg-[#0066FF]/10 border border-[#0066FF]/20 flex items-center justify-center mx-auto mb-4">
                <img src="/skoleom-mark.png" alt="" className="w-8 h-8 object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {tab === 'login' ? 'Bienvenue' : 'Créer un compte'}
              </h1>
              <p className="text-white/45 text-sm">
                Veuillez vous{' '}
                {tab === 'login' ? 'connecter' : 'inscrire'} pour continuer
              </p>
            </div>

            {/* Tab toggle */}
            <div className="flex bg-white/[0.05] rounded-full p-1 mb-7">
              {(['login', 'register'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${
                    tab === t
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {t === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'register' && (
                <div>
                  <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                    Nom d'affichage
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    autoComplete="name"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#0066FF]/50 focus:border-[#0066FF]/30 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#0066FF]/50 focus:border-[#0066FF]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#0066FF]/50 focus:border-[#0066FF]/30 transition-all"
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
                className="w-full py-3.5 rounded-full bg-[#0066FF] text-white font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  tab === 'login' ? 'Se connecter' : 'Créer mon compte'
                )}
              </button>
            </form>

            {/* Footer note */}
            <p className="text-center text-xs text-white/25 mt-6">
              En continuant, vous acceptez les{' '}
              <span className="text-white/40 underline cursor-pointer">conditions d'utilisation</span>
              {' '}de skoleomLive.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
