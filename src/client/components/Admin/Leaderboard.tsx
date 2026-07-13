import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface RankedUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

function Avatar({ user }: { user: RankedUser }) {
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center font-bold text-black">
      {user.username[0]?.toUpperCase()}
    </div>
  );
}

export function Leaderboard<T extends RankedUser>({
  icon: Icon,
  subtitle,
  items,
  loading,
  emptyLabel,
  renderValue,
}: {
  icon: LucideIcon;
  subtitle: string;
  items: T[];
  loading: boolean;
  emptyLabel: string;
  renderValue: (item: T) => React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-brand" />
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm mt-3">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500 text-sm mt-3">{emptyLabel}</div>
      ) : (
        <div className="space-y-2 mt-3">
          {items.map((item, i) => (
            <Link
              key={item.id}
              href={`/profile/${item.id}`}
              className="flex items-center gap-4 p-3.5 bg-surface-card rounded-2xl border border-white/5 hover:border-brand/30 transition-colors"
            >
              <span className="text-sm font-bold text-gray-500 w-6 text-center">{i + 1}</span>
              <Avatar user={item} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {item.displayName || item.username}
                </p>
                <p className="text-xs text-gray-400">@{item.username}</p>
              </div>
              {renderValue(item)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
