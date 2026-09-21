import { describe, it, expect } from 'vitest'
import { buildLayout } from '../src/core/vertical.js'
import { gridModel, renderGrid } from '../src/ui/verticalGrid.js'

const layoutOf = (category, a, b) => buildLayout({ category, a, b })

// renderGrid 는 DOM 없이도 stub 컨테이너(innerHTML 대입 + style.setProperty)만
// 받으면 충분하다 — jsdom 없이 문자열로 나온 HTML을 직접 검사한다.
const stubContainer = () => ({ innerHTML: '', style: { setProperty() {} } })

const render = (layout, state) => {
  const container = stubContainer()
  renderGrid(container, layout, state)
  return container.innerHTML
}

// html 안의 모든 <div class="..."> 를 훑어, g-cell 을 가진 div(칸)와
// 그렇지 않은 div(줄/구분선/전체 래퍼)의 클래스 집합을 나눈다.
// 상태 클래스(is-active 등)는 칸에만 붙고 줄 클래스와 겹칠 수 없으므로 제외한다.
const classSets = (html) => {
  const cell = new Set()
  const container = new Set()
  for (const m of html.matchAll(/<div class="([^"]+)"/g)) {
    const tokens = m[1].split(/\s+/)
    const isCell = tokens.includes('g-cell')
    const bucket = isCell ? cell : container
    for (const t of tokens) {
      if (t === 'g-cell' || t === 'is-active' || t === 'is-wrong' || t === 'is-filled') continue
      bucket.add(t)
    }
  }
  return { cell, container }
}

// html 에서 지정한 줄 타입(g-row--<type>)에 해당하는 모든 줄을, 등장 순서대로
// { classes, cellId, text } 배열들의 배열로 돌려준다. 화면에 보이는 순서
// (왼쪽 = 높은 자리)대로 칸이 나열되어 있다고 가정한다.
const rowsOfType = (html, type) => {
  const rowRe = new RegExp(
    `<div class="g-row g-row--${type}">((?:<div class="g-cell[^"]*"(?: data-cell="[^"]*")?>[^<]*<\\/div>)*)<\\/div>`,
    'g'
  )
  const cellRe = /<div class="g-cell([^"]*)"(?: data-cell="([^"]*)")?>([^<]*)<\/div>/g
  return [...html.matchAll(rowRe)].map(rowMatch =>
    [...rowMatch[1].matchAll(cellRe)].map(cellMatch => ({
      classes: ('g-cell' + cellMatch[1]).trim().split(/\s+/),
      cellId: cellMatch[2] || null,
      text: cellMatch[3]
    }))
  )
}

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

describe('renderGrid', () => {
  // 회귀 방지: 이전에 실제로 발생했던 버그가 정확히 이것이다 —
  // 줄(row) 클래스와 칸(cell) 클래스가 같은 이름(g-carry)을 써서
  // 칸 크기 CSS 규칙이 줄 전체에 적용되어 올림수 줄이 통째로 찌그러졌다.
  // 이 테스트는 어떤 줄 클래스도 어떤 칸 클래스와 겹치지 않는다는 것을
  // 모든 카테고리에 대해 확인해, 같은 종류의 충돌(예: 'line' 이라는
  // 칸 종류가 새로 생겨 .g-line 과 겹치는 경우)이 다시 생기면 실패한다.
  it.each([
    ['two-by-two', 47, 36],
    ['two-by-one', 47, 3],
    ['three-by-one', 246, 7],
    ['times-table', 7, 8]
  ])('%s (%i × %i): 줄 클래스와 칸 클래스가 겹치지 않는다', (category, a, b) => {
    const html = render(layoutOf(category, a, b), {})
    const { cell, container } = classSets(html)
    const overlap = [...cell].filter(c => container.has(c))
    expect(overlap).toEqual([])
  })

  it('47 × 36: 올림 칸이 자기가 올라가는 곱셈 칸과 같은 열에 그려진다', () => {
    const html = render(layoutOf('two-by-two', 47, 36), {})
    const carryRow = rowsOfType(html, 'carry')[0]
    const partialRows = rowsOfType(html, 'partial')

    const idxP0K1 = carryRow.findIndex(c => c.cellId === 'p0-k1')
    const idxP0C1 = partialRows[0].findIndex(c => c.cellId === 'p0-c1') // 첫 부분곱의 십의 자리
    expect(idxP0K1).toBeGreaterThanOrEqual(0)
    expect(idxP0K1).toBe(idxP0C1)

    const idxP1K2 = carryRow.findIndex(c => c.cellId === 'p1-k2')
    expect(idxP1K2).toBeGreaterThanOrEqual(0)
    expect(idxP1K2).toBe(idxP0K1 - 1) // 한 칸 더 왼쪽
  })

  it('두 번째 부분곱의 일의 자리는 상자도 0도 그려지지 않는다', () => {
    const html = render(layoutOf('two-by-two', 47, 36), {})
    const partialRows = rowsOfType(html, 'partial')
    const second = partialRows[1]
    const onesCell = second[second.length - 1] // 표시 순서상 맨 오른쪽 = 일의 자리
    expect(onesCell.cellId).toBeNull()
    expect(onesCell.classes).toContain('g-empty')
    expect(onesCell.text).toBe('')
  })

  it('activeId 와 wrongId 는 각각 정확히 그 칸 하나에만 상태 클래스를 붙인다', () => {
    const layout = layoutOf('two-by-two', 47, 36)
    const activeId = 'p0-c0'
    const wrongId = 'p1-c3'
    const html = render(layout, { filled: {}, activeId, wrongId })

    const activeDivs = [...html.matchAll(/<div class="[^"]*\bis-active\b[^"]*" data-cell="([^"]+)"/g)]
    const wrongDivs = [...html.matchAll(/<div class="[^"]*\bis-wrong\b[^"]*" data-cell="([^"]+)"/g)]

    expect(activeDivs).toHaveLength(1)
    expect(activeDivs[0][1]).toBe(activeId)
    expect(wrongDivs).toHaveLength(1)
    expect(wrongDivs[0][1]).toBe(wrongId)
  })
})
