// image3d : rendu 3D (Fluent Emoji, Microsoft, licence MIT) servi via jsDelivr — meme
// principe que GIFTS dans gifts.ts, pour eviter le rendu plat/desature des emoji Unicode
// qui varie trop selon la police/OS de chaque utilisateur.
// https://github.com/microsoft/fluentui-emoji
const FLUENT_3D = (folder: string, file: string) =>
  `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/${folder}/3D/${file}_3d.png`;

export interface InterestTopic {
  slug: string;
  emoji: string;
  image3d: string;
}

// Slugs utilisés à la fois comme clé i18n (onboarding.interests.<slug>) et comme valeur
// stockée sur User.interests — doivent matcher les tags posés sur les posts pour que la
// personnalisation du feed fonctionne (voir posts.service.ts:getFeed).
export const INTEREST_TOPICS: InterestTopic[] = [
  { slug: 'mode', emoji: '👗', image3d: FLUENT_3D('Dress', 'dress') },
  { slug: 'beaute', emoji: '💄', image3d: FLUENT_3D('Lipstick', 'lipstick') },
  { slug: 'sneakers', emoji: '👟', image3d: FLUENT_3D('Running shoe', 'running_shoe') },
  { slug: 'deco', emoji: '🪴', image3d: FLUENT_3D('Potted plant', 'potted_plant') },
  { slug: 'bijoux', emoji: '💎', image3d: FLUENT_3D('Gem stone', 'gem_stone') },
  { slug: 'sport', emoji: '🏀', image3d: FLUENT_3D('Basketball', 'basketball') },
  { slug: 'musique', emoji: '🎧', image3d: FLUENT_3D('Headphone', 'headphone') },
  { slug: 'lifestyle', emoji: '✨', image3d: FLUENT_3D('Sparkles', 'sparkles') },
  { slug: 'gaming', emoji: '🎮', image3d: FLUENT_3D('Video game', 'video_game') },
  { slug: 'tech', emoji: '📱', image3d: FLUENT_3D('Mobile phone', 'mobile_phone') },
  { slug: 'art', emoji: '🎨', image3d: FLUENT_3D('Artist palette', 'artist_palette') },
  { slug: 'cuisine', emoji: '🍕', image3d: FLUENT_3D('Pizza', 'pizza') },
];

export const MIN_INTERESTS_REQUIRED = 3;
