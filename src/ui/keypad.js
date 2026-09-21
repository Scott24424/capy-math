const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓']

// 지우기(←)/확인(✓) 은 글자가 아니라 컨트롤이다 — 글꼴마다 다르게 그려지는 문자
// 대신 항상 같은 모양으로 보이는 인라인 SVG를 쓴다. data-key 값("←"/"✓")은
// 키보드 핸들러·테스트가 그대로 참조하므로 절대 바꾸지 않는다 — 버튼 안에
// 그려지는 것만 바꾼다.
const ICONS = {
  '←': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7 3 12l6 5"/><path d="M3 12h12a5 5 0 0 0 0-10h-1"/></svg>',
  '✓': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"/></svg>'
}
const LABELS = { '←': '지우기', '✓': '확인' }

// 컨테이너 하나에 숫자판이 두 번 붙는 것을 막는다 — 예전 인스턴스가 남아 있으면
// 키 입력이 두 번 들어가서(예: 다음 칸까지 밀려 채워짐) 아이가 치지 않은
// 오답으로 채점될 수 있다.
const instances = new WeakMap()

export function createKeypad(container, { onDigit, onBackspace, onEnter }) {
  const previous = instances.get(container)
  if (previous) previous.destroy()

  container.innerHTML =
    `<div class="keypad">${KEYS.map(k =>
      `<button type="button" data-key="${k}"${LABELS[k] ? ` aria-label="${LABELS[k]}"` : ''}>${ICONS[k] ?? k}</button>`
    ).join('')}</div>`

  const press = (key) => {
    if (key === '←') onBackspace()
    else if (key === '✓') onEnter()
    else onDigit(key)
  }

  const onClick = (e) => {
    const button = e.target.closest('button[data-key]')
    if (button) press(button.dataset.key)
  }

  const onKeydown = (e) => {
    if (e.repeat) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault() }
    else if (e.key === 'Backspace') { press('←'); e.preventDefault() }
    else if (e.key === 'Enter') { press('✓'); e.preventDefault() }
  }

  container.addEventListener('click', onClick)
  window.addEventListener('keydown', onKeydown)

  const api = {
    destroy() {
      // 이 인스턴스가 더 이상 container 의 현재 숫자판이 아니면(예: 새 숫자판이
      // 이미 그 위에 붙었는데 낡은 참조로 뒤늦게 destroy 가 불렸다면) 아무 것도
      // 하지 않는다 — 그렇지 않으면 살아 있는 숫자판의 버튼만 지워지고 리스너는
      // 그대로 남아, 키보드는 되는데 클릭만 죽는 상태가 된다.
      if (instances.get(container) !== api) return
      container.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeydown)
      container.innerHTML = ''
      instances.delete(container)
    }
  }

  instances.set(container, api)
  return api
}

// container 가 붙잡고 있던 숫자판이 있으면 지운다. WeakMap 은 createKeypad 에
// 넘긴 노드(대개 #pad)로 키를 잡으므로, 그 노드 자체가 매번 새로 만들어지는
// 화면(예: renderQuiz 가 매번 container.innerHTML 을 통째로 새로 쓰는 경우)에서는
// createKeypad 내부의 "이전 것을 지운다" 방어가 전혀 작동하지 않는다 — 항상
// "본 적 없는" 새 노드로만 호출되기 때문이다. 그런 화면은 innerHTML 을 새로
// 쓰기 전에, 지금 붙어 있는 노드를 이걸로 먼저 지워야 한다.
export function destroyKeypad(node) {
  const api = instances.get(node)
  if (api) api.destroy()
}
