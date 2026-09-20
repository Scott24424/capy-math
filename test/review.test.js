import { describe, it, expect } from 'vitest'
import {
  addWrong, recordReviewResult, pickForSet, MAX_QUEUE, REQUIRED_STREAK
} from '../src/core/review.js'

const problem = (a, b, category = 'two-by-one') => ({ id: `${a}x${b}`, category, a, b })

describe('addWrong', () => {
  it('틀린 문제를 주머니에 넣는다', () => {
    const q = addWrong([], problem(47, 3))
    expect(q).toEqual([{ id: '47x3', category: 'two-by-one', a: 47, b: 3, streak: 0 }])
  })

  it('원래 배열을 바꾸지 않는다', () => {
    const before = []
    addWrong(before, problem(47, 3))
    expect(before).toEqual([])
  })

  it('이미 있는 문제를 또 틀리면 연속 기록만 0으로 되돌린다', () => {
    let q = addWrong([], problem(47, 3))
    q = recordReviewResult(q, '47x3', true)
    expect(q[0].streak).toBe(1)
    q = addWrong(q, problem(47, 3))
    expect(q).toHaveLength(1)
    expect(q[0].streak).toBe(0)
  })

  // Review Focus 5: 계속 틀려도 주머니가 무한히 커지지 않는다
  it('주머니에는 상한이 있고, 넘치면 가장 오래된 것부터 빠진다', () => {
    let q = []
    for (let i = 0; i < MAX_QUEUE + 15; i++) q = addWrong(q, problem(10 + i, 3))
    expect(q).toHaveLength(MAX_QUEUE)
    expect(q[0].id).toBe(`${10 + 15}x3`)   // 앞의 15개가 밀려났다
  })
})

describe('recordReviewResult', () => {
  it('한 번 맞히면 아직 주머니에 남는다', () => {
    let q = addWrong([], problem(47, 3))
    q = recordReviewResult(q, '47x3', true)
    expect(q).toHaveLength(1)
    expect(q[0].streak).toBe(1)
  })

  it('두 번 연속 맞히면 주머니에서 나간다', () => {
    let q = addWrong([], problem(47, 3))
    q = recordReviewResult(q, '47x3', true)
    q = recordReviewResult(q, '47x3', true)
    expect(q).toHaveLength(0)
  })

  it('중간에 틀리면 연속 기록이 0으로 돌아간다', () => {
    let q = addWrong([], problem(47, 3))
    q = recordReviewResult(q, '47x3', true)
    q = recordReviewResult(q, '47x3', false)
    expect(q[0].streak).toBe(0)
  })

  it('필요한 연속 정답 수는 2다', () => {
    expect(REQUIRED_STREAK).toBe(2)
  })

  it('주머니에 없는 문제는 그냥 무시한다', () => {
    const q = recordReviewResult([], '99x9', true)
    expect(q).toEqual([])
  })
})

describe('pickForSet', () => {
  it('요청한 개수만큼 뽑는다', () => {
    let q = []
    for (let i = 0; i < 10; i++) q = addWrong(q, problem(20 + i, 3))
    expect(pickForSet(q, 3, () => 0)).toHaveLength(3)
  })

  it('주머니가 모자라면 있는 만큼만 뽑는다', () => {
    const q = addWrong([], problem(47, 3))
    expect(pickForSet(q, 3, () => 0)).toHaveLength(1)
  })

  it('빈 주머니에서는 빈 배열을 준다', () => {
    expect(pickForSet([], 3, () => 0)).toEqual([])
  })

  it('같은 문제를 두 번 뽑지 않는다', () => {
    let q = []
    for (let i = 0; i < 5; i++) q = addWrong(q, problem(20 + i, 3))
    const picked = pickForSet(q, 5, Math.random)
    expect(new Set(picked.map(p => p.id)).size).toBe(5)
  })

  it('뽑힌 문제에는 복습 표시가 붙는다', () => {
    const q = addWrong([], problem(47, 3))
    expect(pickForSet(q, 1, () => 0)[0].isReview).toBe(true)
  })
})
