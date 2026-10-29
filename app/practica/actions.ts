'use server'

import { cookies, headers } from 'next/headers'
import {
  COOKIE,
  THIRTY_DAYS,
  assignVariant,
  cookieOptions,
  isCrawler,
  isVisitorId,
} from '@/lib/experiment'
import { conversionKey, getStore } from '@/lib/store'

export type ConversionStatus = 'recorded' | 'duplicate' | 'ignored' | 'error'

/**
 * Una conversión por visitante, solo cuando se hace clic en el CTA.
 *
 * - No hay visitante válido (sin cookie, cookie alterada, crawler) -> 'ignored'.
 * - La variante se recalcula con el hash: no se confía en lo que diga el cliente.
 * - La base decide si ya hubo una (claimOnce): un segundo clic -> 'duplicate'.
 * - El preview no llama a esta acción (ver components/cta.tsx).
 */
export async function recordConversion(): Promise<{ status: ConversionStatus }> {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()])

  if (isCrawler(requestHeaders.get('user-agent'))) return { status: 'ignored' }

  const visitorId = jar.get(COOKIE.visitor)?.value
  if (!isVisitorId(visitorId)) return { status: 'ignored' }

  const variant = assignVariant(visitorId)

  try {
    const store = getStore()
    // TTL = vida del visitante: dentro de esos 30 días, una sola conversión.
    const first = await store.claimOnce(conversionKey(visitorId), THIRTY_DAYS)
    if (!first) return { status: 'duplicate' }
    await store.increment(variant, 'conversions')
  } catch (error) {
    console.error('[lab01] no se pudo anotar la conversión', error)
    return { status: 'error' }
  }

  const secure = requestHeaders.get('x-forwarded-proto') === 'https'
  jar.set(COOKIE.converted, '1', cookieOptions(secure, THIRTY_DAYS))
  return { status: 'recorded' }
}
