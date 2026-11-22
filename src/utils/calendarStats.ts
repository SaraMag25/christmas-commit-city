import type { GitHubContributionWeek } from '../types/city'

export const CALENDAR_INTENSITY_COLORS = {
  empty: '#162033',
  level1: '#166534',
  level2: '#229448',
  level3: '#30c056',
  level4: '#39d353',
} as const

export const CALENDAR_LEGEND_COLORS = [
  CALENDAR_INTENSITY_COLORS.empty,
  CALENDAR_INTENSITY_COLORS.level1,
  CALENDAR_INTENSITY_COLORS.level2,
  CALENDAR_INTENSITY_COLORS.level3,
  CALENDAR_INTENSITY_COLORS.level4,
] as const

/**
 * Selects the most recent `weekCount` weeks with actual contribution context.
 * When a full Jan-Dec GitHub GraphQL calendar has trailing future zero-weeks
 * (or all activity happened earlier in the year), anchors the window end to
 * the latest active week / today so the graph never renders an all-dark slice.
 */
export function selectRecentCalendarWeeks(
  calendarWeeks: readonly GitHubContributionWeek[] | undefined,
  weekCount: number,
): GitHubContributionWeek[] {
  if (!calendarWeeks || calendarWeeks.length === 0) return []
  if (calendarWeeks.length <= weekCount) return [...calendarWeeks]

  const todayIso = new Date().toISOString().slice(0, 10)
  let lastWeekUpToToday = -1
  let lastActiveWeek = -1

  for (let w = 0; w < calendarWeeks.length; w += 1) {
    const days = calendarWeeks[w]?.contributionDays ?? []
    if (days.some((d) => d.date && d.date <= todayIso)) {
      lastWeekUpToToday = w
    }
    if (days.some((d) => d.contributionCount > 0)) {
      lastActiveWeek = w
    }
  }

  let endExclusive = calendarWeeks.length
  if (lastWeekUpToToday >= 0) {
    endExclusive = Math.max(lastWeekUpToToday + 1, lastActiveWeek + 1)
  }

  let start = Math.max(0, endExclusive - weekCount)
  let slice = calendarWeeks.slice(start, endExclusive)

  const sliceHasActivity = slice.some((w) =>
    w.contributionDays.some((d) => d.contributionCount > 0),
  )
  if (!sliceHasActivity && lastActiveWeek >= 0) {
    endExclusive = lastActiveWeek + 1
    start = Math.max(0, endExclusive - weekCount)
    slice = calendarWeeks.slice(start, endExclusive)
  }

  return slice
}

export function computeCalendarMaxDayCount(weeks: readonly GitHubContributionWeek[]): number {
  let max = 0
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > max) max = day.contributionCount
    }
  }
  return max
}

export function countActiveCalendarDays(weeks: readonly GitHubContributionWeek[] | undefined): number {
  if (!weeks) return 0
  let active = 0
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > 0) active += 1
    }
  }
  return active
}

export function getGitHubCalendarCellColor(count: number, maxDayCount = 10): string {
  if (count <= 0) return CALENDAR_INTENSITY_COLORS.empty
  if (count >= 10 || (maxDayCount >= 5 && count >= Math.max(5, Math.ceil(maxDayCount * 0.78)))) {
    return CALENDAR_INTENSITY_COLORS.level4
  }
  if (count >= 5 || (maxDayCount >= 4 && count >= Math.max(3, Math.ceil(maxDayCount * 0.48)))) {
    return CALENDAR_INTENSITY_COLORS.level3
  }
  if (count >= 2) {
    return CALENDAR_INTENSITY_COLORS.level2
  }
  return CALENDAR_INTENSITY_COLORS.level1
}
