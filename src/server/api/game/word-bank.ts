export interface WordPair {
  civilian: string;
  undercover: string;
}

// Paires "proches mais differentes" — le civil et l'undercover doivent pouvoir donner des indices
// qui se recoupent (les deux mots partagent une categorie/un usage), sinon l'undercover est
// demasque des le premier tour.
export const WORD_PAIRS: WordPair[] = [
  { civilian: 'Chat', undercover: 'Chien' },
  { civilian: 'Café', undercover: 'Thé' },
  { civilian: 'Pizza', undercover: 'Burger' },
  { civilian: 'Plage', undercover: 'Piscine' },
  { civilian: 'Voiture', undercover: 'Moto' },
  { civilian: 'Guitare', undercover: 'Piano' },
  { civilian: 'Hiver', undercover: 'Automne' },
  { civilian: 'Lion', undercover: 'Tigre' },
  { civilian: 'Instagram', undercover: 'TikTok' },
  { civilian: 'Netflix', undercover: 'YouTube' },
  { civilian: 'Pain', undercover: 'Croissant' },
  { civilian: 'Vélo', undercover: 'Trottinette' },
  { civilian: 'Montagne', undercover: 'Colline' },
  { civilian: 'Soleil', undercover: 'Lune' },
  { civilian: 'Professeur', undercover: 'Étudiant' },
  { civilian: 'Pomme', undercover: 'Poire' },
  { civilian: 'Train', undercover: 'Avion' },
  { civilian: 'WhatsApp', undercover: 'Messenger' },
  { civilian: 'Basket', undercover: 'Football' },
  { civilian: 'Riz', undercover: 'Pâtes' },
  { civilian: 'Ordinateur', undercover: 'Tablette' },
  { civilian: 'Chaussures', undercover: 'Sandales' },
  { civilian: 'Roi', undercover: 'Président' },
  { civilian: 'Vampire', undercover: 'Zombie' },
  { civilian: 'École', undercover: 'Université' },
  { civilian: 'Chocolat', undercover: 'Bonbon' },
  { civilian: 'Karaté', undercover: 'Judo' },
  { civilian: 'Robe', undercover: 'Jupe' },
  { civilian: 'Cinéma', undercover: 'Théâtre' },
  { civilian: 'Docteur', undercover: 'Infirmier' },
  { civilian: 'Lac', undercover: 'Rivière' },
  { civilian: 'Iphone', undercover: 'Samsung' },
  { civilian: 'Beurre', undercover: 'Confiture' },
  { civilian: 'Sac', undercover: 'Valise' },
  { civilian: 'Piscine', undercover: 'Baignoire' },
  { civilian: 'Chanteur', undercover: 'Acteur' },
  { civilian: 'Bière', undercover: 'Vin' },
  { civilian: 'Requin', undercover: 'Dauphin' },
  { civilian: 'Forêt', undercover: 'Jungle' },
  { civilian: 'Facebook', undercover: 'Snapchat' },
];

// Evite de retomber sur la meme paire deux manches de suite dans une meme room (voir
// GameService.startGame) — pas besoin d'un historique complet, juste ne pas repeter l'immediat
// precedent.
export function pickRandomPair(exclude?: WordPair): WordPair {
  const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  if (exclude && pair.civilian === exclude.civilian && WORD_PAIRS.length > 1) {
    return pickRandomPair(exclude);
  }
  return pair;
}
