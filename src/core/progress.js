import { CATEGORIES, CATEGORY_LABELS } from './problem.js'

export const MAX_LEVEL = 50

/** 레벨 n 에서 n+1 로 가는 데 필요한 경험치. 50레벨까지 누적 14,700 */
export function xpForLevel(level) {
  return 60 + (level - 1) * 10
}

const BASE_XP = {
  'times-table':  { easy: 2, normal: 3, hard: 4 },
  'two-by-one':   { easy: 4, normal: 5, hard: 6 },
  'three-by-one': { easy: 6, normal: 8, hard: 10 },
  'two-by-two':   { easy: 8, normal: 10, hard: 12 }
}

export function problemXp({ category, difficulty, isReview = false, usedHint = false }) {
  let xp = BASE_XP[category][difficulty]
  if (isReview) xp = Math.round(xp * 1.5)
  if (usedHint) xp = Math.round(xp / 2)
  return xp
}

export function setBonus({ allCorrect, streakDays }) {
  return 5 + (allCorrect ? 10 : 0) + Math.min(streakDays * 2, 10)
}

export function applyXp({ level, xp }, gained) {
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, xp: 0, leveledUp: false, levelsGained: 0 }
  }
  let nextLevel = level
  let pool = xp + gained
  let gainedLevels = 0

  while (nextLevel < MAX_LEVEL && pool >= xpForLevel(nextLevel)) {
    pool -= xpForLevel(nextLevel)
    nextLevel++
    gainedLevels++
  }
  if (nextLevel >= MAX_LEVEL) pool = 0

  return {
    level: nextLevel,
    xp: pool,
    leveledUp: gainedLevels > 0,
    levelsGained: gainedLevels
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

export function updateStreak({ streakDays, lastPlayedDate }, todayDate) {
  if (!lastPlayedDate) return { streakDays: 1, lastPlayedDate: todayDate }
  const gap = daysBetween(lastPlayedDate, todayDate)
  if (gap === 0) return { streakDays, lastPlayedDate }
  if (gap === 1) return { streakDays: streakDays + 1, lastPlayedDate: todayDate }
  return { streakDays: 1, lastPlayedDate: todayDate }   // 건너뛰었거나 시계가 거꾸로 갔다
}

export const BADGES = {
  'first-set':       { label: '첫 걸음',     description: '첫 판을 끝냈어요' },
  'first-perfect':   { label: '완벽했어요',   description: '한 판을 다 맞혔어요' },
  'first-vertical':  { label: '세로셈 성공',  description: '세로셈을 처음으로 끝까지 풀었어요' },
  'streak-3':        { label: '사흘 연속',   description: '3일 연속으로 했어요' },
  'streak-7':        { label: '일주일 연속', description: '7일 연속으로 했어요' },
  'streak-30':       { label: '한 달 연속',  description: '30일 연속으로 했어요' },
  'review-cleared':  { label: '다 극복했어요', description: '복습 주머니를 비웠어요' },
  'series-1':        { label: '풀밭 졸업',   description: '풀밭 카피바라를 다 키웠어요' },
  'series-2':        { label: '온천 졸업',   description: '온천 카피바라를 다 키웠어요' },
  'series-3':        { label: '과수원 졸업', description: '과수원 카피바라를 다 키웠어요' },
  'series-4':        { label: '눈나라 졸업', description: '눈나라 카피바라를 다 키웠어요' },
  'series-5':        { label: '별나라 졸업', description: '별나라 카피바라를 다 키웠어요' }
}

/** 한글 음절의 받침 유무로 '을/를' 조사를 고른다 */
function objectParticle(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '을'
  return code % 28 === 0 ? '를' : '을'
}

for (const c of CATEGORIES) {
  const label = CATEGORY_LABELS[c]
  const particle = objectParticle(label)
  for (const n of [100, 500]) {
    BADGES[`${c}-${n}`] = {
      label: `${label} ${n}문제`,
      description: `${label}${particle} ${n}문제 풀었어요`
    }
  }
}

export function earnedBadges(state) {
  const out = []
  if (state.setsPlayed >= 1) out.push('first-set')
  if (state.perfectSets >= 1) out.push('first-perfect')
  if (state.verticalSolved >= 1) out.push('first-vertical')
  for (const n of [3, 7, 30]) if (state.streakDays >= n) out.push(`streak-${n}`)
  for (const c of CATEGORIES) {
    const solved = state.solvedByCategory[c] || 0
    for (const n of [100, 500]) if (solved >= n) out.push(`${c}-${n}`)
  }
  if (state.reviewEverHad && state.reviewQueue.length === 0) out.push('review-cleared')
  for (let s = 1; s <= 5; s++) if (state.level >= s * 10 + 1 || (s === 5 && state.level >= MAX_LEVEL)) {
    out.push(`series-${s}`)
  }
  return out
}
