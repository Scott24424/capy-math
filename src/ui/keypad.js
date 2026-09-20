const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓']

export function createKeypad(container, { onDigit, onBackspace, onEnter }) {
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
    if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault() }
    else if (e.key === 'Backspace') { press('←'); e.preventDefault() }
    else if (e.key === 'Enter') { press('✓'); e.preventDefault() }
  }

  container.addEventListener('click', onClick)
  window.addEventListener('keydown', onKeydown)

  return {
    destroy() {
      container.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeydown)
      container.innerHTML = ''
    }
  }
}
