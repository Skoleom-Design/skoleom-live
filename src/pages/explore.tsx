import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Search, Loader2 } from 'lucide-react';
import { AppSidebar } from '../client/components/Layout/Sidebar';
import type { Post } from '../shared/types/api';
import { api } from '../shared/api/http';

export default function ExplorePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get<{ posts: Post[] }>('/posts/feed?page=1&limit=50')
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.caption?.toLowerCase().includes(q) ||
        p.creator?.username.toLowerCase().includes(q) ||
        p.creator?.displayName?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [posts, query]);

  return (
    <>
      <Head>
        <title>Rechercher — skoleomLive</title>
      </Head>

      <div className="flex h-screen bg-black overflow-hidden">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-[900px] mx-auto px-4 py-8">
            <div className="relative mb-6">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un créateur, un tag, une légende..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-full pl-11 pr-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30 transition-all"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-white/30" size={24} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-16">Aucun résultat.</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
                {filtered.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="relative aspect-square bg-white/[0.04] overflow-hidden group"
                  >
                    {post.thumbnailUrl || post.type === 'photo' ? (
                      <img src={post.thumbnailUrl || post.mediaUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
