import { useState } from 'react'
import { Compass, Flame, Gift, GitCommit, Sparkles, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AvatarBadge } from '../components/common/AvatarBadge'
import { SubpageLayout } from '../components/layout/SubpageLayout'
import { STANDARD_CONTRIBUTION_YEAR } from '../config/pixCampaign'
import { resolveTreeStage } from '../config/treeLevels'
import { computeTreeDecorationScore, MOCK_CITY_TREES } from '../data/mockCityData'
import type { CityTree } from '../types/city'

type RankingCategory = 'contributions' | 'gifts' | 'active' | 'decorated'

interface RankingTabMeta {
  id: RankingCategory
  label: string
  description: string
  metricLabel: (tree: CityTree) => string
}

const RANKING_TABS: readonly RankingTabMeta[] = [
  {
    id: 'contributions',
    label: 'Mais Contribuições',
    description: `Árvores classificadas exclusivamente pelas contribuições no GitHub em ${STANDARD_CONTRIBUTION_YEAR}.`,
    metricLabel: (tree) => `${tree.contribution_count} commits`,
  },
  {
    id: 'gifts',
    label: 'Mais Presenteadas',
    description: 'Árvores que receberam mais presentes da comunidade (métrica independente de commits).',
    metricLabel: (tree) =>
      `${tree.gifts.length} ${tree.gifts.length === 1 ? 'presente' : 'presentes'}`,
  },
  {
    id: 'active',
    label: 'Devs Mais Ativos',
    description: 'Desenvolvedores com maior nível de iluminação e consistência na temporada.',
    metricLabel: (tree) => {
      const stage = resolveTreeStage(tree.contribution_count)
      return `Nv. ${stage.level} · ${tree.contribution_count} commits`
    },
  },
  {
    id: 'decorated',
    label: 'Mais Decoradas',
    description: 'Combina estágio visual da árvore, variedade de enfeites e raridade dos presentes.',
    metricLabel: (tree) => `${computeTreeDecorationScore(tree)} pts de decoração`,
  },
]

function sortTreesByCategory(
  trees: readonly CityTree[],
  category: RankingCategory,
): CityTree[] {
  const copy = [...trees]
  switch (category) {
    case 'contributions':
      return copy.sort((a, b) => b.contribution_count - a.contribution_count)
    case 'gifts':
      return copy.sort(
        (a, b) =>
          b.gifts.length - a.gifts.length || b.contribution_count - a.contribution_count,
      )
    case 'active':
      return copy.sort(
        (a, b) => b.tree_level - a.tree_level || b.contribution_count - a.contribution_count,
      )
    case 'decorated':
      return copy.sort(
        (a, b) =>
          computeTreeDecorationScore(b) - computeTreeDecorationScore(a) ||
          b.gifts.length - a.gifts.length,
      )
  }
}

export function RankingsPage() {
  const [activeTab, setActiveTab] = useState<RankingCategory>('contributions')
  const currentMeta = RANKING_TABS.find((t) => t.id === activeTab) ?? RANKING_TABS[0]

  const sortedTrees = sortTreesByCategory(MOCK_CITY_TREES, activeTab)

  const renderTabIcon = (id: RankingCategory) => {
    switch (id) {
      case 'contributions':
        return <GitCommit className="h-3.5 w-3.5" />
      case 'gifts':
        return <Gift className="h-3.5 w-3.5" />
      case 'active':
        return <Flame className="h-3.5 w-3.5" />
      case 'decorated':
        return <Sparkles className="h-3.5 w-3.5" />
    }
  }

  return (
    <SubpageLayout maxWidthClass="max-w-4xl">
      <section className="pixel-wood-panel rounded-sm p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-6 w-6 text-amber-300" />
          <div>
            <h1 className="font-pixel-title text-sm text-amber-300 sm:text-base">
              Rankings da Vila
            </h1>
            <p className="mt-1 font-pixel-body text-xl text-amber-100">
              Métricas transparentes: commits no GitHub nunca se misturam com presentes recebidos.
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RANKING_TABS.map((tab) => {
            const isSelected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pixel-btn rounded-sm px-3 py-2 text-[11px] font-bold ${
                  isSelected ? 'pixel-btn-gold' : 'pixel-btn-pine'
                }`}
              >
                {renderTabIcon(tab.id)}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <p className="mt-3 rounded-sm border border-[#8c5835] bg-[#261409]/80 px-3 py-2 text-xs text-amber-100/90">
          {currentMeta.description}
        </p>

        {/* Ranking Rows */}
        <ol className="mt-4 space-y-2.5">
          {sortedTrees.map((tree, idx) => {
            const stage = resolveTreeStage(tree.contribution_count)
            const rank = idx + 1
            const rankColor =
              rank === 1
                ? 'text-amber-300 border-amber-400 bg-amber-500/20'
                : rank === 2
                  ? 'text-slate-200 border-slate-300 bg-slate-400/15'
                  : rank === 3
                    ? 'text-orange-300 border-orange-400 bg-orange-500/15'
                    : 'text-slate-400 border-slate-700 bg-[#070d1f]'

            return (
              <li
                key={tree.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-500/25 bg-[#070d1f]/85 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border font-pixel-title text-xs ${rankColor}`}
                  >
                    {rank}
                  </span>

                  <AvatarBadge
                    username={tree.profile.github_username}
                    name={tree.profile.github_name}
                    avatarUrl={tree.profile.avatar_url}
                    size="sm"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        to={`/tree/${tree.profile.github_username}`}
                        className="truncate text-xs font-bold text-amber-200 hover:underline"
                      >
                        {tree.profile.github_name}
                      </Link>
                      {tree.is_creator_special && (
                        <span className="rounded-sm bg-sky-500/25 px-1.5 py-0.5 text-[9px] font-bold text-sky-200">
                          UFC
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-slate-400">
                      @{tree.profile.github_username} ·{' '}
                      <span style={{ color: stage.accentColor }}>{stage.name}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-emerald-500/35 bg-[#0f2e24]/80 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
                    {currentMeta.metricLabel(tree)}
                  </span>

                  <Link
                    to={`/tree/${tree.profile.github_username}`}
                    className="pixel-btn pixel-btn-wood rounded-sm px-2.5 py-1 text-[10px] font-bold"
                  >
                    Perfil
                  </Link>

                  <Link
                    to={`/?focus=${encodeURIComponent(tree.profile.github_username)}`}
                    className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[10px] font-bold"
                    title="Ver árvore na vila"
                  >
                    <Compass className="h-3 w-3" />
                    <span className="hidden sm:inline">Vila</span>
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </SubpageLayout>
  )
}
