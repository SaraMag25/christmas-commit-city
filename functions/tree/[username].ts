interface PublicTreeMetaRow {
  github_username: string
  display_name: string | null
  total_commits: number | null
}

interface CloudflareEnv {
  ASSETS: {
    fetch: (input: RequestInfo | URL) => Promise<Response>
  }
  VITE_SUPABASE_URL?: string
  SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  SUPABASE_ANON_KEY?: string
  VITE_SITE_URL?: string
}

interface PagesFunctionContext {
  request: Request
  params: Record<string, string | string[]>
  env: CloudflareEnv
}

declare class HTMLRewriter {
  on(
    selector: string,
    handlers: {
      element?: (element: {
        setAttribute: (name: string, value: string) => void
        setInnerContent: (content: string) => void
      }) => void
    },
  ): HTMLRewriter
  transform(response: Response): Response
}

const GITHUB_LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

function resolveOrigin(requestUrl: URL, env: CloudflareEnv): string {
  const configured = env.VITE_SITE_URL?.trim()
  if (configured) {
    try {
      const parsed = new URL(configured)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin
      }
    } catch {
      // Fall back to incoming request origin if VITE_SITE_URL is invalid.
    }
  }
  return requestUrl.origin
}

async function fetchPublicTreeRow(
  username: string,
  env: CloudflareEnv,
): Promise<PublicTreeMetaRow | null> {
  const supabaseUrl = (env.VITE_SUPABASE_URL ?? env.SUPABASE_URL)?.trim().replace(/\/+$/, '')
  const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY)?.trim()
  if (!supabaseUrl || !anonKey) return null

  const endpoint = `${supabaseUrl}/rest/v1/public_trees?github_username_lower=eq.${encodeURIComponent(
    username.toLowerCase(),
  )}&select=github_username,display_name,total_commits&limit=1`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 1400)

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const rows = (await res.json()) as PublicTreeMetaRow[]
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rows[0] ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function onRequestGet(context: PagesFunctionContext): Promise<Response> {
  const url = new URL(context.request.url)
  const assetResponse = await context.env.ASSETS.fetch(new URL('/index.html', url.origin))
  if (!assetResponse.ok) {
    return assetResponse
  }

  const rawParam = Array.isArray(context.params.username)
    ? context.params.username[0]
    : context.params.username
  let decodedUsername: string
  try {
    decodedUsername = decodeURIComponent(rawParam ?? '').trim().replace(/^@+/, '')
  } catch {
    return assetResponse
  }

  if (!decodedUsername || !GITHUB_LOGIN_RE.test(decodedUsername)) {
    return assetResponse
  }

  const treeRow = await fetchPublicTreeRow(decodedUsername, context.env)
  if (!treeRow) {
    return assetResponse
  }

  const handle = treeRow.github_username.trim() || decodedUsername
  const commitsCount = Math.max(0, Math.floor(Number(treeRow.total_commits) || 0))
  const commitsFormatted = commitsCount.toLocaleString('en-US')
  const origin = resolveOrigin(url, context.env)
  const shareUrl = `${origin}/tree/${encodeURIComponent(handle)}`
  const coverImageUrl = `${origin}/og-cover.png`

  const title = `🎄 @${handle} (${commitsFormatted} commits) — Christmas Commit City`
  const description = `🎄 Veja a árvore de @${handle} no Christmas Commit City! ${commitsFormatted} commits iluminando o Polo Norte 3D ✨`

  const rewritten = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(title)
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', shareUrl)
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', description)
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', title)
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', description)
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute('content', shareUrl)
      },
    })
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', coverImageUrl)
      },
    })
    .on('meta[property="og:image:secure_url"]', {
      element(el) {
        el.setAttribute('content', coverImageUrl)
      },
    })
    .on('meta[name="twitter:title"]', {
      element(el) {
        el.setAttribute('content', title)
      },
    })
    .on('meta[name="twitter:description"]', {
      element(el) {
        el.setAttribute('content', description)
      },
    })
    .on('meta[name="twitter:url"]', {
      element(el) {
        el.setAttribute('content', shareUrl)
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el) {
        el.setAttribute('content', coverImageUrl)
      },
    })
    .transform(assetResponse)

  const headers = new Headers(rewritten.headers)
  headers.set('Cache-Control', 'public, max-age=120, s-maxage=300')
  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers,
  })
}
