import { CATEGORIES, DIFFICULTIES } from './core/problem.js'

export const STORAGE_KEY = 'capy-math-v1'
export const SCHEMA_VERSION = 1

const byCategory = (value) =>
  Object.fromEntries(CATEGORIES.map(c => [c, typeof value === 'function' ? value() : value]))

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    level: 1,
    xp: 0,
    streakDays: 0,
    lastPlayedDate: null,
    setsPlayed: 0,
    perfectSets: 0,
    verticalSolved: 0,
    solvedByCategory: byCategory(0),
    recentByCategory: byCategory(() => []),
    difficultyByCategory: byCategory('easy'),
    bestByCategory: byCategory(null),
    reviewQueue: [],
    reviewEverHad: false,
    badges: []
  }
}

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v)

/** 카테고리별 항목을 하나씩 검사해 채운다. 값 하나가 이상해도 나머지 카테고리는 살린다 */
function mergeByCategory(value, base, isValid) {
  const out = { ...base }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const c of CATEGORIES) {
    if (c in value && isValid(value[c])) out[c] = value[c]
  }
  return out
}

const isValidBest = (v) =>
  v === null || (v && typeof v === 'object' && isFiniteNumber(v.correct) && isFiniteNumber(v.elapsedMs))

const isValidReviewEntry = (e) =>
  e && typeof e === 'object' &&
  (typeof e.id === 'string' || typeof e.id === 'number') &&
  CATEGORIES.includes(e.category) &&
  isFiniteNumber(e.a) && isFiniteNumber(e.b)

/**
 * 저장된 값과 기본값을 한 겹 합친다. 필드마다 타입을 검사해, 값 하나가 깨져도
 * 그 필드만 기본값으로 되돌리고 나머지는 살린다 — 저장 파일 하나가 깨졌다고
 * 앱 전체가 조용히 고장 나면 안 된다(명세 10장).
 */
function merge(saved) {
  const base = defaultState()
  const out = { ...base }

  if (isFiniteNumber(saved.level)) out.level = saved.level
  if (isFiniteNumber(saved.xp)) out.xp = saved.xp
  if (isFiniteNumber(saved.streakDays)) out.streakDays = saved.streakDays
  if (typeof saved.lastPlayedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.lastPlayedDate)) {
    out.lastPlayedDate = saved.lastPlayedDate
  }
  if (isFiniteNumber(saved.setsPlayed)) out.setsPlayed = saved.setsPlayed
  if (isFiniteNumber(saved.perfectSets)) out.perfectSets = saved.perfectSets
  if (isFiniteNumber(saved.verticalSolved)) out.verticalSolved = saved.verticalSolved

  out.solvedByCategory = mergeByCategory(saved.solvedByCategory, base.solvedByCategory, isFiniteNumber)
  out.recentByCategory = mergeByCategory(saved.recentByCategory, base.recentByCategory, Array.isArray)
  out.difficultyByCategory = mergeByCategory(
    saved.difficultyByCategory, base.difficultyByCategory, (v) => DIFFICULTIES.includes(v)
  )
  out.bestByCategory = mergeByCategory(saved.bestByCategory, base.bestByCategory, isValidBest)

  out.reviewQueue = Array.isArray(saved.reviewQueue)
    ? saved.reviewQueue.filter(isValidReviewEntry)
    : base.reviewQueue
  out.reviewEverHad = typeof saved.reviewEverHad === 'boolean' ? saved.reviewEverHad : base.reviewEverHad
  out.badges = Array.isArray(saved.badges) ? saved.badges.filter(b => typeof b === 'string') : base.badges

  out.version = SCHEMA_VERSION
  return out
}

export function loadState(store = globalThis.localStorage) {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaultState()
    if (parsed.version !== SCHEMA_VERSION) return defaultState()
    return merge(parsed)
  } catch {
    return defaultState()   // 저장이 막혔거나 값이 깨졌다 — 아이에게 오류를 보이지 않는다
  }
}

export function saveState(state, store = globalThis.localStorage) {
  try {
    if (!store || typeof store.setItem !== 'function') return false
    store.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
