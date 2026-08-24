// Composition de marque validee : le sac (meme icone que le bouton capsule) avec le swash
// historique imprime a l'interieur, un point rec (halo) en haut a droite, et le nom a droite du
// sac, cale sur sa ligne de base. Le viewBox reste fixe (400x220) — la taille se pilote
// uniquement via `width`, tout le reste (texte inclus) suit puisque c'est un SVG.
export function LogoLockup({ width = 320, className = '' }: { width?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 400 220"
      width={width}
      height={(width * 220) / 400}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="skoleomLive"
      className={className}
    >
      <defs>
        <filter id="lockup-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform="translate(30,15) scale(3.75)">
        <path d="M23 26 C23 18, 37 18, 37 26" fill="none" stroke="#faee21" strokeWidth="4.4" />
        <path d="M16.5 26 H43.5 L40.5 46.5 a4.6 4.6 0 0 1 -4.6 4 H24.6 a4.6 4.6 0 0 1 -4.6 -4 Z" fill="#faee21" />
      </g>
      <image href="/skoleom-swash.png" x="101" y="118" width="83" height="83" style={{ filter: 'brightness(0) invert(1)' }} />
      <circle cx="204" cy="62" r="19" fill="#ff3b30" stroke="#0d1206" strokeWidth="4" filter="url(#lockup-glow)" />
      <text x="212" y="200" textAnchor="start" fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="30" fontStyle="italic" fill="#eef2e4">
        skoleom<tspan fill="#a8ff35" fontWeight="800">Live</tspan>
      </text>
    </svg>
  );
}
