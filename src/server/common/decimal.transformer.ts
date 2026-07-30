import { ValueTransformer } from 'typeorm';

// Le driver mysql2 renvoie les colonnes `decimal` sous forme de string (pour eviter les pertes
// de precision flottante), contrairement a better-sqlite3 qui renvoie des number — sans ce
// transformer, chaque `.toFixed()` cote client plante des qu'on bascule de SQLite a MySQL.
export const DecimalColumnTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};
