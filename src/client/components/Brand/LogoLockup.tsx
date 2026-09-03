// Wordmark officiel (fichier fourni par le produit — logo blanc sur fond transparent, pense pour
// le fond sombre "cosmic" de la DA). Le ratio (1748x900) est fixe, seule `width` pilote la taille.
export function LogoLockup({ width = 320, className = '' }: { width?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="skoleomLive"
      width={width}
      height={(width * 900) / 1748}
      className={className}
      style={{ width, height: (width * 900) / 1748, objectFit: 'contain' }}
    />
  );
}
