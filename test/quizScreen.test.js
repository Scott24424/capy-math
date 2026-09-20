import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderQuiz } from '../src/ui/screens/quiz.js'
import { createSession } from '../src/core/session.js'

// renderQuiz 는 매 호출마다 container.innerHTML 을 통째로 새로 쓰므로, #pad 도
// 매번 새 노드가 된다. keypad.js 내부의 WeakMap 방어는 "같은 노드에 두 번 붙는
// 것"만 막을 수 있어 이 경우엔 무력하다 — renderQuiz 스스로 이전 노드를 지워야
// 한다. Task 9 가 renderGrid 테스트에 쓴 것과 같은 문자열/스텁 DOM 방식을 쓴다
// (jsdom 없이 innerHTML 대입 + querySelector(#id) + addEventListener 만 흉내 낸다).
class FakeElement {
  constructor() {
    this._innerHTML = ''
    this._children = new Map()
    this._listeners = {}
    this.style = { setProperty() {} }
  }

  set innerHTML(html) {
    this._innerHTML = html
    this._children = new Map()
    const re = /id="([^"]+)"/g
    let m
    while ((m = re.exec(html))) this._children.set(m[1], new FakeElement())
  }

  get innerHTML() { return this._innerHTML }
  set textContent(v) { this._textContent = v }
  get textContent() { return this._textContent }

  querySelector(sel) {
    if (!sel.startsWith('#')) return null
    return this._children.get(sel.slice(1)) || null
  }

  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn) }
  removeEventListener(type, fn) {
    if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn)
  }
}

class FakeWindow {
  constructor() { this._listeners = {} }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn) }
  removeEventListener(type, fn) {
    if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn)
  }

  dispatchEvent(e) { for (const fn of (this._listeners[e.type] || [])) fn(e) }
  get keydownListenerCount() { return (this._listeners.keydown || []).length }
}

describe('renderQuiz 숫자판 mount/destroy', () => {
  let fakeWindow

  beforeEach(() => {
    fakeWindow = new FakeWindow()
    vi.stubGlobal('window', fakeWindow)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('같은 컨테이너에 두 번 그려도 살아있는 숫자판은 하나뿐이고, 키 입력도 한 번만 들어간다', () => {
    const problems = [{ id: '7x8', category: 'times-table', difficulty: 'normal', a: 7, b: 8 }]
    const session = createSession(problems)
    const container = new FakeElement()

    renderQuiz(container, session, { onProblemWrong: () => {}, onSetDone: () => {} })
    renderQuiz(container, session, { onProblemWrong: () => {}, onSetDone: () => {} }) // 이전 것을 안 지우고 또 그림

    expect(fakeWindow.keydownListenerCount).toBe(1)

    const event = { type: 'keydown', key: '5', preventDefault() {} }
    fakeWindow.dispatchEvent(event)

    // 구구단 답 칸은 여러 자리라 자동 채점되지 않고 typed 문자열에 그대로 쌓인다 —
    // 숫자판이 두 개 살아 있었다면 onDigit 이 두 번 불려 '55' 로 찍힌다.
    const grid = container.querySelector('#grid')
    expect(grid.innerHTML).toContain('>5<')
    expect(grid.innerHTML).not.toContain('>55<')
  })
})


describe('renderQuiz 같은 숫자 겹눌림 억제', () => {
  let fakeWindow
  let nowSpy
  let now

  beforeEach(() => {
    fakeWindow = new FakeWindow()
    vi.stubGlobal('window', fakeWindow)
    now = 1000
    nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    nowSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  // 11×11 은 첫 두 칸이 모두 숫자 1 이다 — 같은 숫자를 연달아 눌러야 하는
  // 문제라, 겹눌림 억제 로직이 진짜 입력을 삼키지 않는지 확인하기 좋다.
  const makeElevenSquaredSession = () =>
    createSession([{ id: '11x11', category: 'two-by-two', difficulty: 'normal', a: 11, b: 11 }])

  const pressOne = () => {
    const event = { type: 'keydown', key: '1', preventDefault() {} }
    fakeWindow.dispatchEvent(event)
  }

  it('같은 숫자를 30ms 안에 두 번 누르면 두 번째는 겹눌림으로 무시된다', () => {
    const session = makeElevenSquaredSession()
    const container = new FakeElement()
    renderQuiz(container, session, { onProblemWrong: () => {}, onSetDone: () => {} })

    pressOne()
    now += 30
    pressOne()

    expect(session.cellIndex).toBe(1)
  })

  it('같은 숫자를 200ms 간격으로 두 번 누르면 둘 다 아이가 낸 답으로 채점된다', () => {
    const session = makeElevenSquaredSession()
    const container = new FakeElement()
    renderQuiz(container, session, { onProblemWrong: () => {}, onSetDone: () => {} })

    pressOne()
    now += 200
    pressOne()

    expect(session.cellIndex).toBe(2)
  })
})
