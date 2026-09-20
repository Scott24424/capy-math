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

export function renderGrid(container, layout, state) {
  const { width, rows } = gridModel(layout)
  const { filled = {}, activeId = null, wrongId = null } = state || {}

  const cellHtml = (cell) => {
    if (!cell) return '<div class="g-cell g-empty"></div>'
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
    const cells = [...row.cells].reverse().map(cellHtml).join('')
    const symbol = row.symbol ? `<div class="g-symbol">${row.symbol}</div>` : '<div class="g-symbol"></div>'
    return `<div class="g-row g-${row.type}">${symbol}${cells}</div>`
  }).join('')

  container.style.setProperty('--grid-width', String(width))
}
