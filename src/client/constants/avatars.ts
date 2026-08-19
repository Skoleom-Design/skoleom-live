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

// Deuxieme categorie — look "verre/glossy" (effet 3D), genere une fois via la librairie
// open-source DiceBear (style "glass", licence CC0) puis sauvegarde en fichiers statiques dans
// /public/avatars-3d — aucune dependance a DiceBear au runtime, ni appel reseau.
export const PRESET_AVATARS_3D = [
  '/avatars-3d/nova.svg',
  '/avatars-3d/orbit.svg',
  '/avatars-3d/quasar.svg',
  '/avatars-3d/zenith.svg',
  '/avatars-3d/flux.svg',
  '/avatars-3d/lumen.svg',
  '/avatars-3d/vertex.svg',
  '/avatars-3d/cipher.svg',
  '/avatars-3d/drift.svg',
  '/avatars-3d/prism.svg',
  '/avatars-3d/vapor.svg',
  '/avatars-3d/ember.svg',
  '/avatars-3d/glide.svg',
  '/avatars-3d/pulse.svg',
  '/avatars-3d/shard.svg',
  '/avatars-3d/wisp.svg',
  '/avatars-3d/echo.svg',
  '/avatars-3d/tide.svg',
];
