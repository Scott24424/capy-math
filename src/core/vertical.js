/** 숫자를 일의 자리부터 담은 배열로. 123 → [3, 2, 1] */
const digitsOf = (n) => String(n).split('').reverse().map(Number)

/**
 * 숫자의 한글 읽기가 받침 없이 모음으로 끝나는지 (이·사·오·구).
 * 한글 숫자 읽기는 마지막 자리 숫자로만 정해진다 — 42는 "사십이"로 2(이)와 같다.
 * 십/백 등으로 끝나는 0은 받침이 있는 것으로 본다 ("영"/"십").
 */
const isVowelReading = (n) => [2, 4, 5, 9].includes(Math.abs(n) % 10)

/** 숫자 뒤에 붙는 서술격 조사: 받침 없으면 '예요', 있으면 '이에요' */
const copula = (n) => (isVowelReading(n) ? '예요' : '이에요')

/** 숫자 뒤에 붙는 목적격 조사: 받침 없으면 '를', 있으면 '을' */
const eul = (n) => (isVowelReading(n) ? '를' : '을')

/**
 * 세로셈 전개를 만든다.
 * cells 는 아이가 입력할 순서대로 나열된다:
 * 곱셈 결과를 먼저 쓰고, 올림수를 그 다음에 위에 쓴다.
 *
 * 칸(cell) 모양: { id, kind, row, col, value, hint }
 * - row 가 가질 수 있는 값: 0부터 시작하는 부분곱 줄 번호 | 'sum'(덧셈 줄) | 'answer'(구구단 답 칸)
 * - id 는 전체에서 항상 유일하지만 (row, col) 쌍은 유일하지 않다: 올림(carry) 칸은
 *   그 올림이 올라가는 곱셈 칸과 일부러 같은 (row, col)을 쓴다
 *   (예: 47×36의 p0-k1 과 p0-c1 은 둘 다 row 0, col 1). 소비자는 칸을 구분할 때
 *   id 로, 또는 (kind, row, col) 조합으로 구분해야 한다 — (row, col)만으로는 안 된다.
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
          ? `${ad} × ${bd} = ${raw}, 올린 ${carry}${eul(carry)} 더하면 ${total}${copula(total)}`
          : `${ad} × ${bd} = ${raw}${copula(raw)}`
      })

      if (nextCarry > 0 && !isLast) {
        rowCells.push({
          id: `p${row}-k${col + 1}`,
          kind: 'carry',
          row,
          col: col + 1,
          value: nextCarry,
          hint: `${total}의 십의 자리 ${nextCarry}${eul(nextCarry)} 위에 올려 써요`
        })
      }

      if (nextCarry > 0 && isLast) {
        rowCells.push({
          id: `p${row}-c${col + 1}`,
          kind: 'product',
          row,
          col: col + 1,
          value: nextCarry,
          hint: `${total}의 십의 자리 ${nextCarry}${eul(nextCarry)} 그대로 써요`
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
    // 부분곱 값이 0이면 digitsOf가 실제 칸 수보다 적은 자릿수를 돌려주므로,
    // "이 칸이 화면에 실제로 그려졌는가"는 digitsOf가 아니라 rowCells로 판단한다.
    const hasWrittenDigit = (partial, col) =>
      partial.cells.some(c => c.kind === 'product' && c.col === col)

    let carry = 0

    for (let col = 0; col < width; col++) {
      const written = partials
        .map((p, i) => ({ digit: partialDigits[i][col] || 0, real: hasWrittenDigit(p, col) }))
        .filter(x => x.real)

      const colSum = partialDigits.reduce((s, d) => s + (d[col] || 0), 0) + carry
      const digit = colSum % 10
      const nextCarry = Math.floor(colSum / 10)

      let hint
      if (written.length <= 1) {
        // 이 자리에 실제로 보이는 부분곱 칸이 하나뿐(또는 없음)이면
        // "0을 더한다"는 말은 화면에 없는 칸을 가리키게 되므로, 그대로 내려 쓰는 것으로 설명한다.
        const broughtDown = written.length === 1 ? written[0].digit : 0
        hint = carry > 0
          ? `${broughtDown}${eul(broughtDown)} 내리고 올린 ${carry}${eul(carry)} 더하면 ${colSum}${copula(colSum)}`
          : `${broughtDown}${eul(broughtDown)} 그대로 내려 써요`
      } else {
        const addends = written.map(x => x.digit).join(' + ')
        const rawSum = written.reduce((s, x) => s + x.digit, 0)
        hint = carry > 0
          ? `${addends} = ${rawSum}, 올린 ${carry}${eul(carry)} 더하면 ${colSum}${copula(colSum)}`
          : `${addends} = ${colSum}${copula(colSum)}`
      }

      sumCells.push({
        id: `s-c${col}`,
        kind: 'sum',
        row: 'sum',
        col,
        value: digit,
        hint
      })

      if (nextCarry > 0 && col + 1 < width) {
        sumCells.push({
          id: `s-k${col + 1}`,
          kind: 'sumCarry',
          row: 'sum',
          col: col + 1,
          value: nextCarry,
          hint: `${colSum}의 십의 자리 ${nextCarry}${eul(nextCarry)} 위에 올려 써요`
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
      hint: `${a} × ${b} = ${a * b}${copula(a * b)}`
    }]
  }
}

export function buildLayout(problem) {
  return problem.category === 'times-table'
    ? buildAnswerOnly(problem.a, problem.b)
    : buildVertical(problem.a, problem.b)
}
