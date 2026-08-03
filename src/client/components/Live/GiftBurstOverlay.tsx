import type { GiftDef } from '../../constants/gifts';

export interface ActiveGiftBurst {
  id: string;
  gift: GiftDef;
  username: string;
}

interface Props {
  items: ActiveGiftBurst[];
}

// Rendu pur (pas d'etat interne) — chaque page live gere sa propre file d'items (ajout au
// recu du cadeau, retrait apres un timeout) et passe juste la liste courante a afficher.
export function GiftBurstOverlay({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-16 z-30 flex flex-col items-center gap-1 pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="animate-gift-burst flex flex-col items-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span
              className="absolute inset-0 rounded-full blur-xl opacity-60"
              style={{ background: item.gift.color }}
            />
            <img
              src={item.gift.image3d}
              alt={item.gift.name}
              className="relative w-14 h-14 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
            />
          </div>
          <p className="text-white text-[12px] font-bold drop-shadow-md mt-0.5 text-center px-4">
            <span style={{ color: item.gift.color }}>{item.username}</span> a envoyé {item.gift.name}
          </p>
        </div>
      ))}
    </div>
  );
}
