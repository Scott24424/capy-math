import { upstashStore } from './store.js'

// Vercel 진입점과 순수 핸들러 사이의 얇은 연결부.

export function readConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN
  const inviteCode = env.INVITE_CODE
  const sessionSecret = env.SESSION_SECRET
  if (!url || !token || !inviteCode || !sessionSecret || sessionSecret.length < 32) return null
  return { redis: { url, token }, inviteCode, sessionSecret }
}

export async function toInput(request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  return {
    method: request.method,
    contentType: request.headers.get('content-type'),
    cookie: request.headers.get('cookie'),
    ip: forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown',
    bodyText: request.method === 'GET' ? '' : await request.text()
  }
}

export function toResponse({ status, body, cookie }) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  if (cookie) headers.append('Set-Cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

/** 핸들러 하나를 Vercel 함수로 감싼다. 설정이 빠졌거나 예외가 나면 server-error */
export function serve(handler) {
  return async (request) => {
    const config = readConfig()
    if (!config) return toResponse({ status: 500, body: { error: 'server-error' } })
    try {
      const input = await toInput(request)
      return toResponse(await handler(input, { store: upstashStore(config.redis), config }))
    } catch (err) {
      console.error(err)
      return toResponse({ status: 500, body: { error: 'server-error' } })
    }
  }
}
