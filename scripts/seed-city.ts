import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/
const BATCH_SIZE = 5
const BATCH_CONCURRENCY = 5
const BATCH_DELAY_MS = 100
const SEARCH_DELAY_MS = 2150
const SUPABASE_PAGE_SIZE = 1000
let globalRateLimitUntilMs = 0

/**
 * Curated list of ~207 well-known public GitHub developer accounts across:
 * - Creator & North Pole plaza anchor
 * - Open-source pioneers, language authors & tooling creators
 * - Framework, WebGL, Vite, React, Vue, Svelte, Tailwind, Supabase & AI maintainers
 * - Prominent Brazilian tech community developers & educators
 */
const SEED_GITHUB_USERNAMES: readonly string[] = [
  // Creator & Brazilian community leaders
  'SaraMag25',
  'diego3g',
  'maykbrito',
  'filipedeschamps',
  'akitaonrails',
  'loiane',
  'omariosouto',
  'willianjusten',
  'fdaciuk',
  'rodrigobranas',
  'rmanguinho',
  'jakeliny',
  'juunegreiros',
  'peas',
  'guilhermesilveira',
  'otaviolemos',
  'elemarjr',
  'andrebaltieri',
  'zanfranceschi',
  'vedovelli',
  'glaucia86',
  'pachicodes',
  'levxyca',
  'biancarosa',
  'lucasmontano',
  'henriquebastos',
  'pokemaobr',
  'michellebrito',
  'rodrigorgtic',
  'eliasgcf',
  'emanuelgdev',
  'flaviohenriquealmeida',
  'marcobrunodev',
  'gabsferreira',
  'camila-f',
  'julianaconde',
  'waldemarnt',
  'cezaraugusto',
  'brenoha',
  'danielhe4rt',
  'cherryramatisdev',
  'sseraphini',
  'oieduardorabelo',
  'ErickWendel',
  'jonatasbaldin',
  'rafaelaballerini',
  'guscsales',
  'matheusfrndes',
  'codigofontetv',
  'gabrielfroes',

  // Open-source & programming language pioneers
  'torvalds',
  'gvanrossum',
  'matz',
  'robpike',
  'rsc',
  'bradfitz',
  'rakyll',
  'ahejlsberg',
  'ry',
  'kelseyhightower',
  'mitchellh',
  'fatih',
  'antirez',
  'sindresorhus',
  'tj',
  'isaacs',
  'b0rk',
  'jgm',
  'geohot',
  'fabpot',
  'taylorotwell',
  'dhh',
  'mojombo',
  'defunkt',
  'pjhyett',
  'schacon',
  'jeresig',
  'brendaneich',
  'douglascrockford',

  // React, Next.js, TypeScript & frontend ecosystem
  'gaearon',
  'sebmarkbage',
  'acdlite',
  'bvaughn',
  'sophiebits',
  'kentcdodds',
  'wesbos',
  'tannerlinsley',
  'TkDodo',
  'colinhacks',
  'mattpocock',
  'orta',
  'dsherret',
  'RyanCavanaugh',
  'DanielRosenwasser',
  'rauchg',
  'leerob',
  'timneutkens',
  'styfle',
  'shuding',
  'pacocoursey',
  'evilrabbit',
  'shadcn',
  'jaredpalmer',
  'developit',
  'pmndrs',
  'drcmda',
  'jamiebuilds',
  'markerikson',
  'sw-yx',
  'bholmesdev',
  't3dotgg',
  'juliusmarminge',

  // Vite, Vue, Svelte, Nuxt, Astro & Tailwind
  'yyx990803',
  'antfu',
  'patak-dev',
  'posva',
  'pi0',
  'Atinux',
  'danielroe',
  'rich-harris',
  'Conduitry',
  'DominicTobias',
  'bluwy',
  'sxzz',
  'sheremet-va',
  'sapphi-red',
  'privatenumber',
  'adamwathan',
  'bradlc',
  'RobinMalfait',
  'FredKSchott',
  'natemoo-re',
  'satya164',
  'brentvatne',
  'leeoniya',
  'jorgebucaran',

  // Three.js, WebGL, graphics & creative coding
  'mrdoob',
  'WestLangley',
  'Mugen87',
  'alteredq',
  'gkjohnson',
  'spite',
  'greggman',
  'bhouston',
  'lo-th',

  // Rust, Deno, systems & build tooling
  'dtolnay',
  'BurntSushi',
  'nikomatsakis',
  'steveklabnik',
  'alexcrichton',
  'cramertj',
  'fasterthanlime',
  'charliermarsh',
  'bartlomieju',
  'lucacasonato',
  'littledivy',
  'kentonv',
  'evanw',
  'sokra',
  'mhevery',

  // Python, Backend, Supabase & AI builders
  'tiangolo',
  'samuelcolvin',
  'davidhewitt',
  'mitsuhiko',
  'kennethreitz',
  'simonw',
  'willmcgugan',
  'karpathy',
  'rasbt',
  'ggerganov',
  'hwchase17',
  'kiwicopple',
  'awalias',
  'steve-chavez',
  'SaltWizard',
  'addyosmani',
  'paulirish',
  'substack',
  'mafintosh',
  'feross',
  'maxogden',
  'mxstbr',
  'ljharb',
  'ljos',
  'jaffathecake',
  'LeaVerou',
  'una',
  'argyleink',
  'bramus',
  'smashingmag',
  'sdras',
  'cassidoo',
  'sarah_edo',
  'mpjme',
  'bradtraversy',
  'academind',
  'fireship-io',
  'codedamn',
  'theprimeagen',
  'jwasham',
  'kamranahmedse',
  'donnemartin',
  'trekhleb',
  'vinta',
  'public-apis',
  'kdn251',
]

interface SearchBucketConfig {
  label: string
  endpoint: 'users' | 'repositories'
  query: string
  sort: 'followers' | 'stars'
  maxPages: number
}

const DISCOVERY_SEARCH_BUCKETS: readonly SearchBucketConfig[] = [
  // Brazilian & Portuguese-speaking developers (high-density regional community)
  {
    label: 'Brazil top followers',
    endpoint: 'users',
    query: 'type:user location:Brazil followers:>=40',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Brazil active devs',
    endpoint: 'users',
    query: 'type:user location:Brazil followers:10..39',
    sort: 'followers',
    maxPages: 8,
  },
  {
    label: 'Brazil growing devs',
    endpoint: 'users',
    query: 'type:user location:Brazil followers:3..9 repos:>=3',
    sort: 'followers',
    maxPages: 6,
  },
  {
    label: 'Brasil location devs',
    endpoint: 'users',
    query: 'type:user location:Brasil followers:>=5',
    sort: 'followers',
    maxPages: 6,
  },
  {
    label: 'São Paulo devs',
    endpoint: 'users',
    query: 'type:user location:"São Paulo" followers:>=3 repos:>=3',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Fortaleza devs',
    endpoint: 'users',
    query: 'type:user location:Fortaleza followers:>=1',
    sort: 'followers',
    maxPages: 4,
  },
  {
    label: 'Rio & BH devs',
    endpoint: 'users',
    query: 'type:user location:"Rio de Janeiro" followers:>=3',
    sort: 'followers',
    maxPages: 4,
  },
  {
    label: 'Portugal devs',
    endpoint: 'users',
    query: 'type:user location:Portugal followers:>=5 repos:>=3',
    sort: 'followers',
    maxPages: 5,
  },

  // Global follower bands (split ranges so each query stays under GitHub's 1000-item cap)
  {
    label: 'Global followers >=3000',
    endpoint: 'users',
    query: 'type:user followers:>=3000',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 1200..2999',
    endpoint: 'users',
    query: 'type:user followers:1200..2999',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 600..1199',
    endpoint: 'users',
    query: 'type:user followers:600..1199',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 300..599',
    endpoint: 'users',
    query: 'type:user followers:300..599',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 150..299',
    endpoint: 'users',
    query: 'type:user followers:150..299',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 80..149',
    endpoint: 'users',
    query: 'type:user followers:80..149',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 40..79',
    endpoint: 'users',
    query: 'type:user followers:40..79 repos:>=5',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 25..39',
    endpoint: 'users',
    query: 'type:user followers:25..39 repos:>=5',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 15..24',
    endpoint: 'users',
    query: 'type:user followers:15..24 repos:>=5',
    sort: 'followers',
    maxPages: 10,
  },
  {
    label: 'Global followers 10..14',
    endpoint: 'users',
    query: 'type:user followers:10..14 repos:>=5',
    sort: 'followers',
    maxPages: 10,
  },

  // Popular repository creators across core & emerging languages
  {
    label: 'Popular TypeScript repo creators',
    endpoint: 'repositories',
    query: 'language:typescript stars:>=1500',
    sort: 'stars',
    maxPages: 6,
  },
  {
    label: 'Popular Python repo creators',
    endpoint: 'repositories',
    query: 'language:python stars:>=2000',
    sort: 'stars',
    maxPages: 6,
  },
  {
    label: 'Popular Rust repo creators',
    endpoint: 'repositories',
    query: 'language:rust stars:>=1000',
    sort: 'stars',
    maxPages: 5,
  },
  {
    label: 'Popular Go repo creators',
    endpoint: 'repositories',
    query: 'language:go stars:>=1500',
    sort: 'stars',
    maxPages: 5,
  },
  {
    label: 'Popular JavaScript repo creators',
    endpoint: 'repositories',
    query: 'language:javascript stars:>=2500',
    sort: 'stars',
    maxPages: 6,
  },
  {
    label: 'Popular Java repo creators',
    endpoint: 'repositories',
    query: 'language:java stars:>=2000',
    sort: 'stars',
    maxPages: 5,
  },
  {
    label: 'Popular C++ repo creators',
    endpoint: 'repositories',
    query: 'language:cpp stars:>=2000',
    sort: 'stars',
    maxPages: 5,
  },
  {
    label: 'Popular Swift/Kotlin/Dart repo creators',
    endpoint: 'repositories',
    query: 'language:dart stars:>=400',
    sort: 'stars',
    maxPages: 4,
  },
  {
    label: 'Popular Vue/Svelte repo creators',
    endpoint: 'repositories',
    query: 'language:vue stars:>=800',
    sort: 'stars',
    maxPages: 4,
  },

  // Language-focused active individual users
  {
    label: 'TypeScript developers',
    endpoint: 'users',
    query: 'type:user language:typescript followers:40..119',
    sort: 'followers',
    maxPages: 6,
  },
  {
    label: 'Python developers',
    endpoint: 'users',
    query: 'type:user language:python followers:40..179',
    sort: 'followers',
    maxPages: 6,
  },
  {
    label: 'Rust developers',
    endpoint: 'users',
    query: 'type:user language:rust followers:25..79',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Go developers',
    endpoint: 'users',
    query: 'type:user language:go followers:25..99',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Java developers',
    endpoint: 'users',
    query: 'type:user language:java followers:30..119',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'C++ developers',
    endpoint: 'users',
    query: 'type:user language:cpp followers:30..119',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Kotlin developers',
    endpoint: 'users',
    query: 'type:user language:kotlin followers:>=20',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Swift developers',
    endpoint: 'users',
    query: 'type:user language:swift followers:>=20',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'C# developers',
    endpoint: 'users',
    query: 'type:user language:csharp followers:>=25',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Dart & Flutter developers',
    endpoint: 'users',
    query: 'type:user language:dart followers:>=15',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'Ruby & PHP & Elixir developers',
    endpoint: 'users',
    query: 'type:user language:ruby followers:>=30',
    sort: 'followers',
    maxPages: 5,
  },
  {
    label: 'PHP developers',
    endpoint: 'users',
    query: 'type:user language:php followers:>=30',
    sort: 'followers',
    maxPages: 5,
  },
]

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function loadLocalEnv(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const rootDir = resolve(scriptDir, '..')

  for (const filename of ['.env', '.env.local']) {
    const filePath = resolve(rootDir, filename)
    if (!existsSync(filePath)) continue
    const content = readFileSync(filePath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx <= 0) continue
      const key = line.slice(0, eqIdx).trim()
      let val = line.slice(eqIdx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

interface CliOptions {
  limit: number
  refresh: boolean
  dryRun: boolean
  skipSearch: boolean
  year: number
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)
  const fallbackYear =
    Number(process.env.CONTRIBUTION_YEAR || process.env.VITE_CONTRIBUTION_YEAR) || 2026

  let limit = 3000
  let refresh = false
  let dryRun = false
  let skipSearch = false
  let year = fallbackYear

  for (const arg of args) {
    if (arg === '--refresh') refresh = true
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--skip-search') skipSearch = true
    else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length))
      if (Number.isInteger(n) && n > 0) limit = n
    } else if (arg.startsWith('--year=')) {
      const y = Number(arg.slice('--year='.length))
      if (Number.isInteger(y) && y >= 2020 && y <= new Date().getUTCFullYear() + 1) year = y
    }
  }

  return { limit, refresh, dryRun, skipSearch, year }
}

async function fetchGitHubWithRateLimit(
  url: string,
  init: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const gateWait = globalRateLimitUntilMs - Date.now()
    if (gateWait > 0) {
      await sleep(gateWait)
    }

    const res = await fetch(url, init)
    const remainingHeader = res.headers.get('x-ratelimit-remaining')
    const resetHeader = res.headers.get('x-ratelimit-reset')
    const retryAfterHeader = res.headers.get('retry-after')

    if ((res.status === 403 || res.status === 429) && attempt < maxRetries) {
      let waitMs = 15000
      if (retryAfterHeader) {
        const sec = Number(retryAfterHeader)
        if (Number.isFinite(sec) && sec > 0) waitMs = sec * 1000 + 1000
      } else if (resetHeader) {
        const resetSec = Number(resetHeader)
        if (Number.isFinite(resetSec) && resetSec > 0) {
          waitMs = Math.max(2000, Math.min(68000, resetSec * 1000 - Date.now() + 1500))
        }
      }
      globalRateLimitUntilMs = Math.max(globalRateLimitUntilMs, Date.now() + waitMs)
      console.log(`  ⏳ GitHub rate limit reached (HTTP ${res.status}); waiting ${Math.ceil(waitMs / 1000)}s...`)
      await sleep(waitMs)
      continue
    }

    if (res.ok && remainingHeader === '0' && resetHeader) {
      const resetSec = Number(resetHeader)
      if (Number.isFinite(resetSec) && resetSec > 0) {
        const waitMs = Math.max(1000, Math.min(65000, resetSec * 1000 - Date.now() + 1200))
        globalRateLimitUntilMs = Math.max(globalRateLimitUntilMs, Date.now() + waitMs)
        console.log(`  ⏳ Rate limit bucket exhausted; pausing ${Math.ceil(waitMs / 1000)}s until reset...`)
        await sleep(waitMs)
      }
    }

    return res
  }

  throw new Error(`Exceeded retry budget for ${url}`)
}

async function discoverGitHubAccountsViaSearch(opts: {
  targetCount: number
  githubToken: string
  seenLower: Set<string>
  orderedLogins: string[]
}): Promise<void> {
  const { targetCount, githubToken, seenLower, orderedLogins } = opts
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Christmas-Commit-City-Seeder',
  }

  let searchRequests = 0
  for (const bucket of DISCOVERY_SEARCH_BUCKETS) {
    if (orderedLogins.length >= targetCount) break
    let bucketAdded = 0

    for (let page = 1; page <= bucket.maxPages; page += 1) {
      if (orderedLogins.length >= targetCount) break
      if (searchRequests > 0) {
        await sleep(SEARCH_DELAY_MS)
      }
      searchRequests += 1

      const url = new URL(`https://api.github.com/search/${bucket.endpoint}`)
      url.searchParams.set('q', bucket.query)
      url.searchParams.set('sort', bucket.sort)
      url.searchParams.set('order', 'desc')
      url.searchParams.set('per_page', '100')
      url.searchParams.set('page', String(page))

      let res: Response
      try {
        res = await fetchGitHubWithRateLimit(url.toString(), { method: 'GET', headers })
      } catch (err) {
        console.warn(`  ⚠️ Search bucket "${bucket.label}" page ${page} failed:`, err)
        break
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        console.warn(
          `  ⚠️ Search bucket "${bucket.label}" HTTP ${res.status}: ${txt.slice(0, 140)}`,
        )
        break
      }

      const payload = (await res.json()) as {
        items?: Array<{
          login?: string
          type?: string
          owner?: { login?: string; type?: string }
        }>
      }

      const items = payload.items ?? []
      if (items.length === 0) break

      for (const item of items) {
        if (orderedLogins.length >= targetCount) break
        const candidate =
          bucket.endpoint === 'users'
            ? item.type === 'User'
              ? item.login
              : undefined
            : item.owner?.type === 'User'
              ? item.owner.login
              : undefined

        if (!candidate) continue
        const clean = candidate.trim()
        const lower = clean.toLowerCase()
        if (!GITHUB_USERNAME_REGEX.test(clean) || seenLower.has(lower)) continue

        seenLower.add(lower)
        orderedLogins.push(clean)
        bucketAdded += 1
      }

      if (items.length < 100) break
    }

    console.log(
      `  🔎 [${bucket.label}] +${bucketAdded} unique devs (total pool: ${orderedLogins.length}/${targetCount})`,
    )
  }
}

interface GitHubGraphQLUserResult {
  login: string
  name: string | null
  avatarUrl: string
  contributionsCollection: {
    contributionCalendar: {
      totalContributions: number
      weeks: Array<{
        contributionDays: Array<{
          date: string
          contributionCount: number
          color: string
        }>
      }>
    }
  }
}

async function fetchBatchFromGitHub(
  logins: readonly string[],
  year: number,
  githubToken: string,
): Promise<Map<string, GitHubGraphQLUserResult>> {
  const fromIso = `${year}-01-01T00:00:00.000Z`
  const toIso = `${year}-12-31T23:59:59.999Z`

  const variableDefs = ['$from: DateTime!', '$to: DateTime!']
  const variables: Record<string, string> = { from: fromIso, to: toIso }
  const fieldQueries: string[] = []

  logins.forEach((login, idx) => {
    const varName = `l${idx}`
    variableDefs.push(`$${varName}: String!`)
    variables[varName] = login
    fieldQueries.push(`
      u${idx}: user(login: $${varName}) {
        login
        name
        avatarUrl
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    `)
  })

  const query = `query SeedCityBatch(${variableDefs.join(', ')}) {\n${fieldQueries.join('\n')}\n}`

  const res = await fetchGitHubWithRateLimit('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Christmas-Commit-City-Seeder',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(25000),
  })

  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    data?: Record<string, GitHubGraphQLUserResult | null>
    errors?: Array<{ message?: string; type?: string }>
  }

  const found = new Map<string, GitHubGraphQLUserResult>()
  const data = json.data ?? {}

  logins.forEach((requested, idx) => {
    const item = data[`u${idx}`]
    if (item && typeof item.login === 'string') {
      found.set(requested.toLowerCase(), item)
    }
  })

  return found
}

async function fetchBatchFromGitHubResilient(
  logins: readonly string[],
  year: number,
  githubToken: string,
): Promise<{ results: Map<string, GitHubGraphQLUserResult>; failedLogins: string[] }> {
  if (logins.length === 0) {
    return { results: new Map(), failedLogins: [] }
  }

  try {
    const results = await fetchBatchFromGitHub(logins, year, githubToken)
    return { results, failedLogins: [] }
  } catch (err) {
    // Heavy active profiles in a multi-user GraphQL call often trigger GitHub 502 timeouts; bisect automatically
    if (logins.length > 1) {
      const mid = Math.ceil(logins.length / 2)
      const [left, right] = await Promise.all([
        fetchBatchFromGitHubResilient(logins.slice(0, mid), year, githubToken),
        fetchBatchFromGitHubResilient(logins.slice(mid), year, githubToken),
      ])
      const merged = new Map(left.results)
      for (const [k, v] of right.results) {
        merged.set(k, v)
      }
      return { results: merged, failedLogins: [...left.failedLogins, ...right.failedLogins] }
    }

    for (let retry = 1; retry <= 2; retry += 1) {
      await sleep(1200 * retry)
      try {
        const results = await fetchBatchFromGitHub(logins, year, githubToken)
        return { results, failedLogins: [] }
      } catch {
        // Continue to next retry or record single login failure
      }
    }

    console.warn(`  ⚠️ Skipping @${logins[0]} after GraphQL retries:`, err instanceof Error ? err.message : err)
    return { results: new Map(), failedLogins: [logins[0]] }
  }
}

async function runSeed(): Promise<void> {
  loadLocalEnv()
  const opts = parseCliArgs()

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
  const githubToken =
    process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_READONLY_TOKEN?.trim() || ''

  if (!githubToken) {
    console.error(
      '❌ Missing GITHUB_TOKEN (or GITHUB_READONLY_TOKEN).\n' +
        '   Export it in your shell or add GITHUB_TOKEN=ghp_... before running this script.',
    )
    process.exit(1)
  }

  if (!opts.dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error(
      '❌ Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
        '   Service role access is required to insert unclaimed city trees into Supabase.',
    )
    process.exit(1)
  }

  const adminClient =
    !opts.dryRun && supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  // Paginate cleanly past PostgREST 1000-row limit so resuming at 1000..5000+ is 100% idempotent
  const existingByLower = new Map<string, { id: string; claimed: boolean; plot_index: number }>()
  if (adminClient) {
    let from = 0
    while (true) {
      const { data, error } = await adminClient
        .from('trees')
        .select('id, github_username_lower, claimed, plot_index')
        .order('plot_index', { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1)

      if (error) {
        throw new Error(`Failed to read existing trees from Supabase: ${error.message}`)
      }

      const batch = data ?? []
      for (const row of batch) {
        const lower = String((row as { github_username_lower?: string }).github_username_lower ?? '')
        if (lower) {
          existingByLower.set(lower, {
            id: String((row as { id: string }).id),
            claimed: Boolean((row as { claimed: boolean }).claimed),
            plot_index: Number((row as { plot_index: number }).plot_index),
          })
        }
      }
      if (batch.length < SUPABASE_PAGE_SIZE) break
      from += SUPABASE_PAGE_SIZE
    }
    console.log(`ℹ️ Existing trees in Supabase before seed: ${existingByLower.size}`)
  }

  // 1. Pre-seed `seen` with accounts already in Supabase so `--limit` counts only new targets
  const uniqueLogins: string[] = []
  const seen = new Set<string>()
  let preSkippedCount = 0
  for (const [lower, info] of existingByLower.entries()) {
    if (!opts.refresh || info.claimed) {
      seen.add(lower)
      preSkippedCount += 1
    }
  }

  for (const raw of SEED_GITHUB_USERNAMES) {
    const clean = raw.trim()
    const lower = clean.toLowerCase()
    if (!GITHUB_USERNAME_REGEX.test(clean) || seen.has(lower)) continue
    seen.add(lower)
    uniqueLogins.push(clean)
    if (uniqueLogins.length >= opts.limit) break
  }

  // 2. Automated discovery via GitHub REST Search API to scale up to 3,000+ new real devs
  if (!opts.skipSearch && uniqueLogins.length < opts.limit) {
    console.log(
      `🌐 Discovering new real GitHub devs via Search API (target new pool: ${opts.limit}, already in DB: ${existingByLower.size})...`,
    )
    await discoverGitHubAccountsViaSearch({
      targetCount: opts.limit,
      githubToken,
      seenLower: seen,
      orderedLogins: uniqueLogins,
    })
  }

  console.log(
    `🎄 Seeding Christmas Commit City with ${uniqueLogins.length} candidate GitHub accounts (year=${opts.year}, dryRun=${opts.dryRun}, refresh=${opts.refresh})`,
  )

  // Safety filter in case an account was claimed/inserted concurrently
  const targetsToFetch = uniqueLogins.filter((login) => {
    const existing = existingByLower.get(login.toLowerCase())
    if (!existing) return true
    if (existing.claimed) return false
    return opts.refresh
  })

  let created = 0
  let updated = 0
  const skipped = preSkippedCount + (uniqueLogins.length - targetsToFetch.length)
  let notFound = 0
  let failed = 0
  let processedCount = 0
  let nextLogMilestone = 100

  const batches: string[][] = []
  for (let start = 0; start < targetsToFetch.length; start += BATCH_SIZE) {
    batches.push(targetsToFetch.slice(start, start + BATCH_SIZE))
  }
  let nextBatchIdx = 0

  async function processBatch(batch: string[]): Promise<void> {
    const { results, failedLogins } = await fetchBatchFromGitHubResilient(batch, opts.year, githubToken)
    failed += failedLogins.length
    const failedSet = new Set(failedLogins.map((l) => l.toLowerCase()))

    const pendingInserts: Array<{
      user_id: null
      claimed: false
      github_username: string
      display_name: string
      avatar_url: string
      total_commits: number
      spent_commits: 0
      contribution_calendar: unknown
      last_synced_at: string
    }> = []
    const queuedLower = new Set<string>()

    for (const login of batch) {
      if (failedSet.has(login.toLowerCase())) continue
      const ghUser = results.get(login.toLowerCase())
      if (!ghUser) {
        notFound += 1
        continue
      }

      const totalContributions = Math.max(
        0,
        Math.floor(ghUser.contributionsCollection.contributionCalendar.totalContributions),
      )
      const calendarWeeks = ghUser.contributionsCollection.contributionCalendar.weeks
      const displayName = ghUser.name?.trim() || ghUser.login
      const canonicalLower = ghUser.login.toLowerCase()
      const existing = existingByLower.get(canonicalLower) ?? existingByLower.get(login.toLowerCase())
      const syncedAt = new Date().toISOString()

      if (opts.dryRun) {
        if (created < 25) {
          console.log(
            `  [dry-run] @${ghUser.login} -> ${totalContributions} commits (${displayName})`,
          )
        }
        created += 1
        continue
      }

      if (!adminClient) continue

      if (existing) {
        if (!opts.refresh || existing.claimed) continue
        const { error: updErr } = await adminClient
          .from('trees')
          .update({
            github_username: ghUser.login,
            display_name: displayName,
            avatar_url: ghUser.avatarUrl,
            total_commits: totalContributions,
            contribution_calendar: calendarWeeks,
            last_synced_at: syncedAt,
          })
          .eq('id', existing.id)
          .eq('claimed', false)

        if (updErr) {
          failed += 1
          console.error(`  ❌ Failed to update @${ghUser.login}: ${updErr.message}`)
        } else {
          updated += 1
        }
        continue
      }

      if (queuedLower.has(canonicalLower) || existingByLower.has(canonicalLower)) continue
      queuedLower.add(canonicalLower)
      pendingInserts.push({
        user_id: null,
        claimed: false,
        github_username: ghUser.login,
        display_name: displayName,
        avatar_url: ghUser.avatarUrl,
        total_commits: totalContributions,
        spent_commits: 0,
        contribution_calendar: calendarWeeks,
        last_synced_at: syncedAt,
      })
    }

    if (adminClient && pendingInserts.length > 0) {
      // Batch insert reduces Supabase round-trips; fall back row-by-row on conflict (e.g. 23505)
      const { data: insertedRows, error: bulkErr } = await adminClient
        .from('trees')
        .insert(pendingInserts)
        .select('id, github_username, plot_index')

      if (!bulkErr && insertedRows) {
        for (const inserted of insertedRows) {
          existingByLower.set(String(inserted.github_username).toLowerCase(), {
            id: String(inserted.id),
            claimed: false,
            plot_index: Number(inserted.plot_index),
          })
          created += 1
        }
      } else {
        for (const row of pendingInserts) {
          const { data: inserted, error: insErr } = await adminClient
            .from('trees')
            .insert(row)
            .select('id, github_username, plot_index')
            .single()

          if (insErr || !inserted) {
            if (insErr?.code === '23505') {
              continue
            }
            failed += 1
            console.error(`  ❌ Failed to insert @${row.github_username}: ${insErr?.message ?? 'unknown error'}`)
          } else {
            existingByLower.set(String(inserted.github_username).toLowerCase(), {
              id: String(inserted.id),
              claimed: false,
              plot_index: Number(inserted.plot_index),
            })
            created += 1
          }
        }
      }
    }

    processedCount += batch.length
    if (processedCount >= nextLogMilestone || processedCount === targetsToFetch.length) {
      while (nextLogMilestone <= processedCount) {
        nextLogMilestone += 100
      }
      console.log(`  ... processed ${processedCount}/${targetsToFetch.length} (created=${created}, updated=${updated})`)
    }
  }

  const workerCount = Math.min(BATCH_CONCURRENCY, Math.max(1, batches.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const idx = nextBatchIdx
        nextBatchIdx += 1
        if (idx >= batches.length) break
        await processBatch(batches[idx])
        if (nextBatchIdx < batches.length) {
          await sleep(BATCH_DELAY_MS)
        }
      }
    }),
  )

  console.log('\n✅ Seed complete:')
  console.log(`   Created : ${created}`)
  console.log(`   Updated : ${updated}`)
  console.log(`   Skipped : ${skipped}`)
  console.log(`   NotFound: ${notFound}`)
  console.log(`   Failed  : ${failed}`)
  if (!opts.dryRun) {
    console.log(`   Total trees in city: ${existingByLower.size}`)
  }
}

runSeed().catch((err) => {
  console.error('❌ Seed aborted:', err)
  process.exit(1)
})
