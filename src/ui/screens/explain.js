import { renderGrid } from '../verticalGrid.js'

/**
 * 풀이 화면 — 틀린 문제가 끝났을 때만 그린다. 정답이면 이 화면을 거치지 않는다.
 * 여기에는 숫자판이 없다: 아이가 다시 입력할 칸이 없고, "다음 문제" 버튼만 누른다.
 */
export function renderExplain(container, problem, layout, onNext) {
  const filled = Object.fromEntries(layout.cells.map(c => [c.id, c.value]))
  const steps = layout.cells
    .filter(c => c.kind === 'product' || c.kind === 'sum' || c.kind === 'answer')
    .map(c => c.hint)

  container.innerHTML = `
    <div class="explain">
      <h2 class="explain-title">같이 풀어볼까요?</h2>
      <div class="explain-grid" id="grid"></div>
      <ol class="explain-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <p class="explain-note">이 문제는 <b>복습 주머니</b>에 담아 뒀어요. 다음에 다시 만나요!</p>
      <button class="btn-primary" id="next">다음 문제</button>
    </div>`

  renderGrid(container.querySelector('#grid'), layout, { filled })
  container.querySelector('#next').addEventListener('click', onNext, { once: true })
}
