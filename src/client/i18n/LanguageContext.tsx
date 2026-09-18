import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { fr } from './fr';
import { en } from './en';
import { es } from './es';
import { ar } from './ar';

export type Language = 'fr' | 'en' | 'es' | 'ar';

const DICTIONARIES: Record<Language, any> = { fr, en, es, ar };
const RTL_LANGUAGES: Language[] = ['ar'];
const STORAGE_KEY = 'skoleom:lang';
const VALID_LANGUAGES: Language[] = ['fr', 'en', 'es', 'ar'];

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
    if (VALID_LANGUAGES.includes(stored as Language)) setLanguageState(stored as Language);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  }, [language]);

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
