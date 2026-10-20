import type { Planet, Resources, TechnologyType } from '@/types/game'
import { BuildingType } from '@/types/game'
import { formatNumber } from '@/utils/format'

type Translate = (key: string, params?: Record<string, string | number>) => string

export interface RequirementProgress {
  name: string
  required: number
  current: number
}

/**
 * 把配置里的 requirements（建筑/科技 key -> 等级）展开成可读的当前进度。
 */
export const collectRequirementProgress = (
  planet: Planet,
  technologies: Partial<Record<TechnologyType, number>>,
  requirements: Partial<Record<string, number>> | undefined,
  buildingConfigs: Record<string, { name: string }>,
  technologyConfigs: Record<string, { name: string }>
): RequirementProgress[] => {
  if (!requirements) return []

  return Object.entries(requirements).map(([key, requiredLevel]) => {
    const required = requiredLevel ?? 0
    if (Object.values(BuildingType).includes(key as BuildingType)) {
      return {
        name: buildingConfigs[key]?.name ?? key,
        required,
        current: planet.buildings[key as BuildingType] || 0
      }
    }

    return {
      name: technologyConfigs[key]?.name ?? key,
      required,
      current: technologies[key as TechnologyType] || 0
    }
  })
}

export const formatRequirementHint = (requirements: RequirementProgress[], t: Translate): string => {
  const missing = requirements.filter(requirement => requirement.current < requirement.required)
  if (missing.length === 0) return t('errors.requirementsNotMet')

  const details = missing
    .map(requirement =>
      t('baseHints.requirementItem', {
        name: requirement.name,
        required: requirement.required,
        current: requirement.current
      })
    )
    .join('、')

  return t('baseHints.requirements', { requirements: details })
}

/**
 * 返回“还差哪些资源”的详细提示；资源足够时返回 null。
 */
export const formatResourceShortfall = (resources: Resources, cost: Partial<Resources>, t: Translate): string | null => {
  const keys = ['metal', 'crystal', 'deuterium', 'darkMatter'] as const
  const missing = keys
    .filter(key => (resources[key] || 0) < (cost[key] || 0))
    .map(key =>
      t('baseHints.resourceItem', {
        name: t(`resources.${key}`),
        amount: formatNumber(Math.ceil((cost[key] || 0) - (resources[key] || 0)))
      })
    )

  return missing.length > 0 ? t('baseHints.resourcesMissing', { resources: missing.join('、') }) : null
}
