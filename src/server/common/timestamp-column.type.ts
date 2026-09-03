import { ColumnType } from 'typeorm';

// 'timestamptz' n'existe que sous Postgres — better-sqlite3 (utilise quand DB_HOST est absent,
// voir app.module.ts) ne le supporte pas et refuse de demarrer. On bascule sur 'datetime' dans
// ce cas pour que le mode SQLite "zero config" fonctionne reellement.
export const TIMESTAMP_COLUMN_TYPE: ColumnType = process.env.DB_HOST ? 'timestamptz' : 'datetime';
