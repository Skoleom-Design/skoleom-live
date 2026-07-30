// Catalogue des cadeaux virtuels — les ids et montants (coins = centimes d'euro, ex: 10 coins =
// 0,10€) doivent rester alignés avec GIFT_CATALOG dans src/server/api/lives/lives.service.ts.
export interface GiftDef {
  id: string;
  emoji: string;
  name: string;
  coins: number;
  eur: string;
  color: string;
}

export const GIFTS: GiftDef[] = [
  { id: 'rose',     emoji: '🌹', name: 'Rose',     coins: 10,   eur: '0,10€', color: '#ec4899' },
  { id: 'etoile',   emoji: '⭐', name: 'Étoile',   coins: 50,   eur: '0,50€', color: '#f59e0b' },
  { id: 'feu',      emoji: '🔥', name: 'Feu',      coins: 150,  eur: '1,50€', color: '#f97316' },
  { id: 'coeur',    emoji: '💝', name: 'Cœur',     coins: 200,  eur: '2€',    color: '#ec4899' },
  { id: 'rocket',   emoji: '🚀', name: 'Fusée',    coins: 500,  eur: '5€',    color: '#8b5cf6' },
  { id: 'diamant',  emoji: '💎', name: 'Diamant',  coins: 1000, eur: '10€',   color: '#06b6d4' },
  { id: 'trophee',  emoji: '🏆', name: 'Trophée',  coins: 1500, eur: '15€',   color: '#f59e0b' },
  { id: 'couronne', emoji: '👑', name: 'Couronne', coins: 2000, eur: '20€',   color: '#f59e0b' },
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
