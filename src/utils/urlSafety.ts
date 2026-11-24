/**
 * Validates external redirect or link URLs so untrusted schemes (`javascript:`, `data:`, etc.)
 * are never passed to `<a href>`, `<img src>`, or `window.location.assign`.
 */
export function toSafeHttpUrl(
  rawUrl: string | null | undefined,
  options: { allowRelative?: boolean } = {},
): string | null {
  const trimmed = rawUrl?.trim() ?? ''
  if (!trimmed) return null

  if (options.allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:') {
      return parsed.toString()
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}
