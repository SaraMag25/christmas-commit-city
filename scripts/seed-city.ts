import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/
const BATCH_SIZE = 8
const BATCH_DELAY_MS = 220

/**
 * Curated list of ~210 well-known public GitHub developer accounts across:
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
  'sindresorhus',
  'substack',
  'mafintosh',
  'feross',
  'maxogden',
  'mxstbr',
  'ljharb',
  'ljos',
  'sindresorhus',
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
  'ThePrimeagen',
  'primeagen',
  'jwasham',
  'kamranahmedse',
  'donnemartin',
  'trekhleb',
  'vinta',
  'public-apis',
  'kdn251',
]

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
  year: number
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)
  const fallbackYear =
    Number(process.env.CONTRIBUTION_YEAR || process.env.VITE_CONTRIBUTION_YEAR) ||
    new Date().getUTCFullYear()

  let limit = 250
  let refresh = false
  let dryRun = false
  let year = fallbackYear

  for (const arg of args) {
    if (arg === '--refresh') refresh = true
    else if (arg === '--dry-run') dryRun = true
    else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length))
      if (Number.isInteger(n) && n > 0) limit = n
    } else if (arg.startsWith('--year=')) {
      const y = Number(arg.slice('--year='.length))
      if (Number.isInteger(y) && y >= 2020 && y <= new Date().getUTCFullYear() + 1) year = y
    }
  }

  return { limit, refresh, dryRun, year }
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

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Christmas-Commit-City-Seeder',
    },
    body: JSON.stringify({ query, variables }),
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

  // Deduplicate case-insensitively while preserving plaza-center order
  const uniqueLogins: string[] = []
  const seen = new Set<string>()
  for (const raw of SEED_GITHUB_USERNAMES) {
    const clean = raw.trim()
    const lower = clean.toLowerCase()
    if (!GITHUB_USERNAME_REGEX.test(clean) || seen.has(lower)) continue
    seen.add(lower)
    uniqueLogins.push(clean)
    if (uniqueLogins.length >= opts.limit) break
  }

  console.log(
    `🎄 Seeding Christmas Commit City with up to ${uniqueLogins.length} real GitHub accounts (year=${opts.year}, dryRun=${opts.dryRun}, refresh=${opts.refresh})`,
  )

  const adminClient =
    !opts.dryRun && supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  const existingByLower = new Map<string, { id: string; claimed: boolean; plot_index: number }>()
  if (adminClient) {
    const { data, error } = await adminClient
      .from('trees')
      .select('id, github_username_lower, claimed, plot_index')
      .order('plot_index', { ascending: true })

    if (error) {
      throw new Error(`Failed to read existing trees from Supabase: ${error.message}`)
    }

    for (const row of data ?? []) {
      const lower = String((row as { github_username_lower?: string }).github_username_lower ?? '')
      if (lower) {
        existingByLower.set(lower, {
          id: String((row as { id: string }).id),
          claimed: Boolean((row as { claimed: boolean }).claimed),
          plot_index: Number((row as { plot_index: number }).plot_index),
        })
      }
    }
    console.log(`ℹ️ Existing trees in Supabase before seed: ${existingByLower.size}`)
  }

  const targetsToFetch = opts.refresh
    ? uniqueLogins
    : uniqueLogins.filter((login) => !existingByLower.has(login.toLowerCase()))

  let created = 0
  let updated = 0
  const skipped = uniqueLogins.length - targetsToFetch.length
  let notFound = 0
  let failed = 0

  for (let start = 0; start < targetsToFetch.length; start += BATCH_SIZE) {
    const batch = targetsToFetch.slice(start, start + BATCH_SIZE)
    let results: Map<string, GitHubGraphQLUserResult>
    try {
      results = await fetchBatchFromGitHub(batch, opts.year, githubToken)
    } catch (err) {
      console.error(`❌ GitHub batch error (${batch.join(', ')}):`, err)
      failed += batch.length
      continue
    }

    for (const login of batch) {
      const ghUser = results.get(login.toLowerCase())
      if (!ghUser) {
        notFound += 1
        console.log(`  ⚠️ Not found / skipped (non-user or renamed): @${login}`)
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
        console.log(
          `  [dry-run] @${ghUser.login} -> ${totalContributions} commits (${displayName})`,
        )
        created += 1
        continue
      }

      if (!adminClient) continue

      if (existing) {
        if (!opts.refresh) continue
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

        if (updErr) {
          failed += 1
          console.error(`  ❌ Failed to update @${ghUser.login}: ${updErr.message}`)
        } else {
          updated += 1
        }
        continue
      }

      // Insert as unclaimed public developer tree; PostgreSQL assigns sequential `plot_index`
      const { data: inserted, error: insErr } = await adminClient
        .from('trees')
        .insert({
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
        .select('id, plot_index')
        .single()

      if (insErr || !inserted) {
        if (insErr?.code === '23505') {
          continue
        }
        failed += 1
        console.error(`  ❌ Failed to insert @${ghUser.login}: ${insErr?.message ?? 'unknown error'}`)
      } else {
        existingByLower.set(canonicalLower, {
          id: String(inserted.id),
          claimed: false,
          plot_index: Number(inserted.plot_index),
        })
        created += 1
      }
    }

    const doneCount = Math.min(targetsToFetch.length, start + BATCH_SIZE)
    console.log(`  ... processed ${doneCount}/${targetsToFetch.length}`)

    if (start + BATCH_SIZE < targetsToFetch.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

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
