const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓']

// 컨테이너 하나에 숫자판이 두 번 붙는 것을 막는다 — 예전 인스턴스가 남아 있으면
// 키 입력이 두 번 들어가서(예: 다음 칸까지 밀려 채워짐) 아이가 치지 않은
// 오답으로 채점될 수 있다.
const instances = new WeakMap()

export function createKeypad(container, { onDigit, onBackspace, onEnter }) {
  const previous = instances.get(container)
  if (previous) previous.destroy()

  container.innerHTML =
    `<div class="keypad">${KEYS.map(k => `<button type="button" data-key="${k}">${k}</button>`).join('')}</div>`

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
      container.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeydown)
      container.innerHTML = ''
      if (instances.get(container) === api) instances.delete(container)
    }
  }

  instances.set(container, api)
  return api
}
