import { describe, it, expect } from 'vitest'
import { buildVertical, buildAnswerOnly, buildLayout } from '../src/core/vertical.js'

const at = (cells, kind, row, col) =>
  cells.find(c => c.kind === kind && c.row === row && c.col === col)

describe('buildVertical', () => {
  it('47 × 36 은 입력 칸이 12개다', () => {
    const v = buildVertical(47, 36)
    expect(v.cells).toHaveLength(12)
    expect(v.product).toBe(1692)
  })

  it('47 × 36 의 칸 순서는 공책에 쓰는 순서와 같다', () => {
    const v = buildVertical(47, 36)
    expect(v.cells.map(c => [c.kind, c.row, c.col, c.value])).toEqual([
      ['product', 0, 0, 2],   // 7×6=42 → 2를 쓰고
      ['carry',   0, 1, 4],   //          4를 올린다
      ['product', 0, 1, 8],   // 4×6=24+4=28 → 8
      ['product', 0, 2, 2],   //               2
      ['product', 1, 1, 1],   // 7×3=21 → 1 (한 자리 왼쪽으로 밀림)
      ['carry',   1, 2, 2],   //          2를 올린다
      ['product', 1, 2, 4],   // 4×3=12+2=14 → 4
      ['product', 1, 3, 1],   //               1
      ['sum', 'sum', 0, 2],   // 282 + 1410 = 1692
      ['sum', 'sum', 1, 9],
      ['sum', 'sum', 2, 6],
      ['sum', 'sum', 3, 1]
    ])
  })

  it('한 자리 수를 곱할 때는 덧셈 줄이 없다', () => {
    const v = buildVertical(47, 3)
    expect(v.partials).toHaveLength(1)
    expect(v.sumCells).toHaveLength(0)
    expect(v.cells.map(c => [c.kind, c.col, c.value])).toEqual([
      ['product', 0, 1],  // 7×3=21 → 1
      ['carry',   1, 2],  //          2 올림
      ['product', 1, 4],  // 4×3=12+2=14 → 4
      ['product', 2, 1]   //               1
    ])
  })

  it('40 × 6 — 일의 자리가 0이면 0도 써야 한다', () => {
    const v = buildVertical(40, 6)
    expect(v.product).toBe(240)
    expect(at(v.cells, 'product', 0, 0).value).toBe(0)
    expect(v.cells).toHaveLength(3)
  })

  it('405 × 7 — 가운데 0 자리에서도 올림이 이어진다', () => {
    const v = buildVertical(405, 7)
    expect(v.product).toBe(2835)
    expect(at(v.cells, 'product', 0, 0).value).toBe(5)
    expect(at(v.cells, 'carry',   0, 1).value).toBe(3)
    expect(at(v.cells, 'product', 0, 1).value).toBe(3)  // 0×7=0, 올린 3
    expect(at(v.cells, 'product', 0, 2).value).toBe(8)
    expect(at(v.cells, 'product', 0, 3).value).toBe(2)
  })

  it('99 × 99 — 덧셈에서도 올림이 생긴다', () => {
    const v = buildVertical(99, 99)
    expect(v.product).toBe(9801)
    expect(v.partials[0].value).toBe(891)
    expect(v.partials[1].value).toBe(8910)
    expect(at(v.cells, 'sumCarry', 'sum', 2).value).toBe(1)
    expect(at(v.cells, 'sumCarry', 'sum', 3).value).toBe(1)
    expect(v.sumCells.filter(c => c.kind === 'sum').map(c => c.value)).toEqual([1, 0, 8, 9])
  })

  it('87 × 69 — 두 부분곱 모두 올림이 있다', () => {
    const v = buildVertical(87, 69)
    expect(v.product).toBe(6003)
    expect(v.partials.map(p => p.value)).toEqual([783, 5220])
  })

  it('10 × 10 — 부분곱이 0이어도 칸을 만든다', () => {
    const v = buildVertical(10, 10)
    expect(v.product).toBe(100)
    expect(v.partials[0].value).toBe(0)
    expect(at(v.cells, 'product', 0, 0).value).toBe(0)
    expect(at(v.cells, 'product', 0, 1).value).toBe(0)
  })

  it('모든 칸에 아이가 읽을 힌트 문구가 있고, 조사가 문법에 맞는다', () => {
    // 모음 받침 없는 수(2,4,5,9로 끝남) 바로 뒤에 '이에요'나 '을'이 붙으면 틀린 문법이다.
    // (올바르면 '예요'나 '를'이 붙는다.)
    const wrongParticle = /[0-9]*[2459](이에요|을)/
    for (const [a, b] of [[47, 36], [99, 99], [405, 7], [10, 10], [40, 6], [87, 69], [23, 40]]) {
      const v = buildVertical(a, b)
      for (const c of v.cells) {
        expect(typeof c.hint).toBe('string')
        expect(c.hint.length).toBeGreaterThan(0)
        expect(c.hint).not.toMatch(wrongParticle)
      }
    }
  })

  it('칸 id 는 서로 겹치지 않는다', () => {
    for (const [a, b] of [[47, 36], [99, 99], [405, 7], [10, 10], [40, 6]]) {
      const ids = buildVertical(a, b).cells.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('23 × 40 — b가 0으로 끝나면 첫 부분곱은 0인 칸 두 개다', () => {
    const v = buildVertical(23, 40)
    expect(v.product).toBe(920)
    expect(v.partials[0].value).toBe(0)
    expect(at(v.cells, 'product', 0, 0).value).toBe(0)
    expect(at(v.cells, 'product', 0, 1).value).toBe(0)
  })
})

describe('buildAnswerOnly', () => {
  it('구구단은 답 한 칸이고 값은 곱 전체다', () => {
    const v = buildAnswerOnly(7, 8)
    expect(v.mode).toBe('answer')
    expect(v.cells).toHaveLength(1)
    expect(v.cells[0].value).toBe(56)
  })
})

describe('buildLayout', () => {
  it('구구단은 답 한 칸, 나머지는 세로셈이다', () => {
    const times = buildLayout({ category: 'times-table', a: 7, b: 8 })
    expect(times.mode).toBe('answer')
    expect(times.product).toBe(56)

    const twoByOne = buildLayout({ category: 'two-by-one', a: 47, b: 3 })
    expect(twoByOne.mode).toBe('vertical')
    expect(twoByOne.product).toBe(141)

    const twoByTwo = buildLayout({ category: 'two-by-two', a: 47, b: 36 })
    expect(twoByTwo.mode).toBe('vertical')
    expect(twoByTwo.product).toBe(1692)
  })
})
