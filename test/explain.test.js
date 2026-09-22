import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildVertical, buildAnswerOnly } from '../src/core/vertical.js'
import { explanationSteps, renderExplain } from '../src/ui/screens/explain.js'

// jsdom 없이 renderExplain 이 쓰는 만큼만 흉내 낸다 — quizScreen.test.js 와
// 같은 방식(문자열 innerHTML 대입 + id 스캔 + addEventListener 흉내).
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

  querySelector(sel) {
    if (!sel.startsWith('#')) return null
    return this._children.get(sel.slice(1)) || null
  }

  addEventListener(type, fn, opts) {
    (this._listeners[type] ||= []).push({ fn, once: !!(opts && opts.once) })
  }

  removeEventListener(type, fn) {
    if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(l => l.fn !== fn)
  }

  click() {
    for (const l of (this._listeners.click || [])) l.fn()
    this._listeners.click = (this._listeners.click || []).filter(l => !l.once)
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

const keydownEvent = (key, extra = {}) =>
  ({ type: 'keydown', key, repeat: false, preventDefault() {}, ...extra })

describe('explanationSteps', () => {
  it('47 × 36 — 계산이 실제로 벌어지는 순서(자리가 작은 것부터)로 설명한다', () => {
    // vertical.js 의 cells 는 "입력 순서"(두 자리 수가 나오면 십의 자리를 먼저
    // 입력)라, 그 순서를 그대로 쓰면 "28의 십의 자리 2를 그대로 써요"가 "4×6=24,
    // 올린 4를 더하면 28이에요"보다 먼저 나오는 등 앞뒤가 바뀐다.
    // explanationSteps 는 이를 (row, col) 기준으로 다시 정렬해 바로잡는다.
    const v = buildVertical(47, 36)
    expect(explanationSteps(v)).toEqual([
      '7 × 6 = 42예요',
      '4 × 6 = 24, 올린 4를 더하면 28이에요',
      '28의 십의 자리 2를 그대로 써요',
      '7 × 3 = 21이에요',
      '4 × 3 = 12, 올린 2를 더하면 14예요',
      '14의 십의 자리 1을 그대로 써요',
      '2를 그대로 내려 써요',
      '8 + 1 = 9예요',
      '2 + 4 = 6이에요',
      '1을 그대로 내려 써요'
    ])
  })

  it('306 × 3 — 첫 계산(6×3=18)의 설명이 입력 순서가 아니라 계산 순서를 따른다', () => {
    const v = buildVertical(306, 3)
    // 입력 순서로는 올림칸(십의 자리)이 먼저지만, 설명은 "6×3=18이에요"가
    // 먼저 나와야 한다 — 그래야 "18의 십의 자리 1을 위에 올려 써요"가 뒤따를 때
    // 무엇의 십의 자리인지 아이가 알 수 있다.
    expect(explanationSteps(v)[0]).toBe('6 × 3 = 18이에요')
  })

  it('sum 줄은 항상 부분곱 줄들 뒤에 온다', () => {
    const v = buildVertical(87, 69)
    const steps = explanationSteps(v)
    const lastPartialIdx = v.cells
      .filter(c => c.kind === 'product')
      .reduce((max, c) => Math.max(max, steps.indexOf(c.hint)), -1)
    const firstSumIdx = steps.findIndex((_, i) =>
      v.sumCells.some(c => c.kind === 'sum' && c.hint === steps[i])
    )
    expect(firstSumIdx).toBeGreaterThan(lastPartialIdx)
  })

  it('구구단(답 한 칸)에서도 그대로 동작한다', () => {
    const v = buildAnswerOnly(7, 8)
    expect(explanationSteps(v)).toEqual(['7 × 8 = 56이에요'])
  })

  it('carry/sumCarry 칸의 힌트는 설명 목록에 나오지 않는다 — 격자에서 직접 보인다', () => {
    const v = buildVertical(99, 99)
    const steps = explanationSteps(v)
    const carryHints = v.cells
      .filter(c => c.kind === 'carry' || c.kind === 'sumCarry')
      .map(c => c.hint)
    for (const h of carryHints) expect(steps).not.toContain(h)
  })
})

describe('renderExplain — "다음 문제" 를 클릭 또는 엔터로', () => {
  let fakeWindow

  beforeEach(() => {
    fakeWindow = new FakeWindow()
    vi.stubGlobal('window', fakeWindow)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const setup = () => {
    const v = buildVertical(47, 3)
    const container = new FakeElement()
    const onNext = vi.fn()
    renderExplain(container, { id: '47x3', a: 47, b: 3 }, v, onNext)
    return { container, onNext }
  }

  it('엔터를 누르면 onNext 가 호출된다', () => {
    const { onNext } = setup()
    fakeWindow.dispatchEvent(keydownEvent('Enter'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('버튼을 클릭해도 여전히 onNext 가 호출된다(기존 동작 유지)', () => {
    const { container, onNext } = setup()
    container.querySelector('#next').click()
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('엔터 뒤에 버튼 클릭이 이어져도(포커스 상태에 따라 브라우저가 둘 다 낼 수 있다) onNext 는 한 번만 호출된다', () => {
    const { container, onNext } = setup()
    fakeWindow.dispatchEvent(keydownEvent('Enter'))
    container.querySelector('#next').click()
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('엔터를 두 번 눌러도 onNext 는 한 번만 호출된다', () => {
    const { onNext } = setup()
    fakeWindow.dispatchEvent(keydownEvent('Enter'))
    fakeWindow.dispatchEvent(keydownEvent('Enter'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('onNext 가 호출된 뒤에는 window 의 keydown 리스너가 정리된다 — 다음 화면에서 겹치지 않는다', () => {
    setup()
    expect(fakeWindow.keydownListenerCount).toBe(1)
    fakeWindow.dispatchEvent(keydownEvent('Enter'))
    expect(fakeWindow.keydownListenerCount).toBe(0)
  })

  it('키를 누르고 있어서 반복 이벤트(repeat)가 오면 무시한다', () => {
    const { onNext } = setup()
    fakeWindow.dispatchEvent(keydownEvent('Enter', { repeat: true }))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('⌘/Ctrl/Alt 와 함께 눌리면 무시한다', () => {
    const { onNext } = setup()
    fakeWindow.dispatchEvent(keydownEvent('Enter', { metaKey: true }))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('엔터가 아닌 다른 키는 무시한다', () => {
    const { onNext } = setup()
    fakeWindow.dispatchEvent(keydownEvent('a'))
    expect(onNext).not.toHaveBeenCalled()
  })
})
