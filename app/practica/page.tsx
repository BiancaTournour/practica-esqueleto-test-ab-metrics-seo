import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Landing } from '@/components/landing'
import {
  CANONICAL_PATH,
  DESCRIPTION_RANGE,
  HEADER,
  TITLE_RANGE,
  VARIANTS,
  characterCount,
  inRange,
  isVariant,
  type Variant,
  type VariantSource,
} from '@/lib/experiment'

type PracticaPageProps = {
  searchParams: Promise<{ preview?: string | string[] }>
}
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// Qué variante se muestra y por qué. Lo resuelve el proxy (cookie + hash) y lo pasa por
// cabecera interna; acá solo se lee. El ?preview= tiene prioridad y nunca es la asignación.
async function resolveView(previewParam: string | string[] | undefined) {
  const requested = firstParam(previewParam)
  if (isVariant(requested)) return { variant: requested, source: 'preview' as VariantSource }

  const h = await headers()
  const assigned = h.get(HEADER.variant)
  const source = h.get(HEADER.source)
  return {
    variant: (isVariant(assigned) ? assigned : 'a') as Variant,
    source: (source === 'crawler' ? 'crawler' : 'cookie') as VariantSource,
  }
}

// Se ejecuta en el servidor: title y description salen en el HTML del primer response.
export async function generateMetadata({ searchParams }: PracticaPageProps): Promise<Metadata> {
  const { variant, source } = await resolveView((await searchParams).preview)
  const copy = VARIANTS[variant]
  const isPreview = source === 'preview'

  return {
    // absolute: ignora el template "%s · Laboratorio 01" del layout. El title es el de la variante, tal cual.
    title: { absolute: copy.seoTitle },
    description: copy.seoDescription,
    // Un solo canonical para las dos variantes, siempre /practica y sin query.
    alternates: { canonical: CANONICAL_PATH },
    // La URL canónica se indexa. El preview es un instrumento: noindex.
    robots: isPreview ? { index: false, follow: false } : { index: true, follow: true },
  }
}

export default async function PracticaPage({ searchParams }: PracticaPageProps) {
  const params = await searchParams
  const { variant, source } = await resolveView(params.preview)
  const preview = source === 'preview'
  const copy = VARIANTS[variant]
  const titleLength = characterCount(copy.seoTitle)
  const descriptionLength = characterCount(copy.seoDescription)

  return (
    <main id="contenido" className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
      <p className="border-b border-border pb-4 text-sm text-muted-foreground" data-source={source}>
        {source === 'preview'
          ? `Vista previa del copy ${variant.toUpperCase()}. No cambia tu variante asignada, no cuenta como visita y lleva noindex.`
          : source === 'crawler'
            ? 'Versión de control (A), la misma URL y el mismo canonical para cualquier persona o crawler.'
            : `Tu variante asignada es la ${variant.toUpperCase()}. Se mantiene al recargar.`}
      </p>
      <Landing variant={variant} preview={preview} />
      <div className="flex flex-wrap gap-2">
        <Link href="/practica?preview=a" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Ver copy A
        </Link>
        <Link href="/practica?preview=b" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Ver copy B
        </Link>
        {preview ? (
          <Link href="/practica" prefetch={false} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Salir del preview
          </Link>
        ) : null}
        <Link href="/bitacora" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Bitácora
        </Link>
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl">Metadatos publicados en el HTML</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 border-b border-border pb-3">
            <dt className="font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
              Title de {variant.toUpperCase()}
            </dt>
            <dd>{copy.seoTitle}</dd>
            <dd className="font-mono text-sm text-muted-foreground">
              {titleLength} caracteres · {inRange(titleLength, TITLE_RANGE) ? 'dentro de 50–60' : 'fuera de rango'}
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-border pb-3">
            <dt className="font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
              Description de {variant.toUpperCase()}
            </dt>
            <dd>{copy.seoDescription}</dd>
            <dd className="font-mono text-sm text-muted-foreground">
              {descriptionLength} caracteres ·{' '}
              {inRange(descriptionLength, DESCRIPTION_RANGE) ? 'dentro de 140–160' : 'fuera de rango'}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
