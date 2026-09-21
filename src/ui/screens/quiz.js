import { currentCell, submit, sessionResults, elapsedMs } from '../../core/session.js'
import { renderGrid } from '../verticalGrid.js'
import { createKeypad, destroyKeypad } from '../keypad.js'
import { CATEGORY_LABELS } from '../../core/problem.js'

/**
 * 문제 화면을 그린다.
 * handlers.onProblemWrong(problem, layout, resume) — 틀린 문제가 끝났을 때.
 *   풀이 화면이 container 를 덮어쓰므로, resume() 은 이 화면을 통째로 다시 그린다.
 * handlers.onSetDone(results, elapsedMs) — 10문제를 다 풀었을 때.
 * session 에 진행 상태가 들어 있어, 다시 불러도 이어서 그린다.
 */
export function renderQuiz(container, session, handlers) {
  const { onProblemWrong, onSetDone, onExit } = handlers
  let typed = ''
  let wrongId = null
  let message = ''
  let wrongTimer = null
  let lastKey = null
  let lastKeyAt = 0

  // container.innerHTML 을 새로 쓰기 전에, 지금 그 자리에 붙어 있을 수 있는
  // (이전 renderQuiz 호출이 남긴) 숫자판부터 지운다. #pad 는 매번 새로 만들어지는
  // 노드라 keypad.js 내부의 WeakMap 방어만으로는 이 경우를 막지 못한다.
  destroyKeypad(container.querySelector ? container.querySelector('#pad') : null)

  container.innerHTML = `
    <div class="quiz">
      <div class="quiz-exit-row">
        <button class="btn-ghost quiz-exit" id="exit">집으로</button>
      </div>
      <div class="quiz-progress" id="progress"></div>
      <div class="quiz-title" id="title"></div>
      <div class="quiz-message" id="message"></div>
      <div class="quiz-board">
        <div class="quiz-grid" id="grid"></div>
        <div id="pad"></div>
      </div>
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
    // 화면이 이미 다른 화면(풀이 화면 등)으로 바뀌었다면 그릴 자리가 없다 —
    // 늦게 도착한 setTimeout 콜백 등이 여기로 들어와도 조용히 넘어간다.
    const titleEl = container.querySelector('#title')
    if (!titleEl) return

    const layout = session.layouts[session.index]
    const cell = currentCell(session)

    titleEl.textContent =
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

  // key 는 자동 채점되는 한 자리 칸(carry/product 등)에서 방금 눌린 숫자다.
  // 태블릿에서 손가락이 겹눌려 같은 버튼이 아주 짧은 간격으로 두 번 눌리면,
  // 첫 입력이 이미 다음 칸으로 넘어간 뒤라 두 번째 입력이 그 다음 칸의
  // 오답으로 채점된다.
  // 다만 아이가 같은 숫자가 연속으로 필요한 칸(예: 11×11의 첫 두 칸)을 진짜로
  // 빠르게 두 번 눌렀을 수도 있다 — 그 입력을 지우면 그 답은 아무 흔적도 없이
  // 사라지고, 아이는 프로그램이 고장났다고 느낀다. 겹눌림은 몇십 ms 안에 오지만
  // 사람이 의도를 갖고 같은 숫자를 다시 누르는 데는 150ms 이상 걸리므로,
  // 창을 짧게(60ms) 잡아 "받아주는 쪽"으로 기운다 — 겹눌림을 못 거르는 것보다
  // 진짜 입력을 삼키는 게 훨씬 나쁘다.
  const commit = (key) => {
    if (key !== undefined) {
      const now = Date.now()
      if (key === lastKey && now - lastKeyAt < 60) {
        typed = ''
        return
      }
      lastKey = key
      lastKeyAt = now
    }

    const problemIndex = session.index
    const cellId = currentCell(session)?.id ?? null

    const verdict = submit(session, typed)
    typed = ''
    message = verdict.message
    // 두 번째 오답이면 정답이 그 칸에 그대로 채워지므로(reveal), 그 칸을 오답
    // 스타일(빨간 테두리)로 표시하지 않는다 — 지금 보여주는 건 정답이다.
    wrongId = (!verdict.correct && !verdict.reveal) ? cellId : null

    clearTimeout(wrongTimer)
    wrongTimer = null
    if (wrongId) {
      wrongTimer = setTimeout(() => { wrongTimer = null; wrongId = null; paint() }, 400)
    }

    if (verdict.setDone) {
      clearTimeout(wrongTimer)
      wrongTimer = null
      pad.destroy()
      onSetDone(results(), elapsedMs(session))
      return
    }

    if (verdict.problemDone && session.problemState[problemIndex].wrong) {
      clearTimeout(wrongTimer)
      wrongTimer = null
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
        commit(d)
      }
    },
    onBackspace: () => { typed = typed.slice(0, -1); paint() },
    onEnter: () => { if (typed !== '') commit() }
  })

  let pad = mountKeypad()
  paint()

  // "집으로" — 아이가 세트를 끝까지 안 풀고 나가고 싶을 때의 유일한 출구.
  // 지금 풀던 문제(완주 못 함)는 빼고, 이미 끝낸 문제까지만 넘긴다.
  container.querySelector('#exit').addEventListener('click', () => {
    clearTimeout(wrongTimer)
    wrongTimer = null
    pad.destroy()
    onExit(sessionResults(session, { completedOnly: true }), elapsedMs(session))
  })

  return {
    destroy() {
      clearTimeout(wrongTimer)
      wrongTimer = null
      // 세트가 이미 끝났다면 onSetDone 쪽에서 이 container 에 다른 화면을 그렸을
      // 수 있다 — 그 화면을 지우면 안 되므로 아무 것도 하지 않는다.
      if (session.done) return
      pad.destroy()
      container.innerHTML = ''
    }
  }
}
