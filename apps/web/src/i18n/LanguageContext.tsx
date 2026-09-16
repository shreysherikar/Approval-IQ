import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  isMarathi: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'approvaliq_lang_pref';

export function LanguageProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'mr' ? 'mr' : 'en';
  });

  const setLanguage = (lang: Language): void => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const toggleLanguage = (): void => {
    setLanguage(language === 'en' ? 'mr' : 'en');
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] as Record<string, string>;
    const defaultDict = translations.en as Record<string, string>;
    return langDict[key] || defaultDict[key] || fallback || key;
  };

  const isMarathi = language === 'mr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, isMarathi }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
