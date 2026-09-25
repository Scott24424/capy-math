/**
 * 저장소. 핸들러는 이 네 가지 동작만 쓴다:
 *   getJSON(key) → 값 | null
 *   setJSON(key, value, { onlyIfAbsent }) → 썼으면 true
 *   increment(key, ttlSeconds) → 올린 뒤 값 (처음 만들 때 만료 시간을 건다)
 *   remove(key)
 * 운영은 Upstash Redis REST, 테스트는 memoryStore.
 */

export function upstashStore({ url, token }, fetchImpl = globalThis.fetch) {
  const command = async (...args) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) throw new Error(`redis ${args[0]} failed: ${res.status} ${data.error ?? ''}`)
    return data.result
  }

  return {
    async getJSON(key) {
      const raw = await command('GET', key)
      if (raw == null) return null
      try { return JSON.parse(raw) } catch { return null }
    },
    async setJSON(key, value, { onlyIfAbsent = false } = {}) {
      const args = ['SET', key, JSON.stringify(value)]
      if (onlyIfAbsent) args.push('NX')
      return (await command(...args)) === 'OK'
    },
    async increment(key, ttlSeconds) {
      const n = await command('INCR', key)
      if (n === 1) await command('EXPIRE', key, ttlSeconds)
      return n
    },
    async remove(key) {
      await command('DEL', key)
    }
  }
}

export function memoryStore(now = () => Date.now()) {
  const data = new Map()
  const live = (key) => {
    const entry = data.get(key)
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) { data.delete(key); return undefined }
    return entry
  }
  return {
    data,
    async getJSON(key) {
      const entry = live(key)
      return entry ? JSON.parse(entry.value) : null
    },
    async setJSON(key, value, { onlyIfAbsent = false } = {}) {
      if (onlyIfAbsent && live(key)) return false
      data.set(key, { value: JSON.stringify(value), expiresAt: null })
      return true
    },
    async increment(key, ttlSeconds) {
      const entry = live(key)
      const n = (entry ? Number(entry.value) : 0) + 1
      data.set(key, { value: String(n), expiresAt: entry ? entry.expiresAt : now() + ttlSeconds * 1000 })
      return n
    },
    async remove(key) {
      data.delete(key)
    }
  }
}
