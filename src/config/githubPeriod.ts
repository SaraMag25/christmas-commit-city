export interface ContributionWindow {
  year: number
  fromIso: string
  toIso: string
}

export const STANDARD_CONTRIBUTION_YEAR = Number(
  import.meta.env.VITE_CONTRIBUTION_YEAR || new Date().getFullYear(),
)

/**
 * Standardized contribution comparison window (Jan 1 .. Dec 31 of the active year)
 * so veteran accounts and newer developers compete on equal footing.
 */
export function getStandardContributionWindow(
  year = STANDARD_CONTRIBUTION_YEAR,
): ContributionWindow {
  return {
    year,
    fromIso: `${year}-01-01T00:00:00.000Z`,
    toIso: `${year}-12-31T23:59:59.999Z`,
  }
}
