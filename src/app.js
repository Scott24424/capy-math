import { generateProblem, adjustDifficulty, CATEGORIES } from './core/problem.js'
import { addWrong, recordReviewResult, pickForSet } from './core/review.js'
import { problemXp, setBonus, applyXp, updateStreak, earnedBadges } from './core/progress.js'
import { summarize } from './core/grading.js'
import { createSession } from './core/session.js'
import { loadState, saveState } from './storage.js'
import { renderHome } from './ui/screens/home.js'
import { renderQuiz } from './ui/screens/quiz.js'
import { renderExplain } from './ui/screens/explain.js'
import { renderResult } from './ui/screens/result.js'
import { renderRecords } from './ui/screens/records.js'

export const SET_SIZE = 10
export const MAX_REVIEW_PER_SET = 3

// 아이의 하루는 기기의 현지 날짜다. new Date().toISOString() 은 UTC라
// KST(+9)에서는 자정이 아니라 09:00에 날짜가 바뀌어, 그 사이 시간대에 두 번
// 플레이하면 연속 출석이 하루에 두 번 오르거나 하루를 건너뛴 것처럼 보인다.
// toLocaleDateString('sv') 는 'YYYY-MM-DD' 를 현지 달력 기준으로 준다.
export const today = () => new Date().toLocaleDateString('sv')

export function buildSet(state, category, rng = Math.random) {
  const difficulty = state.difficultyByCategory[category]
  const fromReview = pickForSet(
    state.reviewQueue.filter(e => e.category === category),
    MAX_REVIEW_PER_SET,
    rng
  ).map(p => ({ ...p, difficulty }))

  const set = [...fromReview]
  const seen = new Set(set.map(p => p.id))
  let guard = 0

  while (set.length < SET_SIZE && guard++ < 500) {
    const p = generateProblem(category, difficulty, rng)
    if (seen.has(p.id)) continue
    seen.add(p.id)
    set.push(p)
  }
  // 조건이 좁아 10개를 못 채우는 극단적 경우에도 반드시 10개를 돌려준다
  while (set.length < SET_SIZE) {
    const p = generateProblem(category, 'normal', rng)
    if (!seen.has(p.id)) { seen.add(p.id); set.push(p) }
  }

  return set.sort(() => rng() - 0.5)
}

export function finishSet(prevState, results, elapsedMs) {
  const state = structuredClone(prevState)
  const summary = summarize(results, elapsedMs)
  const category = results[0]?.category

  // "틀린 문제 다시보기" 세트는 문제 수가 1~9개로 들쭉날쭉하다 — 10문제짜리
  // 정식 세트인 척 최고 기록/만점 보너스/최근 성적에 끼워 넣으면 안 된다.
  // 그 세트의 모든 문제가 isReview 라는 것으로 판별한다(정식 세트는 복습
  // 문제가 최대 3개까지만 섞이므로 절대 전부가 isReview 일 수 없다).
  const isReplaySet = results.length > 0 && results.every(r => r.isReview)

  const streak = updateStreak(
    { streakDays: state.streakDays, lastPlayedDate: state.lastPlayedDate },
    today()
  )
  state.streakDays = streak.streakDays
  state.lastPlayedDate = streak.lastPlayedDate

  let gained = results.reduce((sum, r) => sum + (r.correct
    ? problemXp({
        category: r.category, difficulty: r.difficulty,
        isReview: r.isReview, usedHint: r.usedHint
      })
    : 0), 0)
  gained += setBonus({
    allCorrect: !isReplaySet && summary.allCorrect,
    streakDays: state.streakDays
  })

  const fromLevel = state.level
  const applied = applyXp({ level: state.level, xp: state.xp }, gained)
  state.level = applied.level
  state.xp = applied.xp

  state.setsPlayed += 1
  if (!isReplaySet && summary.allCorrect) state.perfectSets += 1
  if (category && category !== 'times-table') {
    state.verticalSolved += results.filter(r => r.correct).length
  }

  for (const r of results) {
    state.solvedByCategory[r.category] = (state.solvedByCategory[r.category] || 0) + 1
    if (!isReplaySet) {
      const recent = [...(state.recentByCategory[r.category] || []), r.correct]
      state.recentByCategory[r.category] = recent.slice(-10)
    }

    if (r.isReview) {
      state.reviewQueue = recordReviewResult(state.reviewQueue, r.problemId, r.correct)
    }
    if (!r.correct) {
      state.reviewQueue = addWrong(state.reviewQueue, {
        id: r.problemId, category: r.category, a: r.a, b: r.b
      })
      state.reviewEverHad = true
    }
  }

  for (const c of CATEGORIES) {
    state.difficultyByCategory[c] =
      adjustDifficulty(state.difficultyByCategory[c], state.recentByCategory[c] || [])
  }

  const best = state.bestByCategory[category]
  const isBest = !isReplaySet && category && (!best ||
    summary.correct > best.correct ||
    (summary.correct === best.correct && elapsedMs < best.elapsedMs))
  if (isBest) state.bestByCategory[category] = { correct: summary.correct, elapsedMs }

  // 배지는 절대 되찾아가지 않는다: streak-* 는 연속 기록이 끊기면, review-cleared 는
  // 새로 틀린 문제가 생기면 earnedBadges()가 "지금은" 사실이 아니라고 말하지만,
  // 이미 얻은 것은 아이의 영구 기록이다. 합집합으로만 쌓는다.
  const before = new Set(state.badges)
  const all = earnedBadges(state)
  const newBadges = all.filter(id => !before.has(id))
  state.badges = [...new Set([...before, ...all])]

  return {
    state,
    summary: { ...summary, best: isBest },
    xpInfo: { gained, fromLevel, leveledUp: applied.leveledUp, newBadges }
  }
}

export function startApp(container) {
  let state = loadState()
  let lastCategory = null
  let lastWrong = []

  const persist = () => { saveState(state) }

  const goHome = () => {
    renderHome(container, state, {
      onStart: (category) => startSet(category),
      onRecords: () => renderRecords(container, state, { onBack: goHome })
    })
  }

  const startSet = (category, problems = null) => {
    lastCategory = category
    const session = createSession(problems || buildSet(state, category))

    renderQuiz(container, session, {
      onProblemWrong: (problem, layout, resume) => {
        renderExplain(container, problem, layout, resume)
      },
      onSetDone: (results, elapsedMs) => {
        lastWrong = results.filter(r => !r.correct)
        const outcome = finishSet(state, results, elapsedMs)
        state = outcome.state
        persist()
        renderResult(container, outcome.summary, outcome.xpInfo, state, {
          onAgain: () => startSet(lastCategory),
          onReview: () => startSet(lastCategory, lastWrong.map(r => ({
            id: r.problemId, category: r.category, difficulty: r.difficulty,
            a: r.a, b: r.b, isReview: true
          }))),
          onHome: goHome
        })
      }
    })
  }

  goHome()
}
