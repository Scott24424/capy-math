import { buildLayout } from './vertical.js'
import { judgeCell } from './grading.js'

export function createSession(problems) {
  return {
    problems,
    layouts: problems.map(buildLayout),
    index: 0,
    cellIndex: 0,
    attempts: 0,
    filled: {},
    problemState: problems.map(() => ({ wrong: false, usedHint: false })),
    startedAt: Date.now(),
    done: false
  }
}

export function currentCell(session) {
  if (session.done) return null
  const layout = session.layouts[session.index]
  if (!layout) return null
  return layout.cells[session.cellIndex] || null
}

export function submit(session, input) {
  const cell = currentCell(session)
  if (!cell) return { correct: false, reveal: false, message: '', problemDone: false, setDone: true }

  const verdict = judgeCell(cell, input, session.attempts)

  if (!verdict.correct && !verdict.reveal) {
    if (!verdict.blank) session.attempts++
    return { ...verdict, problemDone: false, setDone: false }
  }

  const state = session.problemState[session.index]
  if (!verdict.correct) {
    state.wrong = true
    state.usedHint = true
  } else if (session.attempts > 0) {
    state.wrong = true
  }

  session.filled[cell.id] = cell.value
  session.attempts = 0
  session.cellIndex++

  const layout = session.layouts[session.index]
  const problemDone = session.cellIndex >= layout.cells.length

  if (problemDone) {
    session.index++
    session.cellIndex = 0
    session.filled = {}
    if (session.index >= session.problems.length) session.done = true
  }

  return { ...verdict, problemDone, setDone: session.done }
}

// completedOnly: true 면 아직 끝나지 않은 문제(지금 풀고 있거나 손도 안 댄
// 문제)는 빼고, 실제로 칸을 다 채운 문제까지만 돌려준다. session.index 는
// 문제 하나가 끝날 때만 올라가므로(session.js 의 submit 참고) 이 경계가
// "완주한 문제 수"와 정확히 같다. 세트를 다 풀었을 때(session.done)는
// session.index === problems.length 라 이 옵션이 있든 없든 결과가 같다 —
// 기존 onSetDone 호출부는 손대지 않아도 된다.
export function sessionResults(session, { completedOnly = false } = {}) {
  const n = completedOnly ? session.index : session.problems.length
  return session.problems.slice(0, n).map((p, i) => ({
    problemId: p.id,
    category: p.category,
    difficulty: p.difficulty,
    a: p.a,
    b: p.b,
    isReview: p.isReview === true,
    correct: !session.problemState[i].wrong,
    usedHint: session.problemState[i].usedHint
  }))
}

export const elapsedMs = (session) => Date.now() - session.startedAt
