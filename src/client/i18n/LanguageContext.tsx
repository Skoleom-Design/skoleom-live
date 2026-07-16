import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { fr } from './fr';
import { en } from './en';

export type Language = 'fr' | 'en';

const DICTIONARIES: Record<Language, any> = { fr, en };
const STORAGE_KEY = 'skoleom:lang';

function getByPath(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: typeof fr;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'fr',
  setLanguage: () => {},
  t: (key) => key,
  dict: fr,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') setLanguageState(stored);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const template = getByPath(DICTIONARIES[language], key) ?? getByPath(DICTIONARIES.fr, key) ?? key;
    return interpolate(template, vars);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dict: DICTIONARIES[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
