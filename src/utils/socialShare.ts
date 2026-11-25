import type { AppLanguage } from '../i18n/translations'

/**
 * Resolves the canonical public origin for social share URLs, preferring `VITE_SITE_URL`
 * when configured for production deployments and falling back cleanly to `window.location.origin`.
 */
export function resolvePublicSiteOrigin(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim()
  if (configured) {
    try {
      const parsed = new URL(configured)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin
      }
    } catch {
      // Ignore malformed env overrides and fall back to runtime origin.
    }
  }
  return typeof window !== 'undefined' ? window.location.origin : 'https://christmas-commit-city.pages.dev'
}

/** Builds the canonical `/tree/:username` share URL. */
export function buildTreeShareUrl(username: string): string {
  const clean = username.trim().replace(/^@+/, '')
  return `${resolvePublicSiteOrigin()}/tree/${encodeURIComponent(clean)}`
}

/** Builds localized social copy featuring the developer handle and commit count. */
export function buildTreeShareText(
  username: string,
  commits: number,
  language: AppLanguage,
): string {
  const clean = username.trim().replace(/^@+/, '')
  const formattedCommits = Math.max(0, Math.floor(commits)).toLocaleString(
    language === 'en' ? 'en-US' : 'pt-BR',
  )
  if (language === 'en') {
    return `🎄 Check out @${clean}'s tree in Christmas Commit City! ${formattedCommits} commits lighting up the 3D North Pole ✨`
  }
  return `🎄 Veja a árvore de @${clean} no Christmas Commit City! ${formattedCommits} commits iluminando o Polo Norte 3D ✨`
}

export interface SocialShareLinks {
  shareUrl: string
  shareText: string
  xHref: string
  instagramHref: string
  instagramCopyText: string
  linkedinHref: string
}

/** Builds X (Twitter), Instagram, and LinkedIn share intent links cleanly. */
export function buildTreeSocialShareLinks(
  username: string,
  commits: number,
  language: AppLanguage,
): SocialShareLinks {
  const shareUrl = buildTreeShareUrl(username)
  const shareText = buildTreeShareText(username, commits, language)
  return {
    shareUrl,
    shareText,
    xHref: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    instagramHref: 'https://www.instagram.com/',
    instagramCopyText: `${shareText}\n${shareUrl}`,
    linkedinHref: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
  }
}
