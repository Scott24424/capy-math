import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildSet, finishSet, today } from '../src/app.js'
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

  it('배지는 조건을 잃어도 되찾아가지 않는다 (연속 출석이 끊겨도 streak 배지는 남는다)', () => {
    // 7일 연속을 만든다
    let state = defaultState()
    for (let i = 0; i < 7; i++) {
      state.streakDays = i + 1
      state = finishSet(state, tenCorrect, 100000).state
    }
    expect(state.badges).toContain('streak-3')
    expect(state.badges).toContain('streak-7')

    // 5일을 건너뛴 것처럼 연속 기록을 리셋한다 (updateStreak 의 gap>1 경로와 같은 효과)
    state.streakDays = 1

    const after = finishSet(state, tenCorrect, 100000)
    expect(after.state.badges).toContain('streak-3')
    expect(after.state.badges).toContain('streak-7')
    // 이미 갖고 있던 배지를 다시 "새 배지"로 알리면 안 된다
    expect(after.xpInfo.newBadges).not.toContain('streak-3')
    expect(after.xpInfo.newBadges).not.toContain('streak-7')
  })

  it('review-cleared 배지도 새로 틀린 문제가 생겨도 사라지지 않는다', () => {
    let state = defaultState()
    // 틀렸다가 복습에서 맞혀 복습 주머니를 비운다
    const wrongThenReview = tenCorrect.map((r, i) => (i === 0 ? { ...r, correct: false } : r))
    state = finishSet(state, wrongThenReview, 100000).state
    // 복습 문제는 REQUIRED_STREAK(2)번 연속으로 맞혀야 주머니에서 빠진다
    const clearReview = [{ ...tenCorrect[0], isReview: true, correct: true }]
    state = finishSet(state, clearReview, 5000).state
    state = finishSet(state, clearReview, 5000).state
    expect(state.reviewQueue).toHaveLength(0)
    expect(state.badges).toContain('review-cleared')

    // 새로 하나 틀린다 — earnedBadges() 는 지금 이 순간 review-cleared 가 거짓이라고 하겠지만
    // 이미 얻은 배지는 남아 있어야 한다
    const newWrong = tenCorrect.map((r, i) => (i === 0 ? { ...r, correct: false } : r))
    const after = finishSet(state, newWrong, 100000)
    expect(after.state.badges).toContain('review-cleared')
    expect(after.xpInfo.newBadges).not.toContain('review-cleared')
  })

  it('틀린 문제 다시보기(복습 전용) 세트는 최고 기록/만점 보너스/최근 성적을 건드리지 않는다', () => {
    // 3/10으로 시작해 7문제가 복습 주머니에 들어간다
    const threeCorrect = tenCorrect.map((r, i) => (i < 3 ? r : { ...r, correct: false }))
    let state = finishSet(defaultState(), threeCorrect, 100000).state
    const before = structuredClone(state)

    // 복습 세트: 7문제, 전부 isReview: true, 전부 맞힘
    const replayResults = state.reviewQueue.map(e => ({
      problemId: e.id, category: e.category, difficulty: 'normal',
      a: e.a, b: e.b, correct: true, usedHint: false, isReview: true
    }))
    expect(replayResults.length).toBe(7)

    const outcome = finishSet(state, replayResults, 9000)
    const after = outcome.state

    // 최고 기록에 7/10 이 절대 새겨지지 않는다
    expect(after.bestByCategory['two-by-one']).toEqual(before.bestByCategory['two-by-one'])
    expect(outcome.summary.best).toBe(false)

    // 만점 보너스/배지가 붙지 않는다
    expect(after.perfectSets).toBe(before.perfectSets)
    expect(outcome.xpInfo.newBadges).not.toContain('first-perfect')

    // 최근 성적(자동 난이도 조정용)에 반영되지 않는다
    expect(after.recentByCategory['two-by-one']).toEqual(before.recentByCategory['two-by-one'])
    expect(after.difficultyByCategory['two-by-one']).toBe(before.difficultyByCategory['two-by-one'])

    // 그래도 경험치는 주고(복습 1.5배 포함), 복습 주머니 기록은 갱신된다
    // (REQUIRED_STREAK=2 라 한 번 맞혀서는 아직 빠지지 않고 streak 만 오른다)
    expect(outcome.xpInfo.gained).toBeGreaterThan(0)
    expect(after.reviewQueue).toHaveLength(7)
    expect(after.reviewQueue.every(e => e.streak === 1)).toBe(true)
  })
})

describe('today (현지 날짜)', () => {
  afterEach(() => vi.useRealTimers())

  // 이 헬퍼는 테스트가 도는 기기의 시간대가 무엇이든(KST 든 UTC 든) 그 기기의
  // Date 로컬 게터(getFullYear/getMonth/getDate)로 기대값을 계산한다 — 특정
  // 시간대를 가정하지 않으므로 어느 기기에서 돌려도 같은 결론이 나온다.
  const localYmd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const utcYmd = (d) => d.toISOString().slice(0, 10)

  it('오늘의 로컬 달력 날짜를 돌려준다', () => {
    expect(today()).toBe(localYmd(new Date()))
  })

  it('UTC 날짜와 로컬 날짜가 갈라지는 순간에는 로컬 쪽을 따른다', () => {
    // 이 시각의 UTC 날짜와 로컬 날짜가 이 기기에서 다르면(자정 언저리),
    // today() 는 UTC 가 아니라 로컬을 골라야 한다는 것을 확인한다.
    // 두 값이 같은 기기라도(예: 이 러너가 UTC 기준) 최소한 today() 가
    // toISOString 이 아니라 로컬 게터와 일치한다는 사실은 항상 검증된다.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T23:30:00Z'))
    const now = new Date()
    expect(today()).toBe(localYmd(now))
    if (localYmd(now) !== utcYmd(now)) {
      expect(today()).not.toBe(utcYmd(now))
    }
  })
})
