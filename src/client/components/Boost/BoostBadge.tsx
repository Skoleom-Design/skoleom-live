import { Zap } from 'lucide-react';

export function BoostBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/20 border border-brand/40 text-brand text-xs font-semibold backdrop-blur-sm">
      <Zap size={11} className="fill-brand" />
      Sponsorisé
    </span>
  );
}
