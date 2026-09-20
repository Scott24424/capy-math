import { describe, it, expect } from 'vitest'
import { buildLayout } from '../src/core/vertical.js'
import { gridModel } from '../src/ui/verticalGrid.js'

const layoutOf = (category, a, b) => buildLayout({ category, a, b })

describe('gridModel', () => {
  it('47 × 36 격자의 줄 구성', () => {
    const m = gridModel(layoutOf('two-by-two', 47, 36))
    expect(m.rows.map(r => r.type)).toEqual([
      'carry',     // 올림수 줄
      'operandA',  //   4 7
      'operandB',  // × 3 6
      'line',      // ────
      'partial',   //   2 8 2
      'partial',   // 1 4 1 _
      'line',      // ────
      'sumCarry',  // 덧셈 올림수 줄
      'sum'        // 1 6 9 2
    ])
    expect(m.width).toBe(4)
  })

  it('두 번째 부분곱의 일의 자리는 빈칸이다', () => {
    const m = gridModel(layoutOf('two-by-two', 47, 36))
    const second = m.rows.filter(r => r.type === 'partial')[1]
    expect(second.cells[0]).toBeNull()
    expect(second.cells[1].cellId).toBe('p1-c1')
  })

  it('한 자리 수를 곱할 때는 덧셈 줄이 없다', () => {
    const m = gridModel(layoutOf('two-by-one', 47, 3))
    expect(m.rows.map(r => r.type)).not.toContain('sum')
    expect(m.rows.filter(r => r.type === 'partial')).toHaveLength(1)
  })

  it('구구단은 격자 대신 답 한 칸이다', () => {
    const m = gridModel(layoutOf('times-table', 7, 8))
    expect(m.rows.map(r => r.type)).toEqual(['equation'])
    expect(m.rows[0].cells[0].cellId).toBe('answer')
  })

  it('피연산자 줄에는 문제의 숫자가 자리에 맞게 들어간다', () => {
    const m = gridModel(layoutOf('two-by-two', 47, 36))
    const a = m.rows.find(r => r.type === 'operandA')
    expect(a.cells.map(c => c && c.text)).toEqual(['7', '4', null, null])
  })
})
