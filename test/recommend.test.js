import { describe, it, expect } from 'vitest'
import { recommendCategory } from '../src/core/recommend.js'
import { defaultState } from '../src/storage.js'
import { CATEGORIES } from '../src/core/problem.js'

describe('recommendCategory', () => {
  it('아직 아무것도 안 했으면 구구단부터 권한다', () => {
    expect(recommendCategory(defaultState())).toBe('times-table')
  })

  it('복습할 게 있으면 그 문제가 속한 카테고리를 권한다', () => {
    const s = defaultState()
    s.solvedByCategory['times-table'] = 200
    s.reviewQueue = [{ id: '47x3', category: 'two-by-one', a: 47, b: 3, streak: 0 }]
    expect(recommendCategory(s)).toBe('two-by-one')
  })

  it('복습이 없으면 정확도가 가장 낮은 곳을 권한다', () => {
    const s = defaultState()
    for (const c of CATEGORIES) {
      s.solvedByCategory[c] = 50
      s.recentByCategory[c] = Array(10).fill(true)
    }
    s.recentByCategory['three-by-one'] = [true, false, false, false, false, false, false, false, false, false]
    expect(recommendCategory(s)).toBe('three-by-one')
  })

  it('한 번도 안 해본 카테고리가 있으면 그곳을 먼저 권한다', () => {
    const s = defaultState()
    s.solvedByCategory['times-table'] = 100
    s.recentByCategory['times-table'] = Array(10).fill(true)
    expect(recommendCategory(s)).toBe('two-by-one')
  })

  it('언제나 실제 카테고리 하나를 돌려준다', () => {
    expect(CATEGORIES).toContain(recommendCategory(defaultState()))
  })
})
