import { describe, it, expect } from 'vitest'
import {
  CATEGORIES, DIFFICULTIES, CATEGORY_LABELS,
  generateProblem, adjustDifficulty, countCarries
} from '../src/core/problem.js'

/** 0, 0.5, 0.99 를 돌아가며 내놓는 가짜 난수 */
const cyclingRng = (values) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('countCarries', () => {
  it('올림 횟수를 센다', () => {
    expect(countCarries(23, 3)).toBe(0)   // 9, 6
    expect(countCarries(47, 3)).toBe(2)   // 7x3=21(올림), 4x3+2=14(올림)
    expect(countCarries(78, 9)).toBe(2)
    expect(countCarries(897, 8)).toBe(3)
  })
})

describe('generateProblem — 모든 조합이 규칙을 지킨다', () => {
  for (const category of CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      it(`${category} / ${difficulty} — 200번 뽑아도 규칙을 벗어나지 않는다`, () => {
        for (let i = 0; i < 200; i++) {
          const p = generateProblem(category, difficulty)
          expect(p.category).toBe(category)
          expect(p.id).toBe(`${p.a}x${p.b}`)

          if (category === 'times-table') {
            expect(p.a).toBeGreaterThanOrEqual(2)
            expect(p.a).toBeLessThanOrEqual(9)
            expect(p.b).toBeGreaterThanOrEqual(2)
            expect(p.b).toBeLessThanOrEqual(9)
            if (difficulty === 'hard') {
              expect([p.a, p.b].some(n => n >= 6 && n <= 8)).toBe(true)
            }
          }

          if (category === 'two-by-one') {
            expect(p.a).toBeGreaterThanOrEqual(10)
            expect(p.a).toBeLessThanOrEqual(99)
            expect(p.b).toBeGreaterThanOrEqual(2)
            expect(p.b).toBeLessThanOrEqual(9)
            const carries = countCarries(p.a, p.b)
            if (difficulty === 'easy') expect(carries).toBe(0)
            if (difficulty === 'normal') expect(carries).toBe(1)
            if (difficulty === 'hard') expect(carries === 2 || p.a % 10 === 0).toBe(true)
          }

          if (category === 'three-by-one') {
            expect(p.a).toBeGreaterThanOrEqual(100)
            expect(p.a).toBeLessThanOrEqual(999)
            const carries = countCarries(p.a, p.b)
            if (difficulty === 'easy') expect(carries).toBe(1)
            if (difficulty === 'normal') expect(carries).toBe(2)
            if (difficulty === 'hard') {
              const middleZero = Math.floor(p.a / 10) % 10 === 0
              expect(carries === 3 || middleZero).toBe(true)
            }
          }

          if (category === 'two-by-two') {
            expect(p.a).toBeGreaterThanOrEqual(10)
            expect(p.a).toBeLessThanOrEqual(99)
            expect(p.b).toBeGreaterThanOrEqual(10)
            expect(p.b).toBeLessThanOrEqual(99)
            // RT2-2: b의 일의 자리가 0이면 첫 부분곱이 전부 0이 되어
            // 세로셈의 의미가 사라지므로, 모든 난이도에서 제외한다
            expect(p.b % 10).not.toBe(0)
            if (difficulty === 'easy') {
              expect(p.b).toBeGreaterThanOrEqual(11)
              expect(p.b).toBeLessThanOrEqual(13)
            }
            if (difficulty === 'hard') {
              expect(countCarries(p.a, p.b % 10)).toBeGreaterThan(0)
              expect(countCarries(p.a, Math.floor(p.b / 10))).toBeGreaterThan(0)
            }
          }
        }
      })
    }
  }

  it('난수를 주입하면 결과가 정해진다', () => {
    const rng = cyclingRng([0, 0, 0, 0])
    const first = generateProblem('two-by-one', 'easy', rng)
    const second = generateProblem('two-by-one', 'easy', cyclingRng([0, 0, 0, 0]))
    expect(first).toEqual(second)
  })

  // Review Focus 4: 조건을 못 찾아도 무한 루프에 빠지지 않는다
  it('조건에 맞는 수를 못 찾아도 반드시 문제를 돌려준다', () => {
    const alwaysZero = () => 0    // 항상 같은 후보만 뽑는 최악의 난수
    const p = generateProblem('two-by-two', 'hard', alwaysZero)
    expect(p.a).toBeGreaterThanOrEqual(10)
    expect(p.b).toBeGreaterThanOrEqual(10)
    expect(Number.isInteger(p.a * p.b)).toBe(true)
  })

  it('카테고리마다 한국어 이름이 있다', () => {
    for (const c of CATEGORIES) {
      expect(typeof CATEGORY_LABELS[c]).toBe('string')
      expect(CATEGORY_LABELS[c].length).toBeGreaterThan(0)
    }
  })
})

describe('adjustDifficulty', () => {
  const ten = (n) => Array.from({ length: 10 }, (_, i) => i < n)

  it('정확도 90% 이상이면 한 단계 올린다', () => {
    expect(adjustDifficulty('easy', ten(9))).toBe('normal')
    expect(adjustDifficulty('normal', ten(10))).toBe('hard')
  })

  it('어려움에서는 더 올라가지 않는다', () => {
    expect(adjustDifficulty('hard', ten(10))).toBe('hard')
  })

  it('정확도 60% 미만이면 한 단계 내린다', () => {
    expect(adjustDifficulty('hard', ten(5))).toBe('normal')
    expect(adjustDifficulty('normal', ten(0))).toBe('easy')
  })

  it('쉬움에서는 더 내려가지 않는다', () => {
    expect(adjustDifficulty('easy', ten(0))).toBe('easy')
  })

  it('그 사이면 그대로 둔다', () => {
    expect(adjustDifficulty('normal', ten(7))).toBe('normal')
  })

  it('문제를 10개 미만으로 풀었으면 아직 바꾸지 않는다', () => {
    expect(adjustDifficulty('easy', [true, true, true])).toBe('easy')
  })
})
