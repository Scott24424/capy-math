import { renderGrid } from '../verticalGrid.js'

// 풀이 줄 그룹 순서: 부분곱 줄은 row(0,1,2,...) 오름차순, 덧셈 줄('sum')은 맨 뒤.
// ('answer' 는 구구단 전용이라 항상 칸이 하나뿐이라 이 비교가 실행될 일이 없다.)
// Infinity 대신 큰 유한수를 쓴다 — 'sum' 끼리 뺄셈하면 Infinity - Infinity = NaN 이 되어
// 비교 함수가 오작동할 수 있다(NaN !== 0 이라 아래 열 비교로 안 넘어간다).
const SUM_GROUP = 1_000_000
const groupOrder = (row) => (row === 'sum' ? SUM_GROUP : row)

/**
 * 풀이 화면에 나열할 설명 문장을, 아이가 읽기 자연스러운 순서로 뽑는다.
 *
 * vertical.js 의 cells 배열은 "입력 순서"(두 자리 수가 나오면 십의 자리를
 * 먼저 입력)를 나타내지만, 그 순서를 그대로 설명에 쓰면 "다 쓰세요"가
 * 그 계산을 하기도 전에 나오는 등 앞뒤가 바뀐다. 설명은 항상 계산이 실제로
 * 벌어지는 순서 — 같은 줄 안에서는 열(자리)이 작은 것부터 — 로 읽어야 하므로,
 * 입력 순서와 별개로 (row, col) 기준으로 다시 정렬한다.
 */
export function explanationSteps(layout) {
  return layout.cells
    .filter(c => c.kind === 'product' || c.kind === 'sum' || c.kind === 'answer')
    .slice()
    .sort((x, y) => {
      const g = groupOrder(x.row) - groupOrder(y.row)
      return g !== 0 ? g : x.col - y.col
    })
    .map(c => c.hint)
}

/**
 * 풀이 화면 — 틀린 문제가 끝났을 때만 그린다. 정답이면 이 화면을 거치지 않는다.
 * 여기에는 숫자판이 없다: 아이가 다시 입력할 칸이 없고, "다음 문제" 버튼(클릭
 * 또는 엔터)만 누른다.
 */
export function renderExplain(container, problem, layout, onNext) {
  const filled = Object.fromEntries(layout.cells.map(c => [c.id, c.value]))
  const steps = explanationSteps(layout)

  container.innerHTML = `
    <div class="explain">
      <h2 class="explain-title">같이 풀어볼까요?</h2>
      <div class="explain-grid" id="grid"></div>
      <ol class="explain-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <p class="explain-note">이 문제는 <b>복습 주머니</b>에 담아 뒀어요. 다음에 다시 만나요!</p>
      <button class="btn-primary" id="next">다음 문제</button>
    </div>`

  renderGrid(container.querySelector('#grid'), layout, { filled })

  // "다음 문제"는 클릭과 엔터 두 경로로 모두 갈 수 있다. 버튼에 포커스가 가
  // 있으면 브라우저가 엔터를 자기 click 으로도 바꿔줄 수 있어(포커스 상태에
  // 따라 달라짐), next() 를 한 번만 실행되게 감싸 어느 경로로 오든 정확히
  // onNext 가 한 번만 불리게 한다. 엔터 리스너는 window 에 붙인다 — 숫자판과
  // 같은 방식이라, 아이가 이 버튼에 포커스를 맞추지 않았어도 동작한다.
  let done = false
  const next = () => {
    if (done) return
    done = true
    window.removeEventListener('keydown', onKeydown)
    onNext()
  }

  const onKeydown = (e) => {
    if (e.repeat) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    next()
  }

  container.querySelector('#next').addEventListener('click', next, { once: true })
  window.addEventListener('keydown', onKeydown)
}
