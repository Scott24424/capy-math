const digits = (n) => String(n).split('').reverse()

export function gridModel(layout) {
  if (layout.mode === 'answer') {
    return {
      width: 1,
      rows: [{
        type: 'equation',
        text: `${layout.a} × ${layout.b} =`,
        cells: [{ kind: 'answer', text: null, cellId: 'answer' }]
      }]
    }
  }

  const width = String(layout.product).length
  const blank = () => Array.from({ length: width }, () => null)
  const place = (cells, col, cell) => { if (col < width) cells[col] = cell }

  const carryRow = blank()
  for (const c of layout.cells) {
    if (c.kind === 'carry') place(carryRow, c.col, { kind: 'carry', text: null, cellId: c.id })
  }

  const operandA = blank()
  digits(layout.a).forEach((d, i) => place(operandA, i, { kind: 'given', text: d, cellId: null }))

  const operandB = blank()
  digits(layout.b).forEach((d, i) => place(operandB, i, { kind: 'given', text: d, cellId: null }))

  const partialRows = layout.partials.map(p => {
    const cells = blank()
    for (const c of p.cells) {
      if (c.kind === 'product') place(cells, c.col, { kind: 'input', text: null, cellId: c.id })
    }
    return { type: 'partial', cells }
  })

  const rows = [
    { type: 'carry', cells: carryRow },
    { type: 'operandA', cells: operandA },
    { type: 'operandB', cells: operandB, symbol: '×' },
    { type: 'line', cells: blank() },
    ...partialRows
  ]

  if (layout.sumCells.length > 0) {
    const sumCarryRow = blank()
    const sumRow = blank()
    for (const c of layout.sumCells) {
      if (c.kind === 'sumCarry') place(sumCarryRow, c.col, { kind: 'carry', text: null, cellId: c.id })
      if (c.kind === 'sum') place(sumRow, c.col, { kind: 'input', text: null, cellId: c.id })
    }
    rows.push({ type: 'line', cells: blank() })
    rows.push({ type: 'sumCarry', cells: sumCarryRow })
    rows.push({ type: 'sum', cells: sumRow })
  }

  return { width, rows }
}

// 올림수 줄(carry/sumCarry)이 이 문제에서 실제로 쓸 칸이 하나도 없으면
// 줄 전체를 그리지 않는다 — 빈 줄 높이만큼 아래 줄들이 늘어지는 것을 막는다.
const isEmptyCarryRow = (row) =>
  (row.type === 'carry' || row.type === 'sumCarry') && row.cells.every(c => c === null)

export function renderGrid(container, layout, state) {
  const { width, rows } = gridModel(layout)
  const { filled = {}, activeId = null, wrongId = null } = state || {}

  const cellHtml = (cell) => {
    if (!cell) return '<div class="g-cell g-empty"></div>'
    if (cell.kind === 'symbol') return `<div class="g-cell g-symbol">${cell.text}</div>`
    if (cell.kind === 'given') return `<div class="g-cell g-given">${cell.text}</div>`
    const value = filled[cell.cellId]
    const classes = ['g-cell', cell.kind === 'carry' ? 'g-carry' : 'g-input']
    if (cell.cellId === activeId) classes.push('is-active')
    if (cell.cellId === wrongId) classes.push('is-wrong')
    if (value !== undefined) classes.push('is-filled')
    return `<div class="${classes.join(' ')}" data-cell="${cell.cellId}">${value ?? ''}</div>`
  }

  container.innerHTML = rows.map(row => {
    if (row.type === 'line') return '<div class="g-line"></div>'
    if (row.type === 'equation') {
      return `<div class="g-equation"><span>${row.text}</span>${cellHtml(row.cells[0])}</div>`
    }
    if (isEmptyCarryRow(row)) return ''

    // 줄 순서는 왼쪽(자리값 큰 자리)부터이므로 뒤집는다.
    const displayCells = [...row.cells].reverse()

    // × 는 칸 하나를 새로 만드는 대신, 곱하는 수의 맨 앞자리 바로 앞에 있는
    // (자리 정렬을 위해 남겨둔) 빈 칸 자리에 끼워 넣어 숫자에 바짝 붙인다.
    if (row.symbol) {
      const firstDigitIndex = displayCells.findIndex(c => c !== null)
      const symbolCell = { kind: 'symbol', text: row.symbol, cellId: null }
      if (firstDigitIndex > 0) {
        // 자리 정렬을 위해 비워둔 칸이 있으니, 그 칸을 기호로 바꿔 숫자에 붙인다.
        displayCells[firstDigitIndex - 1] = symbolCell
      } else {
        // 비워둘 칸이 없는 극단적인 경우에만 앞에 새 칸을 더한다.
        displayCells.unshift(symbolCell)
      }
    }

    const cells = displayCells.map(cellHtml).join('')
    return `<div class="g-row g-row--${row.type}">${cells}</div>`
  }).join('')

  container.style.setProperty('--grid-width', String(width))
}
