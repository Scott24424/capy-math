import { currentCell, submit, sessionResults, elapsedMs } from '../../core/session.js'
import { renderGrid } from '../verticalGrid.js'
import { createKeypad } from '../keypad.js'
import { CATEGORY_LABELS } from '../../core/problem.js'

/**
 * 문제 화면을 그린다.
 * handlers.onProblemWrong(problem, layout, resume) — 틀린 문제가 끝났을 때.
 *   풀이 화면이 container 를 덮어쓰므로, resume() 은 이 화면을 통째로 다시 그린다.
 * handlers.onSetDone(results, elapsedMs) — 10문제를 다 풀었을 때.
 * session 에 진행 상태가 들어 있어, 다시 불러도 이어서 그린다.
 */
export function renderQuiz(container, session, handlers) {
  const { onProblemWrong, onSetDone } = handlers
  let typed = ''
  let wrongId = null
  let message = ''

  container.innerHTML = `
    <div class="quiz">
      <div class="quiz-progress" id="progress"></div>
      <div class="quiz-title" id="title"></div>
      <div class="quiz-grid" id="grid"></div>
      <div class="quiz-message" id="message"></div>
      <div id="pad"></div>
    </div>`

  const results = () => sessionResults(session)

  const paintProgress = () => {
    const marks = session.problems.map((_, i) => {
      if (i > session.index) return 'todo'
      if (i === session.index) return 'now'
      return session.problemState[i].wrong ? 'bad' : 'ok'
    })
    container.querySelector('#progress').innerHTML =
      marks.map(m => `<span class="mark ${m}"></span>`).join('')
  }

  const paint = () => {
    const problem = session.problems[session.index]
    if (!problem) return
    const layout = session.layouts[session.index]
    const cell = currentCell(session)

    container.querySelector('#title').textContent =
      `${CATEGORY_LABELS[problem.category]} · ${session.index + 1} / ${session.problems.length}`

    const filled = { ...session.filled }
    if (cell && typed !== '') filled[cell.id] = typed

    renderGrid(container.querySelector('#grid'), layout, {
      filled,
      activeId: cell ? cell.id : null,
      wrongId
    })
    container.querySelector('#message').textContent = message
    paintProgress()
  }

  const commit = () => {
    const problemIndex = session.index
    const cellId = currentCell(session)?.id ?? null

    const verdict = submit(session, typed)
    typed = ''
    message = verdict.message
    wrongId = verdict.correct ? null : cellId

    if (!verdict.correct) {
      setTimeout(() => { wrongId = null; paint() }, 400)
    }

    if (verdict.setDone) {
      pad.destroy()
      onSetDone(results(), elapsedMs(session))
      return
    }

    if (verdict.problemDone && session.problemState[problemIndex].wrong) {
      pad.destroy()
      onProblemWrong(
        session.problems[problemIndex],
        session.layouts[problemIndex],
        () => renderQuiz(container, session, handlers)   // 풀이 화면이 덮어썼으니 다시 그린다
      )
      return
    }

    paint()
  }

  const mountKeypad = () => createKeypad(container.querySelector('#pad'), {
    onDigit: (d) => {
      const cell = currentCell(session)
      if (!cell) return
      // 구구단 답 칸만 여러 자리, 나머지는 한 자리 누르면 바로 채점
      if (cell.kind === 'answer') {
        typed = (typed + d).slice(0, 4)
        paint()
      } else {
        typed = d
        commit()
      }
    },
    onBackspace: () => { typed = typed.slice(0, -1); paint() },
    onEnter: () => { if (typed !== '') commit() }
  })

  let pad = mountKeypad()
  paint()

  return { destroy() { pad.destroy(); container.innerHTML = '' } }
}
