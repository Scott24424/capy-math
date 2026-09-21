import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createKeypad } from '../src/ui/keypad.js'

// 테스트는 jsdom 없이 돈다. keypad.js 가 쓰는 만큼만 EventTarget 으로 흉내 낸다:
// window 는 keydown 리스너를 붙일 대상, container 는 innerHTML 대입과
// click 리스너를 받을 대상이면 충분하다.
describe('createKeypad', () => {
  let fakeWindow

  beforeEach(() => {
    fakeWindow = new EventTarget()
    vi.stubGlobal('window', fakeWindow)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('같은 컨테이너에 두 번 붙여도 keydown 은 한 번만 처리된다', () => {
    const container = Object.assign(new EventTarget(), { innerHTML: '' })
    const onDigit = vi.fn()

    createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() })
    createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() }) // 이전 것을 안 지우고 또 붙임

    const event = new Event('keydown')
    event.key = '5'
    fakeWindow.dispatchEvent(event)

    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith('5')
  })

  it('⌘/Ctrl/Alt 가 눌려 있으면 숫자 키를 무시한다', () => {
    const container = Object.assign(new EventTarget(), { innerHTML: '' })
    const onDigit = vi.fn()
    createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() })

    const event = new Event('keydown')
    event.key = '1'
    event.metaKey = true
    fakeWindow.dispatchEvent(event)

    expect(onDigit).not.toHaveBeenCalled()
  })

  it('destroy 이후에는 두 번째 인스턴스와 무관하게 keydown 이 한 번만 처리된다', () => {
    const container = Object.assign(new EventTarget(), { innerHTML: '' })
    const onDigit = vi.fn()

    const first = createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() })
    first.destroy()
    createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() })

    const event = new Event('keydown')
    event.key = '9'
    fakeWindow.dispatchEvent(event)

    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith('9')
  })

  it('새 숫자판이 붙은 뒤 예전 인스턴스의 destroy 를 불러도 살아있는 숫자판은 멀쩡하다', () => {
    const container = Object.assign(new EventTarget(), { innerHTML: '' })
    const onDigit = vi.fn()

    const first = createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() })
    // createKeypad 자체가 이미 first 를 지우고 새로 붙이지만, 여기서는 그 뒤에도
    // "이전 인스턴스를 들고 있던 낡은 참조"가 늦게 destroy 를 부르는 상황을 재현한다.
    createKeypad(container, { onDigit, onBackspace: vi.fn(), onEnter: vi.fn() })

    first.destroy()

    expect(container.innerHTML).not.toBe('')

    const event = new Event('keydown')
    event.key = '7'
    fakeWindow.dispatchEvent(event)

    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith('7')
  })
})
