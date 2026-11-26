import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { UI_TRANSLATIONS, type AppLanguage } from '../i18n/translations'
import type { SupportCurrency } from '../types/companion'
import { LocaleContext } from './localeContextStore'

const LANG_STORAGE_KEY = 'ccc_language_v1'
const CURRENCY_STORAGE_KEY = 'ccc_currency_v1'
const FORCED_EN_STORAGE_KEY = 'ccc_forced_en_v1'

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

function readForcedEnglishFlag(): boolean {
  try {
    return window.localStorage.getItem(FORCED_EN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportCurrency>(() =>
    detectInitialCurrency(detectInitialLanguage()),
  )
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const initialLang = detectInitialLanguage()
    const initialCurrency = detectInitialCurrency(initialLang)
    return initialCurrency === 'USD' ? 'en' : initialLang
  })
  const [forcedEnglish, setForcedEnglish] = useState<boolean>(() => readForcedEnglishFlag())

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    setLanguageState(nextLang)
    const isEn = nextLang === 'en'
    setForcedEnglish(isEn)
    const suggestedCurrency: SupportCurrency = nextLang === 'pt-BR' ? 'BRL' : 'USD'
    setCurrencyState(suggestedCurrency)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLang)
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, suggestedCurrency)
      if (isEn) {
        window.localStorage.setItem(FORCED_EN_STORAGE_KEY, 'true')
      } else {
        window.localStorage.removeItem(FORCED_EN_STORAGE_KEY)
      }
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const setCurrency = useCallback(
    (nextCurrency: SupportCurrency) => {
      setCurrencyState(nextCurrency)
      const nextLanguage: AppLanguage =
        nextCurrency === 'USD' ? 'en' : forcedEnglish ? 'en' : 'pt-BR'
      setLanguageState(nextLanguage)
      try {
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency)
        window.localStorage.setItem(LANG_STORAGE_KEY, nextLanguage)
      } catch {
        // Ignore storage failures.
      }
    },
    [forcedEnglish],
  )

  const effectiveLanguage: AppLanguage = currency === 'USD' ? 'en' : language

  const value = useMemo(
    () => ({
      language: effectiveLanguage,
      currency,
      t: UI_TRANSLATIONS[effectiveLanguage],
      setLanguage,
      setCurrency,
    }),
    [effectiveLanguage, currency, setLanguage, setCurrency],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
