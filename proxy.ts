import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  COOKIE,
  HEADER,
  SESSION_WINDOW,
  THIRTY_DAYS,
  assignVariant,
  cookieOptions,
  isCrawler,
  isVariant,
  isVisitorId,
  type Variant,
  type VariantSource,
} from '@/lib/experiment'
import { getStore, impressionKey } from '@/lib/store'

/**
 * Qué hace este archivo, en orden:
 *  1. Solo GET. Los POST de /practica son Server Actions (el CTA): no se tocan.
 *  2. ?preview=a|b  -> muestra ese copy. No escribe cookies, no cuenta, lleva noindex.
 *  3. Crawler       -> siempre el control (A), misma URL, mismo canonical. No cookies, no cuenta.
 *  4. Persona       -> visitante + variante en cookie (primer request sin cookie), y una
 *                      impresión por sesión de 30 minutos.
 *
 * Los conteos van a la base (lib/store.ts), nunca al navegador.
 */

function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch' ||
    (request.headers.get('sec-purpose') ?? '').includes('prefetch')
  )
}

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
}

// Le pasa la variante a la página en el MISMO request (la cookie recién escrita
// todavía no viaja de vuelta) y pisa cualquier cabecera falsificada por el cliente.
function pass(request: NextRequest, variant: Variant | null, source: VariantSource | null) {
  const headers = new Headers(request.headers)
  headers.delete(HEADER.variant)
  headers.delete(HEADER.source)
  if (variant) headers.set(HEADER.variant, variant)
  if (source) headers.set(HEADER.source, source)
  const response = NextResponse.next({ request: { headers } })
  // La respuesta depende de la cookie: que ningún CDN la comparta entre personas.
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Vary', 'Cookie, User-Agent')
  return response
}

export async function proxy(request: NextRequest) {
  if (request.method !== 'GET') return pass(request, null, null)

  // 2. Preview: instrumento para ver las piezas. No es una visita del experimento.
  const requested = request.nextUrl.searchParams.get('preview')
  if (isVariant(requested)) {
    const response = pass(request, requested, 'preview')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  // 3. Crawler: control fijo, sin cookies, sin conteo. Misma URL y mismo canonical.
  if (isCrawler(request.headers.get('user-agent'))) {
    return pass(request, 'a', 'crawler')
  }

  // 4. Persona. Se valida lo que dice la cookie: la controla el cliente.
  const existing = request.cookies.get(COOKIE.visitor)?.value
  const visitorId = isVisitorId(existing) ? existing : crypto.randomUUID()
  const variant = assignVariant(visitorId) // determinística: sin sorteo
  const response = pass(request, variant, 'cookie')

  const secure = isSecure(request)
  if (visitorId !== existing) {
    response.cookies.set(COOKIE.visitor, visitorId, cookieOptions(secure, THIRTY_DAYS))
  }
  if (request.cookies.get(COOKIE.variant)?.value !== variant) {
    response.cookies.set(COOKIE.variant, variant, cookieOptions(secure, THIRTY_DAYS))
  }

  // Impresión: una por sesión de 30 minutos. Un prefetch no es una visita.
  if (!isPrefetch(request) && !request.cookies.has(COOKIE.impressed)) {
    try {
      const store = getStore()
      // La base decide si ya hubo una en la ventana (si la cookie se pierde, no se cuenta doble).
      if (await store.claimOnce(impressionKey(visitorId), SESSION_WINDOW)) {
        await store.increment(variant, 'impressions')
      }
      response.cookies.set(COOKIE.impressed, '1', cookieOptions(secure, SESSION_WINDOW))
    } catch (error) {
      // Si la base falla, la página igual se sirve. No se marca la sesión: el próximo request reintenta.
      console.error('[lab01] no se pudo anotar la impresión', error)
    }
  }

  return response
}

export const config = {
  matcher: ['/practica'],
}
