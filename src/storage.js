import { CATEGORIES } from './core/problem.js'

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

/** 저장된 값과 기본값을 한 겹 합친다. 카테고리별 항목은 카테고리 단위로 채운다 */
function merge(saved) {
  const base = defaultState()
  const out = { ...base }
  for (const key of Object.keys(base)) {
    const value = saved[key]
    if (value === undefined || value === null) continue
    if (key.endsWith('ByCategory')) {
      out[key] = { ...base[key], ...(typeof value === 'object' ? value : {}) }
    } else {
      out[key] = value
    }
  }
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
