/** 숫자를 일의 자리부터 담은 배열로. 123 → [3, 2, 1] */
const digitsOf = (n) => String(n).split('').reverse().map(Number)

/**
 * 세로셈 전개를 만든다.
 * cells 는 아이가 입력할 순서대로 나열된다:
 * 곱셈 결과를 먼저 쓰고, 올림수를 그 다음에 위에 쓴다.
 */
export function buildVertical(a, b) {
  const A = digitsOf(a)
  const B = digitsOf(b)
  const partials = []
  const cells = []

  B.forEach((bd, row) => {
    let carry = 0
    const rowCells = []

    A.forEach((ad, j) => {
      const raw = ad * bd
      const total = raw + carry
      const digit = total % 10
      const nextCarry = Math.floor(total / 10)
      const col = row + j
      const isLast = j === A.length - 1

      rowCells.push({
        id: `p${row}-c${col}`,
        kind: 'product',
        row,
        col,
        value: digit,
        hint: carry > 0
          ? `${ad} × ${bd} = ${raw}, 올린 ${carry}을 더하면 ${total}이에요`
          : `${ad} × ${bd} = ${raw}이에요`
      })

      if (nextCarry > 0 && !isLast) {
        rowCells.push({
          id: `p${row}-k${col + 1}`,
          kind: 'carry',
          row,
          col: col + 1,
          value: nextCarry,
          hint: `${total}의 십의 자리 ${nextCarry}을 위에 올려 써요`
        })
      }

      if (nextCarry > 0 && isLast) {
        rowCells.push({
          id: `p${row}-c${col + 1}`,
          kind: 'product',
          row,
          col: col + 1,
          value: nextCarry,
          hint: `${total}의 십의 자리 ${nextCarry}을 그대로 써요`
        })
      }

      carry = nextCarry
    })

    partials.push({ row, value: a * bd * 10 ** row, cells: rowCells })
    cells.push(...rowCells)
  })

  const sumCells = []
  if (B.length > 1) {
    const product = a * b
    const width = digitsOf(product).length
    const partialDigits = partials.map(p => digitsOf(p.value))
    let carry = 0

    for (let col = 0; col < width; col++) {
      const colSum = partialDigits.reduce((s, d) => s + (d[col] || 0), 0) + carry
      const digit = colSum % 10
      const nextCarry = Math.floor(colSum / 10)
      const addends = partialDigits.map(d => d[col] || 0).join(' + ')

      sumCells.push({
        id: `s-c${col}`,
        kind: 'sum',
        row: 'sum',
        col,
        value: digit,
        hint: carry > 0
          ? `${addends}에 올린 ${carry}을 더하면 ${colSum}이에요`
          : `${addends} = ${colSum}이에요`
      })

      if (nextCarry > 0 && col + 1 < width) {
        sumCells.push({
          id: `s-k${col + 1}`,
          kind: 'sumCarry',
          row: 'sum',
          col: col + 1,
          value: nextCarry,
          hint: `${colSum}의 십의 자리 ${nextCarry}을 위에 올려 써요`
        })
      }

      carry = nextCarry
    }

    cells.push(...sumCells)
  }

  return { a, b, product: a * b, mode: 'vertical', partials, sumCells, cells }
}

export function buildAnswerOnly(a, b) {
  return {
    a,
    b,
    product: a * b,
    mode: 'answer',
    cells: [{
      id: 'answer',
      kind: 'answer',
      row: 'answer',
      col: 0,
      value: a * b,
      hint: `${a} × ${b} = ${a * b}이에요`
    }]
  }
}

export function buildLayout(problem) {
  return problem.category === 'times-table'
    ? buildAnswerOnly(problem.a, problem.b)
    : buildVertical(problem.a, problem.b)
}
