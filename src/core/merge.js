import { CATEGORIES } from './problem.js'
import { BADGES } from './progress.js'
import { MAX_QUEUE } from './review.js'

/**
 * 같은 계정을 두 기기에서 쓰거나, 게스트 진도를 계정에 합칠 때 두 state 를
 * 하나로 합친다. 원칙은 "항목별로 더 진행된 쪽" — 합친 결과가 어느 한쪽보다
 * 뒤로 가는 항목이 없어야 한다. 입력은 이미 validateState 를 거친 값이라고
 * 가정하고, 입력을 바꾸지 않는다.
 */
export function mergeStates(a, b) {
  const out = structuredClone(a)

  const levelFromB = b.level > a.level || (b.level === a.level && b.xp > a.xp)
  if (levelFromB) { out.level = b.level; out.xp = b.xp }

  if (laterStreak(b, a)) {
    out.streakDays = b.streakDays
    out.lastPlayedDate = b.lastPlayedDate
  }

  for (const key of ['setsPlayed', 'perfectSets', 'verticalSolved']) {
    out[key] = Math.max(a[key], b[key])
  }

  for (const c of CATEGORIES) {
    const solvedA = a.solvedByCategory[c] ?? 0
    const solvedB = b.solvedByCategory[c] ?? 0
    out.solvedByCategory[c] = Math.max(solvedA, solvedB)
    // 최근 성적과 난이도는 서로 맞물린 한 묶음이라 섞지 않고 더 많이 푼 쪽을 통째로 쓴다
    if (solvedB > solvedA) {
      out.recentByCategory[c] = structuredClone(b.recentByCategory[c])
      out.difficultyByCategory[c] = b.difficultyByCategory[c]
    }
    out.bestByCategory[c] = structuredClone(betterBest(a.bestByCategory[c], b.bestByCategory[c]))
  }

  out.badges = [...new Set([...a.badges, ...b.badges])].filter(id => id in BADGES)

  const byId = new Map()
  for (const e of [...a.reviewQueue, ...b.reviewQueue]) {
    const seen = byId.get(e.id)
    if (!seen || (e.streak ?? 0) < (seen.streak ?? 0)) byId.set(e.id, { ...e })
  }
  const queue = [...byId.values()]
  out.reviewQueue = queue.length > MAX_QUEUE ? queue.slice(queue.length - MAX_QUEUE) : queue

  out.reviewEverHad = a.reviewEverHad || b.reviewEverHad
  return out
}

/** b 의 연속 출석 묶음이 a 보다 최신인가 */
function laterStreak(b, a) {
  if (!b.lastPlayedDate) return false
  if (!a.lastPlayedDate) return true
  if (b.lastPlayedDate !== a.lastPlayedDate) return b.lastPlayedDate > a.lastPlayedDate
  return b.streakDays > a.streakDays
}

function betterBest(x, y) {
  if (!x) return y ?? null
  if (!y) return x
  if (y.correct !== x.correct) return y.correct > x.correct ? y : x
  return y.elapsedMs < x.elapsedMs ? y : x
}
