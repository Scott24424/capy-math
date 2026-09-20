import { describe, it, expect } from 'vitest'
import { buildSet, finishSet } from '../src/app.js'
import { defaultState } from '../src/storage.js'
import { addWrong } from '../src/core/review.js'

describe('buildSet', () => {
  it('언제나 10문제를 만든다', () => {
    expect(buildSet(defaultState(), 'two-by-one')).toHaveLength(10)
  })

  it('한 세트 안에 같은 문제가 두 번 나오지 않는다', () => {
    for (let i = 0; i < 50; i++) {
      const set = buildSet(defaultState(), 'times-table')
      expect(new Set(set.map(p => p.id)).size).toBe(10)
    }
  })

  it('복습 주머니에서 최대 3문제까지만 섞는다', () => {
    let state = defaultState()
    for (let i = 0; i < 10; i++) {
      state.reviewQueue = addWrong(state.reviewQueue, {
        id: `${20 + i}x3`, category: 'two-by-one', a: 20 + i, b: 3
      })
    }
    const set = buildSet(state, 'two-by-one')
    expect(set.filter(p => p.isReview).length).toBeLessThanOrEqual(3)
    expect(set.filter(p => p.isReview).length).toBeGreaterThan(0)
  })

  it('복습 주머니가 비어 있으면 전부 새 문제다', () => {
    const set = buildSet(defaultState(), 'two-by-two')
    expect(set.every(p => !p.isReview)).toBe(true)
  })

  it('저장된 난이도로 문제를 낸다', () => {
    const state = defaultState()
    state.difficultyByCategory['two-by-one'] = 'hard'
    expect(buildSet(state, 'two-by-one').every(p => p.difficulty === 'hard')).toBe(true)
  })
})

describe('finishSet', () => {
  const tenCorrect = Array.from({ length: 10 }, (_, i) => ({
    problemId: `${20 + i}x3`, category: 'two-by-one', difficulty: 'normal',
    a: 20 + i, b: 3, correct: true, usedHint: false, isReview: false
  }))

  it('원래 상태를 바꾸지 않는다', () => {
    const before = defaultState()
    const snapshot = JSON.stringify(before)
    finishSet(before, tenCorrect, 100000)
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('경험치와 레벨이 오른다', () => {
    const { state, xpInfo } = finishSet(defaultState(), tenCorrect, 100000)
    expect(xpInfo.gained).toBe(10 * 5 + 5 + 10 + 2)   // 문제 50 + 완주 5 + 만점 10 + 첫 출석 2
    expect(state.level).toBeGreaterThan(1)
  })

  it('푼 문제 수와 최근 성적이 쌓인다', () => {
    const { state } = finishSet(defaultState(), tenCorrect, 100000)
    expect(state.solvedByCategory['two-by-one']).toBe(10)
    expect(state.recentByCategory['two-by-one']).toHaveLength(10)
  })

  it('최근 성적은 10개까지만 남는다', () => {
    let state = defaultState()
    for (let i = 0; i < 3; i++) state = finishSet(state, tenCorrect, 100000).state
    expect(state.recentByCategory['two-by-one']).toHaveLength(10)
  })

  it('정확도가 높으면 난이도가 올라간다', () => {
    const { state } = finishSet(defaultState(), tenCorrect, 100000)
    expect(state.difficultyByCategory['two-by-one']).toBe('normal')
  })

  it('틀린 문제는 복습 주머니로 간다', () => {
    const mixed = tenCorrect.map((r, i) => (i < 3 ? { ...r, correct: false } : r))
    const { state } = finishSet(defaultState(), mixed, 100000)
    expect(state.reviewQueue).toHaveLength(3)
    expect(state.reviewEverHad).toBe(true)
  })

  it('맞힌 복습 문제는 연속 기록이 오른다', () => {
    let state = defaultState()
    state.reviewQueue = addWrong(state.reviewQueue, { id: '20x3', category: 'two-by-one', a: 20, b: 3 })
    const results = tenCorrect.map((r, i) => (i === 0 ? { ...r, isReview: true } : r))
    const after = finishSet(state, results, 100000).state
    expect(after.reviewQueue[0].streak).toBe(1)
  })

  it('최고 기록을 더 나은 쪽으로 갱신한다', () => {
    let state = finishSet(defaultState(), tenCorrect, 200000).state
    expect(state.bestByCategory['two-by-one'].elapsedMs).toBe(200000)
    state = finishSet(state, tenCorrect, 150000).state
    expect(state.bestByCategory['two-by-one'].elapsedMs).toBe(150000)
    state = finishSet(state, tenCorrect, 300000).state
    expect(state.bestByCategory['two-by-one'].elapsedMs).toBe(150000)
  })

  it('새로 얻은 배지를 알려준다', () => {
    const { xpInfo } = finishSet(defaultState(), tenCorrect, 100000)
    expect(xpInfo.newBadges.length).toBeGreaterThan(0)
  })
})
