import { createContext, useContext } from 'react'
import { UI_TRANSLATIONS, type AppLanguage } from '../i18n/translations'
import type { SupportCurrency } from '../types/companion'

export interface LocaleContextValue {
  language: AppLanguage
  currency: SupportCurrency
  t: (typeof UI_TRANSLATIONS)[AppLanguage]
  setLanguage: (lang: AppLanguage) => void
  setCurrency: (currency: SupportCurrency) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>.')
  }
  return ctx
}
