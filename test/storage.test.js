import { describe, it, expect } from 'vitest'
import { defaultState, loadState, saveState, STORAGE_KEY, SCHEMA_VERSION } from '../src/storage.js'
import { CATEGORIES } from '../src/core/problem.js'

/** 진짜 localStorage 처럼 동작하는 가짜 저장소 */
const fakeStore = (initial = {}) => {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
    removeItem: (k) => { delete data[k] },
    _data: data
  }
}

const throwingStore = () => ({
  getItem: () => { throw new DOMException('blocked', 'SecurityError') },
  setItem: () => { throw new DOMException('blocked', 'SecurityError') },
  removeItem: () => { throw new DOMException('blocked', 'SecurityError') }
})

describe('defaultState', () => {
  it('레벨 1, 경험치 0으로 시작한다', () => {
    const s = defaultState()
    expect(s.level).toBe(1)
    expect(s.xp).toBe(0)
    expect(s.version).toBe(SCHEMA_VERSION)
  })

  it('카테고리마다 난이도가 쉬움으로 준비된다', () => {
    const s = defaultState()
    for (const c of CATEGORIES) {
      expect(s.difficultyByCategory[c]).toBe('easy')
      expect(s.recentByCategory[c]).toEqual([])
      expect(s.solvedByCategory[c]).toBe(0)
      expect(s.bestByCategory[c]).toBeNull()
    }
  })
})

describe('saveState / loadState', () => {
  it('저장한 것을 그대로 읽는다', () => {
    const store = fakeStore()
    const s = { ...defaultState(), level: 7, xp: 30 }
    expect(saveState(s, store)).toBe(true)
    expect(loadState(store).level).toBe(7)
  })

  it('저장된 것이 없으면 기본 상태를 준다', () => {
    expect(loadState(fakeStore()).level).toBe(1)
  })

  it('열쇠 이름은 capy-math-v1 이다', () => {
    const store = fakeStore()
    saveState(defaultState(), store)
    expect(Object.keys(store._data)).toEqual([STORAGE_KEY])
  })

  it('저장된 값이 깨진 JSON 이면 조용히 새로 시작한다', () => {
    const store = fakeStore({ [STORAGE_KEY]: '{이건 JSON 이 아니야' })
    expect(() => loadState(store)).not.toThrow()
    expect(loadState(store).level).toBe(1)
  })

  it('저장된 값이 객체가 아니면 새로 시작한다', () => {
    const store = fakeStore({ [STORAGE_KEY]: '"문자열"' })
    expect(loadState(store).level).toBe(1)
  })

  it('버전이 다르면 새로 시작한다', () => {
    const store = fakeStore({ [STORAGE_KEY]: JSON.stringify({ version: 99, level: 30 }) })
    expect(loadState(store).level).toBe(1)
  })

  it('일부 항목이 빠져 있으면 기본값으로 채운다', () => {
    const store = fakeStore({
      [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, level: 12 })
    })
    const s = loadState(store)
    expect(s.level).toBe(12)
    expect(s.reviewQueue).toEqual([])
    for (const c of CATEGORIES) expect(s.difficultyByCategory[c]).toBe('easy')
  })

  // Review Focus 1: 저장 자체가 막혀 있어도 앱은 돌아가야 한다
  it('저장소 접근이 예외를 던져도 읽기가 터지지 않는다', () => {
    expect(() => loadState(throwingStore())).not.toThrow()
    expect(loadState(throwingStore()).level).toBe(1)
  })

  it('저장소 접근이 예외를 던져도 쓰기가 터지지 않고 false 를 준다', () => {
    expect(saveState(defaultState(), throwingStore())).toBe(false)
  })

  it('저장소가 아예 없어도(undefined) 터지지 않는다', () => {
    expect(() => loadState(undefined)).not.toThrow()
    expect(saveState(defaultState(), undefined)).toBe(false)
  })
})
