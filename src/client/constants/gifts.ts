// Catalogue des cadeaux virtuels — les ids et montants (coins = centimes d'euro, ex: 10 coins =
// 0,10€) doivent rester alignés avec GIFT_CATALOG dans src/server/api/lives/lives.service.ts.
//
// image3d : rendu 3D (Fluent Emoji, Microsoft, licence MIT) servi via jsDelivr — remplace les
// emoji Unicode plats, dont le rendu depend trop de la police/OS de chaque utilisateur.
// https://github.com/microsoft/fluentui-emoji
const FLUENT_3D = (folder: string, file: string) =>
  `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/${folder}/3D/${file}_3d.png`;

export interface GiftDef {
  id: string;
  emoji: string;
  image3d: string;
  name: string;
  coins: number;
  eur: string;
  color: string;
}

export const GIFTS: GiftDef[] = [
  { id: 'rose',     emoji: '🌹', image3d: FLUENT_3D('Rose', 'rose'),                         name: 'Rose',     coins: 10,   eur: '0,10€', color: '#ec4899' },
  { id: 'etoile',   emoji: '⭐', image3d: FLUENT_3D('Star', 'star'),                          name: 'Étoile',   coins: 50,   eur: '0,50€', color: '#f59e0b' },
  { id: 'feu',      emoji: '🔥', image3d: FLUENT_3D('Fire', 'fire'),                          name: 'Feu',      coins: 150,  eur: '1,50€', color: '#f97316' },
  { id: 'coeur',    emoji: '💝', image3d: FLUENT_3D('Heart with ribbon', 'heart_with_ribbon'), name: 'Cœur',     coins: 200,  eur: '2€',    color: '#ec4899' },
  { id: 'rocket',   emoji: '🚀', image3d: FLUENT_3D('Rocket', 'rocket'),                      name: 'Fusée',    coins: 500,  eur: '5€',    color: '#8b5cf6' },
  { id: 'diamant',  emoji: '💎', image3d: FLUENT_3D('Gem stone', 'gem_stone'),                 name: 'Diamant',  coins: 1000, eur: '10€',   color: '#06b6d4' },
  { id: 'trophee',  emoji: '🏆', image3d: FLUENT_3D('Trophy', 'trophy'),                       name: 'Trophée',  coins: 1500, eur: '15€',   color: '#f59e0b' },
  { id: 'couronne', emoji: '👑', image3d: FLUENT_3D('Crown', 'crown'),                         name: 'Couronne', coins: 2000, eur: '20€',   color: '#f59e0b' },
];

export function giftById(id: string): GiftDef | undefined {
  return GIFTS.find((g) => g.id === id);
}

export const COIN_PACKS = [
  { coins: 100, eur: '1€' },
  { coins: 500, eur: '4,50€' },
  { coins: 1200, eur: '10€' },
  { coins: 3000, eur: '24€' },
];
