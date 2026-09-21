import { CATEGORIES } from './problem.js'

/**
 * 오늘 권할 카테고리 하나를 고른다.
 * 1) 복습할 문제가 있으면 그 카테고리
 * 2) 아직 한 번도 안 해본 카테고리가 있으면 그중 가장 쉬운 것
 * 3) 아니면 최근 정확도가 가장 낮은 카테고리
 */
export function recommendCategory(state) {
  const first = state.reviewQueue?.[0]
  if (first && CATEGORIES.includes(first.category)) return first.category

  const untouched = CATEGORIES.find(c => (state.solvedByCategory?.[c] || 0) === 0)
  if (untouched) return untouched

  let worst = CATEGORIES[0]
  let worstAccuracy = Infinity
  for (const c of CATEGORIES) {
    const recent = state.recentByCategory?.[c] || []
    const accuracy = recent.length === 0 ? 0 : recent.filter(Boolean).length / recent.length
    if (accuracy < worstAccuracy) { worstAccuracy = accuracy; worst = c }
  }
  return worst
}
