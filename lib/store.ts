import { parseLog, type ExperimentLog, type Variant } from '@/lib/experiment'

/**
 * Log de eventos del experimento.
 *
 * Los conteos viven en una base, nunca en el navegador:
 *  - Producción: Redis por REST (Upstash / Vercel KV). Credenciales por variables de entorno.
 *  - Desarrollo local sin credenciales: un archivo JSON en .data/ (solo para probar).
 *
 * Dos operaciones alcanzan para todo:
 *  - claimOnce(clave, ttl): "reservar" un evento. Devuelve true solo la primera vez dentro del ttl.
 *    Así la deduplicación (una impresión por sesión, una conversión por visitante) la decide
 *    el servidor y no depende de que la cookie sobreviva.
 *  - increment(variante, campo): suma 1 al contador.
 */

export type EventField = 'impressions' | 'conversions'

export interface EventStore {
  readonly driver: 'redis' | 'archivo-local'
  claimOnce(key: string, ttlSeconds: number): Promise<boolean>
  increment(variant: Variant, field: EventField): Promise<void>
  readLog(): Promise<ExperimentLog>
}

const PREFIX = 'lab01'
const LOG_KEY = `${PREFIX}:log`

export function impressionKey(visitorId: string) {
  return `${PREFIX}:imp:${visitorId}`
}

export function conversionKey(visitorId: string) {
  return `${PREFIX}:conv:${visitorId}`
}

/* ---------------------------------- Redis (REST) ---------------------------------- */

function redisStore(url: string, token: string): EventStore {
  async function command(args: (string | number)[]): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Redis respondió ${response.status}`)
    const body = (await response.json()) as { result?: unknown; error?: string }
    if (body.error) throw new Error(`Redis: ${body.error}`)
    return body.result
  }

  return {
    driver: 'redis',
    async claimOnce(key, ttlSeconds) {
      // SET ... NX EX: atómico. "OK" si la clave no existía, null si ya estaba.
      const result = await command(['SET', key, '1', 'NX', 'EX', ttlSeconds])
      return result === 'OK'
    },
    async increment(variant, field) {
      await command(['HINCRBY', LOG_KEY, `${variant}:${field}`, 1])
    },
    async readLog() {
      const result = await command(['HGETALL', LOG_KEY])
      const flat = Array.isArray(result) ? result.map(String) : []
      const fields: Record<string, number> = {}
      for (let i = 0; i + 1 < flat.length; i += 2) fields[flat[i]] = Number(flat[i + 1])
      // Lo que vuelve de la base se valida antes de usarlo.
      return parseLog(
        JSON.stringify({
          a: { impressions: fields['a:impressions'] ?? 0, conversions: fields['a:conversions'] ?? 0 },
          b: { impressions: fields['b:impressions'] ?? 0, conversions: fields['b:conversions'] ?? 0 },
        }),
      )
    },
  }
}

/* ------------------------------ Archivo local (dev) ------------------------------ */

type FileShape = {
  counters: Record<string, number>
  claims: Record<string, number> // clave -> vence (ms epoch)
}

function fileStore(): EventStore {
  async function open() {
    const [{ promises: fs }, path, os] = await Promise.all([
      import('node:fs'),
      import('node:path'),
      import('node:os'),
    ])
    const dir = process.env.NODE_ENV === 'production' ? os.tmpdir() : path.join(process.cwd(), '.data')
    await fs.mkdir(dir, { recursive: true })
    return { fs, file: path.join(dir, 'lab01-log.json') }
  }

  async function load(): Promise<{ data: FileShape; save: () => Promise<void> }> {
    const { fs, file } = await open()
    let data: FileShape = { counters: {}, claims: {} }
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null) {
        const p = parsed as Partial<FileShape>
        data = { counters: p.counters ?? {}, claims: p.claims ?? {} }
      }
    } catch {
      // archivo inexistente o corrupto: se arranca de cero
    }
    const now = Date.now()
    for (const [key, expires] of Object.entries(data.claims)) {
      if (expires <= now) delete data.claims[key]
    }
    return { data, save: () => fs.writeFile(file, JSON.stringify(data)) }
  }

  return {
    driver: 'archivo-local',
    async claimOnce(key, ttlSeconds) {
      const { data, save } = await load()
      if (data.claims[key]) return false
      data.claims[key] = Date.now() + ttlSeconds * 1000
      await save()
      return true
    },
    async increment(variant, field) {
      const { data, save } = await load()
      const name = `${variant}:${field}`
      data.counters[name] = (data.counters[name] ?? 0) + 1
      await save()
    },
    async readLog() {
      const { data } = await load()
      return parseLog(
        JSON.stringify({
          a: { impressions: data.counters['a:impressions'] ?? 0, conversions: data.counters['a:conversions'] ?? 0 },
          b: { impressions: data.counters['b:impressions'] ?? 0, conversions: data.counters['b:conversions'] ?? 0 },
        }),
      )
    },
  }
}

/* ------------------------------------ Selector ------------------------------------ */

let cached: EventStore | undefined

export function getStore(): EventStore {
  if (cached) return cached
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  cached = url && token ? redisStore(url, token) : fileStore()
  return cached
}
