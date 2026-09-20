export const MAX_ATTEMPTS = 2

export function judgeCell(cell, input, attemptsSoFar) {
  const raw = String(input).trim()
  const numeric = Number(raw)

  if (raw === '' || !Number.isFinite(numeric)) {
    return { correct: false, reveal: false, message: '숫자를 눌러 보세요' }
  }

  if (numeric === cell.value) {
    return { correct: true, reveal: false, message: '' }
  }

  const used = attemptsSoFar + 1
  if (used >= MAX_ATTEMPTS) {
    return { correct: false, reveal: true, message: cell.hint }
  }
  return { correct: false, reveal: false, message: '다시 한 번 해볼까요?' }
}

export function summarize(results, elapsedMs) {
  const total = results.length
  const correct = results.filter(r => r.correct).length
  return {
    total,
    correct,
    wrong: total - correct,
    accuracy: total === 0 ? 0 : correct / total,
    elapsedMs,
    allCorrect: total > 0 && correct === total
  }
}
