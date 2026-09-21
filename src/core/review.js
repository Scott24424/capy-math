export const MAX_QUEUE = 40
export const REQUIRED_STREAK = 2

export function addWrong(queue, problem) {
  const existing = queue.find(e => e.id === problem.id)
  if (existing) {
    return queue.map(e => (e.id === problem.id ? { ...e, streak: 0 } : e))
  }
  const next = [...queue, {
    id: problem.id,
    category: problem.category,
    a: problem.a,
    b: problem.b,
    streak: 0
  }]
  return next.length > MAX_QUEUE ? next.slice(next.length - MAX_QUEUE) : next
}

export function recordReviewResult(queue, problemId, correct) {
  return queue.flatMap(e => {
    if (e.id !== problemId) return [e]
    if (!correct) return [{ ...e, streak: 0 }]
    const streak = e.streak + 1
    return streak >= REQUIRED_STREAK ? [] : [{ ...e, streak }]
  })
}

export function pickForSet(queue, count, rng = Math.random) {
  const pool = [...queue]
  const picked = []
  while (picked.length < count && pool.length > 0) {
    const i = Math.min(Math.floor(rng() * pool.length), pool.length - 1)
    const [entry] = pool.splice(i, 1)
    picked.push({
      id: entry.id,
      category: entry.category,
      a: entry.a,
      b: entry.b,
      isReview: true
    })
  }
  return picked
}
