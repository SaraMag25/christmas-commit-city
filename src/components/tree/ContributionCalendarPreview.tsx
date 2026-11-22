import { Calendar, GitCommit } from 'lucide-react'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/githubPeriod'
import { useLocale } from '../../context/localeContextStore'
import type { GitHubContributionStats } from '../../types/city'
import {
  CALENDAR_LEGEND_COLORS,
  computeCalendarMaxDayCount,
  countActiveCalendarDays,
  getGitHubCalendarCellColor,
  selectRecentCalendarWeeks,
} from '../../utils/calendarStats'

interface ContributionCalendarPreviewProps {
  stats?: GitHubContributionStats
  fallbackTotal: number
}

export function ContributionCalendarPreview({
  stats,
  fallbackTotal,
}: ContributionCalendarPreviewProps) {
  const { language, t } = useLocale()
  const recentWeeks = selectRecentCalendarWeeks(stats?.calendarWeeks, 26)
  const maxDayCount = computeCalendarMaxDayCount(recentWeeks)
  const activeDays = countActiveCalendarDays(stats?.calendarWeeks)
  const totalCommits = stats ? Math.max(stats.totalContributions, fallbackTotal) : fallbackTotal
  const periodYear = stats?.periodYear ?? STANDARD_CONTRIBUTION_YEAR

  return (
    <section className="pixel-night-panel rounded-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5">
        <h2 className="flex items-center gap-2 text-xs font-bold text-amber-300">
          <Calendar className="h-4 w-4" />
          {t.calendar.title} ({periodYear})
        </h2>
        <span className="text-[10px] text-slate-400">
          {stats ? t.calendar.graphqlSource : t.calendar.demoSource}
        </span>
      </div>

      <div className="mt-4 grid gap-3.5 md:grid-cols-[1fr_196px] md:items-stretch">
        <div className="flex min-w-0 flex-col justify-between rounded-sm border border-slate-800 bg-[#040811]/90 p-3.5">
          {recentWeeks.length > 0 ? (
            <>
              <div>
                <p className="mb-2.5 text-[10px] text-slate-300">
                  {t.calendar.recentTitle} ({recentWeeks.length} {t.calendar.weeks})
                </p>
                <div className="flex gap-[3px] overflow-x-auto pb-1">
                  {recentWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex shrink-0 flex-col gap-[3px]">
                      {week.contributionDays.map((day) => (
                        <span
                          key={day.date}
                          title={`${day.date}: ${day.contributionCount} commits`}
                          className="block h-2.5 w-2.5 shrink-0 rounded-[1px] border border-white/5"
                          style={{
                            backgroundColor: getGitHubCalendarCellColor(
                              day.contributionCount,
                              maxDayCount,
                            ),
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
                <span>{t.calendar.less}</span>
                {CALENDAR_LEGEND_COLORS.map((hex) => (
                  <span
                    key={hex}
                    className="block h-2.5 w-2.5 shrink-0 rounded-[1px] border border-white/5"
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <span>{t.calendar.more}</span>
              </div>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-slate-400">{t.calendar.emptyHint}</p>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-sm border border-emerald-500/30 bg-[#040811]/90 p-3.5">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
              <GitCommit className="h-3.5 w-3.5 shrink-0" />
              <span>{t.calendar.totalTitle}</span>
            </p>
            <p className="mt-2 font-pixel-title text-2xl font-bold text-emerald-400">
              {totalCommits.toLocaleString(language)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {t.calendar.totalSubtitle} ({periodYear})
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[10px]">
            <span className="text-slate-400">{t.calendar.activeDays}</span>
            <span className="font-semibold text-emerald-300">
              {activeDays.toLocaleString(language)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
