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

/**
 * 파싱된 값(JSON.parse 결과)이 이 앱의 상태로 쓸 만한지 검사해 채워 돌려준다.
 * 봉투(버전 등) 자체가 안 맞으면 null. loadState 와 진도 불러오기가 이 한 함수를
 * 같이 써서, "저장에서 읽기"와 "파일에서 불러오기"가 서로 다른 검증을 갖지 않는다.
 */
export function validateState(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (parsed.version !== SCHEMA_VERSION) return null
  return merge(parsed)
}

export function loadState(store = globalThis.localStorage) {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    return validateState(parsed) ?? defaultState()
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

// --- 진도 내보내기 / 불러오기 ---
// 다른 기기로 진도를 옮기기 위한 파일. localStorage 는 브라우저·주소마다
// 따로 있어서, GitHub Pages 로 옮기거나 다른 컴퓨터를 쓰면 진도가 안 보인다.

export const EXPORT_KIND = 'capy-math-progress'

/** state 를 담은 봉투를 만든다. kind/schemaVersion 으로 나중에 "이 파일이 맞는지" 알아본다. */
export function buildExport(state) {
  return {
    kind: EXPORT_KIND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state
  }
}

/**
 * 이미 JSON.parse 된 값을 불러오기용으로 검증한다. 실패하면 상태를 하나도
 * 바꾸지 않도록 { ok: false, reason } 을 돌려준다. 성공하면 { ok: true, state }.
 * 안의 state 는 loadState 와 똑같은 validateState/merge 를 거치므로, 필드 하나가
 * 깨져 있어도 그 필드만 기본값으로 되돌아가고 예외는 던지지 않는다.
 *
 * schemaVersion 이 지금 버전과 다르면 통째로 거부한다 — 지금은 스키마가
 * 1가지뿐이라 옮겨 줄 마이그레이션 경로가 없고, 어설프게 맞춰 넣느니 거부하는
 * 편이 안전하다. 다만 "더 새것"과 "더 오래됨"은 화면에서 서로 다른 말을 해야
 * 하는 별개 상황이라(하나는 지금 새로고침하면 풀리고, 하나는 안 풀린다)
 * reason 을 나눠서 돌려준다.
 */
export function parseImport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'not-object' }
  }
  if (value.kind !== EXPORT_KIND) return { ok: false, reason: 'wrong-kind' }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      reason: value.schemaVersion > SCHEMA_VERSION ? 'wrong-version-newer' : 'wrong-version-older'
    }
  }
  const state = validateState(value.state)
  if (!state) return { ok: false, reason: 'invalid-state' }
  return { ok: true, state }
}
