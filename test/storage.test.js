import { describe, it, expect } from 'vitest'
import {
  defaultState, loadState, saveState, STORAGE_KEY, SCHEMA_VERSION,
  buildExport, parseImport, EXPORT_KIND
} from '../src/storage.js'
import { CATEGORIES } from '../src/core/problem.js'
import { buildSet, finishSet } from '../src/app.js'

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

  // Important 3: 필드 하나가 이상해도 앱이 영영 고장 나면 안 된다 — 그 필드만
  // 기본값으로 되돌리고, buildSet/finishSet 이 예외 없이 계속 돌아가야 한다.
  describe('필드별 손상 방어', () => {
    const runsFine = (state) => {
      expect(() => {
        const set = buildSet(state, 'two-by-one')
        const results = set.map(p => ({
          problemId: p.id, category: p.category, difficulty: p.difficulty,
          a: p.a, b: p.b, correct: true, usedHint: false, isReview: p.isReview === true
        }))
        finishSet(state, results, 10000)
      }).not.toThrow()
    }

    it('reviewQueue 가 숫자면 빈 배열로 되돌리고 계속 돌아간다', () => {
      const store = { getItem: () => JSON.stringify({ version: SCHEMA_VERSION, reviewQueue: 42 }) }
      const s = loadState(store)
      expect(Array.isArray(s.reviewQueue)).toBe(true)
      expect(s.reviewQueue).toEqual([])
      runsFine(s)
    })

    it('reviewQueue 가 문자열이면 빈 배열로 되돌린다', () => {
      const store = { getItem: () => JSON.stringify({ version: SCHEMA_VERSION, reviewQueue: 'x' }) }
      const s = loadState(store)
      expect(s.reviewQueue).toEqual([])
      runsFine(s)
    })

    it('reviewQueue 의 항목 하나가 null 이면 그 항목만 버린다', () => {
      const store = {
        getItem: () => JSON.stringify({
          version: SCHEMA_VERSION,
          reviewQueue: [null, { id: '20x3', category: 'two-by-one', a: 20, b: 3, streak: 0 }]
        })
      }
      const s = loadState(store)
      expect(s.reviewQueue).toHaveLength(1)
      expect(s.reviewQueue[0].id).toBe('20x3')
      runsFine(s)
    })

    it('difficultyByCategory 값이 목록에 없으면 기본값 easy 로 되돌린다', () => {
      const store = {
        getItem: () => JSON.stringify({
          version: SCHEMA_VERSION,
          difficultyByCategory: { 'times-table': 'medium' }
        })
      }
      const s = loadState(store)
      expect(s.difficultyByCategory['times-table']).toBe('easy')
      runsFine(s)
    })

    it('level 이 숫자가 아니면 기본값 1로 되돌려, 다시 레벨을 올릴 수 있다', () => {
      const store = { getItem: () => JSON.stringify({ version: SCHEMA_VERSION, level: 'x' }) }
      const s = loadState(store)
      expect(s.level).toBe(1)
      runsFine(s)
    })

    it('xp 가 문자열이면 기본값 0으로 되돌린다', () => {
      const store = { getItem: () => JSON.stringify({ version: SCHEMA_VERSION, xp: 'x' }) }
      const s = loadState(store)
      expect(s.xp).toBe(0)
      runsFine(s)
    })

    it('bestByCategory 값이 이상한 모양이면 그 카테고리만 null 로 되돌린다', () => {
      const store = {
        getItem: () => JSON.stringify({
          version: SCHEMA_VERSION,
          bestByCategory: { 'two-by-one': 'x' }
        })
      }
      const s = loadState(store)
      expect(s.bestByCategory['two-by-one']).toBeNull()
      runsFine(s)
    })

    it('recentByCategory 값이 배열이 아니면 기본값(빈 배열)으로 되돌린다', () => {
      const store = {
        getItem: () => JSON.stringify({
          version: SCHEMA_VERSION,
          recentByCategory: { 'two-by-one': 'x' }
        })
      }
      const s = loadState(store)
      expect(s.recentByCategory['two-by-one']).toEqual([])
      runsFine(s)
    })
  })
})

describe('진도 내보내기 / 불러오기', () => {
  /** 몇 판 플레이해 여러 필드가 채워진 실제 상태 하나를 만든다 */
  const populatedState = () => {
    let state = { ...defaultState(), level: 12, xp: 340, streakDays: 5, lastPlayedDate: '2026-09-20' }
    const set = buildSet(state, 'two-by-one')
    const results = set.map((p, i) => ({
      problemId: p.id, category: p.category, difficulty: p.difficulty,
      a: p.a, b: p.b, correct: i !== 0, usedHint: i === 1, isReview: p.isReview === true
    }))
    state = finishSet(state, results, 45000).state
    return state
  }

  it('내보낸 봉투는 kind 와 schemaVersion 을 담는다', () => {
    const envelope = buildExport(defaultState())
    expect(envelope.kind).toBe(EXPORT_KIND)
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof envelope.exportedAt).toBe('string')
  })

  it('실제로 채워진 상태를 내보내고 불러오면 완전히 같은 상태가 된다', () => {
    const state = populatedState()
    const envelope = buildExport(state)
    const result = parseImport(envelope)
    expect(result.ok).toBe(true)
    expect(result.state).toEqual(state)
  })

  it('봉투는 JSON.stringify/parse 를 그대로 통과한다', () => {
    const state = populatedState()
    const envelope = buildExport(state)
    const roundTripped = JSON.parse(JSON.stringify(envelope))
    expect(roundTripped).toEqual(envelope)

    const result = parseImport(roundTripped)
    expect(result.ok).toBe(true)
    expect(result.state).toEqual(state)
  })

  it('JSON 이 아닌 값(원시 타입)은 거부하고 이유를 알려준다', () => {
    for (const bad of [null, undefined, 42, '문자열', true, []]) {
      const result = parseImport(bad)
      expect(result.ok).toBe(false)
      expect(typeof result.reason).toBe('string')
    }
  })

  it('이 앱이 만든 봉투가 아니면(kind 불일치) 거부한다', () => {
    const state = populatedState()
    const notOurs = { schemaVersion: SCHEMA_VERSION, state, exportedAt: 'x' }
    const result = parseImport(notOurs)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong-kind')
  })

  it('스키마 버전이 다르면(더 오래됐든 새것이든) 거부한다', () => {
    const state = populatedState()
    for (const schemaVersion of [SCHEMA_VERSION - 1, SCHEMA_VERSION + 1, 999]) {
      const result = parseImport({ kind: EXPORT_KIND, schemaVersion, exportedAt: 'x', state })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('wrong-version')
    }
  })

  it('봉투 자체는 맞는데 안의 state 가 깨져 있으면(버전 없음) 거부한다', () => {
    const envelope = { kind: EXPORT_KIND, schemaVersion: SCHEMA_VERSION, exportedAt: 'x', state: { level: 30 } }
    const result = parseImport(envelope)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid-state')
  })

  it('state 안 필드 하나가 깨져 있어도 loadState 와 같은 방식으로 그 필드만 복구되고, 던지지 않는다', () => {
    // test/storage.test.js 위쪽의 "필드별 손상 방어"와 같은 손상 케이스를 재사용한다.
    const corruptCases = [
      { reviewQueue: 42 },
      { reviewQueue: 'x' },
      { reviewQueue: [null, { id: '20x3', category: 'two-by-one', a: 20, b: 3, streak: 0 }] },
      { difficultyByCategory: { 'times-table': 'medium' } },
      { level: 'x' },
      { xp: 'x' },
      { bestByCategory: { 'two-by-one': 'x' } },
      { recentByCategory: { 'two-by-one': 'x' } }
    ]
    for (const corruption of corruptCases) {
      const state = { ...defaultState(), ...corruption }
      const envelope = { kind: EXPORT_KIND, schemaVersion: SCHEMA_VERSION, exportedAt: 'x', state }
      let result
      expect(() => { result = parseImport(envelope) }).not.toThrow()
      expect(result.ok).toBe(true)
      // 같은 손상을 loadState 에 흘려보낸 결과와 동일해야 한다(같은 검증을 공유)
      const viaLoad = loadState({ getItem: () => JSON.stringify({ version: SCHEMA_VERSION, ...corruption }) })
      expect(result.state).toEqual(viaLoad)
    }
  })

  it('실패해도 원래 상태를 바꾸지 않는다(순수 함수 — 인자를 변형하지 않는다)', () => {
    const state = populatedState()
    const before = structuredClone(state)
    parseImport({ kind: 'not-ours', schemaVersion: SCHEMA_VERSION, state })
    expect(state).toEqual(before)
  })
})
