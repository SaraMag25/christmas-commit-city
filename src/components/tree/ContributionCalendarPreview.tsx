import { GitCommit, GitPullRequest, CircleDot, Calendar } from 'lucide-react'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/githubPeriod'
import type { GitHubContributionStats } from '../../types/city'

interface ContributionCalendarPreviewProps {
  stats?: GitHubContributionStats
  fallbackTotal: number
}

function getPixelCellColor(count: number): string {
  if (count <= 0) return '#0f172a'
  if (count <= 2) return '#14532d'
  if (count <= 5) return '#15803d'
  if (count <= 9) return '#22c55e'
  return '#4ade80'
}

export function ContributionCalendarPreview({
  stats,
  fallbackTotal,
}: ContributionCalendarPreviewProps) {
  const recentWeeks = stats?.calendarWeeks.slice(-26) ?? []

  return (
    <section className="pixel-night-panel rounded-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5">
        <h2 className="flex items-center gap-2 text-xs font-bold text-amber-300">
          <Calendar className="h-4 w-4" />
          Atividade no GitHub ({stats?.periodYear ?? STANDARD_CONTRIBUTION_YEAR})
        </h2>
        <span className="text-[10px] text-slate-400">
          {stats ? 'Dados via GitHub GraphQL API' : 'Dados de demonstração'}
        </span>
      </div>

      {/* Commits / PRs / Issues breakdown */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-sm border border-emerald-500/30 bg-[#0f2e24]/70 p-2.5">
          <p className="flex items-center justify-center gap-1 text-[10px] text-emerald-200/80">
            <GitCommit className="h-3 w-3" />
            Commits
          </p>
          <p className="mt-1 font-pixel-title text-sm text-emerald-300">
            {stats ? stats.commits : fallbackTotal}
          </p>
        </div>

        <div className="rounded-sm border border-sky-500/30 bg-[#15244a]/70 p-2.5">
          <p className="flex items-center justify-center gap-1 text-[10px] text-sky-200/80">
            <GitPullRequest className="h-3 w-3" />
            Pull Requests
          </p>
          <p className="mt-1 font-pixel-title text-sm text-sky-300">
            {stats ? stats.pullRequests : '—'}
          </p>
        </div>

        <div className="rounded-sm border border-amber-500/30 bg-[#3b2110]/60 p-2.5">
          <p className="flex items-center justify-center gap-1 text-[10px] text-amber-200/80">
            <CircleDot className="h-3 w-3" />
            Issues
          </p>
          <p className="mt-1 font-pixel-title text-sm text-amber-300">
            {stats ? stats.issues : '—'}
          </p>
        </div>
      </div>

      {/* Contribution Calendar Pixels */}
      {recentWeeks.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] text-slate-300">
            Calendário recente de contribuições ({recentWeeks.length} semanas)
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {recentWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.contributionDays.map((day) => (
                  <span
                    key={day.date}
                    title={`${day.date}: ${day.contributionCount} contribuições`}
                    className="h-2.5 w-2.5 rounded-[1px] border border-white/10"
                    style={{ backgroundColor: getPixelCellColor(day.contributionCount) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-400">
          Ao conectar sua conta com o botão <strong>Conectar com GitHub</strong>, o calendário
          completo de contribuições de {STANDARD_CONTRIBUTION_YEAR} aparecerá aqui.
        </p>
      )}
    </section>
  )
}
