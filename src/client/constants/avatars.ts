// Photos de profil preset — theme cosmique de l'app, fichiers SVG statiques dans /public/avatars.
// Pas de service externe : autonome, pas de dependance reseau au choix de l'avatar.
export const PRESET_AVATARS = [
  '/avatars/rocket.svg',
  '/avatars/planet.svg',
  '/avatars/moon.svg',
  '/avatars/comet.svg',
  '/avatars/galaxy.svg',
  '/avatars/star.svg',
  '/avatars/ufo.svg',
  '/avatars/nova.svg',
  '/avatars/astronaut.svg',
  '/avatars/blackhole.svg',
  '/avatars/satellite.svg',
  '/avatars/meteor.svg',
  '/avatars/aurora.svg',
  '/avatars/constellation.svg',
  '/avatars/eclipse.svg',
  '/avatars/nebula.svg',
  '/avatars/asteroid.svg',
  '/avatars/robot.svg',
];

const SEEDS = [
  'nova', 'orbit', 'quasar', 'zenith', 'flux', 'lumen', 'vertex', 'cipher',
  'drift', 'prism', 'vapor', 'ember', 'glide', 'pulse', 'shard', 'wisp',
];

// Categories generees une fois via la librairie open-source DiceBear (licence CC0), tintees aux
// couleurs de la marque, puis sauvegardees en fichiers statiques — aucune dependance a DiceBear
// ni appel reseau au runtime (voir _gen-avatar-categories.js dans l'historique git si besoin de
// regenerer/ajuster un set).
export const PRESET_AVATARS_ROBOTS = SEEDS.map((s) => `/avatars-robots/${s}.svg`);
export const PRESET_AVATARS_PORTRAITS = SEEDS.map((s) => `/avatars-portraits/${s}.svg`);
export const PRESET_AVATARS_ORBITS = SEEDS.map((s) => `/avatars-orbits/${s}.svg`);
export const PRESET_AVATARS_PERSONAS = SEEDS.map((s) => `/avatars-personas/${s}.svg`);
