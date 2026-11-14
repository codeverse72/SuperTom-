import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AppLanguage, SUPPORTED_LANGUAGES, LanguageOption, TRANSLATIONS } from '../i18n/translations';
import { apiClient } from '../services/apiClient';

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRtl: boolean;
  currentLanguageOption: LanguageOption;
  supportedLanguages: LanguageOption[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLanguage(): AppLanguage {
  // 1. URL Query Parameter (?lang=fa / ?lang=ru / ?lang=fr / ?lang=en)
  try {
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang')?.toLowerCase();
    if (queryLang && ['en', 'fa', 'ru', 'fr'].includes(queryLang)) {
      return queryLang as AppLanguage;
    }
  } catch {
    // Ignore URL parse errors
  }

  // 2. Local Storage
  try {
    const saved = localStorage.getItem('supertom_language')?.toLowerCase();
    if (saved && ['en', 'fa', 'ru', 'fr'].includes(saved)) {
      return saved as AppLanguage;
    }
  } catch {
    // LocalStorage blocked
  }

  // 3. Telegram WebApp user language_code
  try {
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase();
    if (tgLang) {
      if (tgLang.startsWith('fa') || tgLang.startsWith('per')) return 'fa';
      if (tgLang.startsWith('ru')) return 'ru';
      if (tgLang.startsWith('fr')) return 'fr';
      if (tgLang.startsWith('en')) return 'en';
    }
  } catch {
    // Ignore Telegram access errors
  }

  // 4. Browser navigator language
  try {
    const navLang = navigator.language?.toLowerCase() || '';
    if (navLang.startsWith('fa')) return 'fa';
    if (navLang.startsWith('ru')) return 'ru';
    if (navLang.startsWith('fr')) return 'fr';
  } catch {
    // Ignore
  }

  return 'en';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(detectInitialLanguage);

  // Sync document direction and HTML lang attribute
  useEffect(() => {
    try {
      const isRtl = language === 'fa';
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      localStorage.setItem('supertom_language', language);
    } catch {
      // Ignore
    }
  }, [language]);

  const setLanguage = useCallback((newLang: AppLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem('supertom_language', newLang);
      const isRtl = newLang === 'fa';
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;

      // Haptic feedback
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }

      // Non-blocking sync to backend profile
      apiClient.post('/user/language', { languageCode: newLang }).catch(() => {});
    } catch {
      // Ignore
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const langDict = TRANSLATIONS[language] || TRANSLATIONS.en;
      let text = langDict[key] || TRANSLATIONS.en[key] || key;

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }

      return text;
    },
    [language]
  );

  const isRtl = useMemo(() => language === 'fa', [language]);

  const currentLanguageOption = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0],
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isRtl,
      currentLanguageOption,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, t, isRtl, currentLanguageOption]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
