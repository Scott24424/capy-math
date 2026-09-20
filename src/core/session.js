import { buildLayout } from './vertical.js'
import { judgeCell } from './grading.js'

// judgeCell 이 빈 입력(빈 문자열/null/undefined/NaN/숫자 아닌 문자열)에 항상
// 돌려주는 고정 문장이다(grading.test.js 가 이 문장으로 고정해 둔다) — attemptsSoFar
// 와 무관하게 항상 같은 값이므로, 입력 문자열을 여기서 다시 숫자인지 파싱하지
// 않고도 judgeCell 의 판정 결과(verdict)만 보고 "정말 숫자를 눌렀는지"를 가릴 수 있다.
const BLANK_MESSAGE = '숫자를 눌러 보세요'

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
    if (verdict.message !== BLANK_MESSAGE) session.attempts++
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

export function sessionResults(session) {
  return session.problems.map((p, i) => ({
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
