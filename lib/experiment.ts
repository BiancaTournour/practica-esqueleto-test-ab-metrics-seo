export type Variant = 'a' | 'b'

export type VariantStats = {
  impressions: number
  conversions: number
}

export type ExperimentLog = Record<Variant, VariantStats>

// Visitante y variante viven en la cookie. Los conteos NO: van a la base (lib/store.ts).
export const COOKIE = {
  visitor: 'lab_visitor',
  variant: 'lab_variant',
  impressed: 'lab_impressed',
  converted: 'lab_converted',
} as const

// Cabeceras internas que el proxy le pasa a la página en el mismo request.
// El proxy las pisa siempre, así que un cliente no puede falsificarlas.
export const HEADER = {
  variant: 'x-lab-variant',
  source: 'x-lab-source',
} as const

// De dónde sale la variante que se está mostrando.
export type VariantSource = 'cookie' | 'preview' | 'crawler'

export const THIRTY_DAYS = 60 * 60 * 24 * 30
export const SESSION_WINDOW = 60 * 30
export const CANONICAL_PATH = '/practica'
export const TITLE_RANGE = { min: 50, max: 60 }
export const DESCRIPTION_RANGE = { min: 140, max: 160 }

export const OFFER = [
  { label: 'Inicio', value: '14 de abril' },
  { label: 'Duración', value: '8 semanas' },
  { label: 'Cupo', value: '12 personas' },
  { label: 'Oficios', value: 'Carpintería, electricidad, cocina' },
] as const

export const VARIANTS = {
  a: {
    id: 'a',
    name: 'Control',
    seoTitle: 'Cursos de oficio en ocho semanas, con salida laboral',
    seoDescription:
      'Aprendé carpintería, electricidad o cocina en ocho semanas. Grupos de doce personas y práctica real, con una salida laboral que se puede cobrar.',
    headline: 'Ocho semanas para un oficio que se puede cobrar.',
    emphasis: null,
    lede: 'La práctica empieza en la primera clase. El mensaje de esta variante habla del método, no de la escasez.',
    cta: 'Ver cupos de abril',
  },
  b: {
    id: 'b',
    name: 'Tratamiento',
    seoTitle: 'Abril abre cupos: cursos de oficio en grupos de 12',
    seoDescription:
      'El 14 de abril empiezan grupos de doce. En la cohorte anterior, ocho de cada diez consiguieron trabajo en el rubro antes de los noventa días.',
    headline: 'El curso empieza el 14 de abril.',
    emphasis: 'El cupo, no.',
    lede: 'Doce lugares y una fecha. El mensaje de esta variante apura la decisión, sin cambiar la oferta.',
    cta: 'Reservar mi lugar',
  },
} as const

export const TEST_CASE: ExperimentLog = {
  a: { impressions: 240, conversions: 18 },
  b: { impressions: 236, conversions: 31 },
}

export const HASH_EXAMPLE_ID = 'lab-visitor-demo-01'

export function isVariant(value: string | null | undefined): value is Variant {
  return value === 'a' || value === 'b'
}

export function emptyLog(): ExperimentLog {
  return {
    a: { impressions: 0, conversions: 0 },
    b: { impressions: 0, conversions: 0 },
  }
}

// Función de hash documentada: FNV-1a de 32 bits + finalizador fmix32 de MurmurHash3.
// FNV-1a sola deja sesgo en el bit bajo para ids parecidos; fmix32 mezcla todos los bits
// antes de tomar el módulo. Es pura y síncrona: sin Math.random(), sin Date, sin I/O.
export const HASH_NAME = 'FNV-1a 32 bits + fmix32 (MurmurHash3), módulo 2'
export const HASH_SALT = 'taller-norte-lab01'

export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export function assignVariant(visitorId: string): Variant {
  // Par -> A (control), impar -> B (tratamiento). El mismo id da siempre lo mismo.
  return hashString(`${HASH_SALT}:${visitorId}`) % 2 === 0 ? 'a' : 'b'
}

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// La cookie la controla el cliente: se valida antes de usarla.
export function isVisitorId(value: string | null | undefined): value is string {
  return typeof value === 'string' && VISITOR_ID.test(value)
}

// Crawlers y previews de links. No son visitantes del experimento.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|headlesschrome|lighthouse|inspectiontool/i

export function isCrawler(userAgent: string | null | undefined): boolean {
  return typeof userAgent === 'string' && BOT_PATTERN.test(userAgent)
}

export function conversionRate(stats: VariantStats): number | null {
  // Sin impresiones la tasa no existe: null, no 0.
  if (!Number.isFinite(stats.impressions) || stats.impressions <= 0) return null
  return stats.conversions / stats.impressions
}

export function rateGap(log: ExperimentLog): number | null {
  const control = conversionRate(log.a)
  const treatment = conversionRate(log.b)
  if (control === null || treatment === null) return null
  return (treatment - control) * 100
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isStats(value: unknown): value is VariantStats {
  if (typeof value !== 'object' || value === null) return false
  const { impressions, conversions } = value as Record<string, unknown>
  return isCount(impressions) && isCount(conversions)
}

// Valida lo que viene de afuera (base, JSON) antes de usarlo. Si algo no cierra, log vacío.
export function parseLog(raw: string | undefined): ExperimentLog {
  if (!raw) return emptyLog()
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return emptyLog()
    const { a, b } = data as Record<string, unknown>
    if (!isStats(a) || !isStats(b)) return emptyLog()
    return {
      a: { impressions: a.impressions, conversions: a.conversions },
      b: { impressions: b.impressions, conversions: b.conversions },
    }
  } catch {
    return emptyLog()
  }
}

export function serializeLog(log: ExperimentLog): string {
  return JSON.stringify(log)
}

const numberFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integerFormat = new Intl.NumberFormat('es-AR')

export function formatCount(value: number): string {
  return integerFormat.format(value)
}

export function formatRate(rate: number | null): string {
  if (rate === null) return 'Pendiente'
  return `${numberFormat.format(rate * 100)}%`
}

export function formatPoints(value: number | null): string {
  if (value === null) return 'Pendiente'
  return `${numberFormat.format(value)} pp`
}

export function characterCount(value: string): number {
  return Array.from(value).length
}

export function inRange(length: number, range: { min: number; max: number }): boolean {
  return length >= range.min && length <= range.max
}

export function cookieOptions(secure: boolean, maxAge?: number) {
  // El preview corre en un iframe: la cookie tiene que ser Secure y SameSite=None.
  return {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: secure ? ('none' as const) : ('lax' as const),
    partitioned: secure,
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  }
}
