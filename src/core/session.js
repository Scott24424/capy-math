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
    if (String(input).trim() !== '') session.attempts++
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
