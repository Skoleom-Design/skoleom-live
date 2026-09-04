import { Check } from 'lucide-react';

interface AvatarGridProps {
  options: string[];
  value: string;
  onChange: (url: string) => void;
}

// Grille de choix facon "gamerpic" — partagee entre GoogleProfileSetup (nouveau compte Google)
// et AvatarPickerGate (nouveau compte email/mot de passe classique).
export function AvatarGrid({ options, value, onChange }: AvatarGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {options.map((url) => {
        const active = value === url;
        return (
          <button
            key={url}
            type="button"
            onClick={() => onChange(url)}
            className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all active:scale-95 ${
              active ? 'border-[#ffc94d] shadow-glow-lime-sm' : 'border-white/10 hover:border-white/30'
            }`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            {active && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Check size={18} className="text-white drop-shadow" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
