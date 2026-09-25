import { describe, it, expect } from 'vitest'
import { mergeStates } from '../src/core/merge.js'
import { defaultState } from '../src/storage.js'
import { MAX_QUEUE } from '../src/core/review.js'

const st = (patch = {}) => ({ ...defaultState(), ...patch })

describe('mergeStates', () => {
  it('입력을 바꾸지 않는다', () => {
    const a = st({ badges: ['first-set'] })
    const b = st({ badges: ['streak-3'] })
    const snapA = structuredClone(a)
    const snapB = structuredClone(b)
    mergeStates(a, b)
    expect(a).toEqual(snapA)
    expect(b).toEqual(snapB)
  })

  it('레벨과 경험치는 한 묶음으로 더 높은 쪽', () => {
    expect(mergeStates(st({ level: 3, xp: 5 }), st({ level: 2, xp: 90 }))).toMatchObject({ level: 3, xp: 5 })
    expect(mergeStates(st({ level: 3, xp: 5 }), st({ level: 3, xp: 20 }))).toMatchObject({ level: 3, xp: 20 })
  })

  it('연속 출석은 날짜가 늦은 쪽, 같으면 더 긴 쪽', () => {
    const a = st({ streakDays: 9, lastPlayedDate: '2026-09-20' })
    const b = st({ streakDays: 2, lastPlayedDate: '2026-09-24' })
    expect(mergeStates(a, b)).toMatchObject({ streakDays: 2, lastPlayedDate: '2026-09-24' })
    const c = st({ streakDays: 5, lastPlayedDate: '2026-09-24' })
    expect(mergeStates(b, c)).toMatchObject({ streakDays: 5, lastPlayedDate: '2026-09-24' })
    expect(mergeStates(st(), a)).toMatchObject({ streakDays: 9, lastPlayedDate: '2026-09-20' })
  })

  it('카운터는 큰 값', () => {
    const m = mergeStates(
      st({ setsPlayed: 4, perfectSets: 0, verticalSolved: 30 }),
      st({ setsPlayed: 2, perfectSets: 1, verticalSolved: 10 })
    )
    expect(m).toMatchObject({ setsPlayed: 4, perfectSets: 1, verticalSolved: 30 })
  })

  it('카테고리별 푼 수는 각각 큰 값, 최근 성적·난이도는 더 많이 푼 쪽 것', () => {
    const a = st()
    a.solvedByCategory['times-table'] = 50
    a.recentByCategory['times-table'] = [true, true]
    a.difficultyByCategory['times-table'] = 'hard'
    const b = st()
    b.solvedByCategory['times-table'] = 10
    b.solvedByCategory['two-by-one'] = 20
    b.recentByCategory['two-by-one'] = [false]
    b.difficultyByCategory['two-by-one'] = 'normal'
    const m = mergeStates(a, b)
    expect(m.solvedByCategory['times-table']).toBe(50)
    expect(m.solvedByCategory['two-by-one']).toBe(20)
    expect(m.recentByCategory['times-table']).toEqual([true, true])
    expect(m.difficultyByCategory['times-table']).toBe('hard')
    expect(m.recentByCategory['two-by-one']).toEqual([false])
    expect(m.difficultyByCategory['two-by-one']).toBe('normal')
  })

  it('최고 기록은 정답이 많은 쪽, 같으면 빠른 쪽, 없으면 있는 쪽', () => {
    const a = st(); const b = st()
    a.bestByCategory['times-table'] = { correct: 9, elapsedMs: 50000 }
    b.bestByCategory['times-table'] = { correct: 9, elapsedMs: 40000 }
    a.bestByCategory['two-by-one'] = { correct: 10, elapsedMs: 90000 }
    b.bestByCategory['two-by-one'] = { correct: 8, elapsedMs: 10000 }
    b.bestByCategory['two-by-two'] = { correct: 5, elapsedMs: 1 }
    const m = mergeStates(a, b)
    expect(m.bestByCategory['times-table']).toEqual({ correct: 9, elapsedMs: 40000 })
    expect(m.bestByCategory['two-by-one']).toEqual({ correct: 10, elapsedMs: 90000 })
    expect(m.bestByCategory['two-by-two']).toEqual({ correct: 5, elapsedMs: 1 })
    expect(m.bestByCategory['three-by-one']).toBeNull()
  })

  it('배지는 합집합이고 모르는 id는 버린다', () => {
    const m = mergeStates(st({ badges: ['first-set', 'nope'] }), st({ badges: ['streak-3', 'first-set'] }))
    expect(m.badges.sort()).toEqual(['first-set', 'streak-3'])
  })

  it('복습 주머니는 id 합집합, 같은 id는 streak 작은 쪽, 최대 40개', () => {
    const e = (id, streak) => ({ id, category: 'times-table', a: 2, b: 3, streak })
    const m = mergeStates(st({ reviewQueue: [e('x', 1), e('y', 0)] }), st({ reviewQueue: [e('x', 0), e('z', 1)] }))
    expect(m.reviewQueue.map(q => [q.id, q.streak])).toEqual([['x', 0], ['y', 0], ['z', 1]])

    const many = (p) => Array.from({ length: 30 }, (_, i) => e(`${p}${i}`, 0))
    const big = mergeStates(st({ reviewQueue: many('a') }), st({ reviewQueue: many('b') }))
    expect(big.reviewQueue).toHaveLength(MAX_QUEUE)
    expect(big.reviewQueue.at(-1).id).toBe('b29')
  })

  it('reviewEverHad 는 OR', () => {
    expect(mergeStates(st({ reviewEverHad: true }), st()).reviewEverHad).toBe(true)
    expect(mergeStates(st(), st()).reviewEverHad).toBe(false)
  })

  it('교환법칙 — 순서를 바꿔도 결과가 같다(동률 제외 항목)', () => {
    const a = st({ level: 4, xp: 3, setsPlayed: 7, lastPlayedDate: '2026-09-01', streakDays: 1, badges: ['first-set'] })
    const b = st({ level: 2, xp: 30, setsPlayed: 9, lastPlayedDate: '2026-09-02', streakDays: 2, badges: ['streak-3'] })
    const ab = mergeStates(a, b); const ba = mergeStates(b, a)
    ab.badges.sort(); ba.badges.sort()
    expect(ab).toEqual(ba)
  })

  it('기본값끼리 합치면 기본값', () => {
    expect(mergeStates(defaultState(), defaultState())).toEqual(defaultState())
  })
})
