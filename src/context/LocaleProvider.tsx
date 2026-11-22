import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { UI_TRANSLATIONS, type AppLanguage } from '../i18n/translations'
import type { SupportCurrency } from '../types/companion'
import { LocaleContext } from './localeContextStore'

const LANG_STORAGE_KEY = 'ccc_language_v1'
const CURRENCY_STORAGE_KEY = 'ccc_currency_v1'

function detectInitialLanguage(): AppLanguage {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'pt-BR' || saved === 'en') return saved
  } catch {
    // Ignore storage access failures.
  }

  const navLang = (
    typeof navigator !== 'undefined' ? navigator.language || 'pt-BR' : 'pt-BR'
  ).toLowerCase()
  return navLang.startsWith('pt') ? 'pt-BR' : 'en'
}

function detectInitialCurrency(defaultLang: AppLanguage): SupportCurrency {
  try {
    const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY)
    if (saved === 'BRL' || saved === 'USD') return saved
  } catch {
    // Ignore storage access failures.
  }
  return defaultLang === 'pt-BR' ? 'BRL' : 'USD'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => detectInitialLanguage())
  const [currency, setCurrencyState] = useState<SupportCurrency>(() =>
    detectInitialCurrency(detectInitialLanguage()),
  )

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    setLanguageState(nextLang)
    const suggestedCurrency: SupportCurrency = nextLang === 'pt-BR' ? 'BRL' : 'USD'
    setCurrencyState(suggestedCurrency)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLang)
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, suggestedCurrency)
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const setCurrency = useCallback((nextCurrency: SupportCurrency) => {
    setCurrencyState(nextCurrency)
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency)
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const value = useMemo(
    () => ({
      language,
      currency,
      t: UI_TRANSLATIONS[language],
      setLanguage,
      setCurrency,
    }),
    [language, currency, setLanguage, setCurrency],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
