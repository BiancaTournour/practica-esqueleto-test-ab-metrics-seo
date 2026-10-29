import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Laboratorio 01',
  robots: { index: false, follow: false },
}

const FILES = [
  ['proxy.ts', 'Asigna visitante y variante. Anota una impresión por sesión de 30 minutos.'],
  ['lib/experiment.ts', 'Hash estable, tasa y validación del log. Copy y caso de prueba.'],
  ['app/practica/page.tsx', 'Title, description, canonical único y noindex en el preview.'],
  ['app/practica/actions.ts', 'Una conversión por visitante, solo con el CTA.'],
  ['lib/store.ts', 'Log de eventos en una base (Redis por REST; archivo local en desarrollo).'],
  ['app/bitacora/page.tsx', 'Tasa, diferencia en pp y caso fijo: 7,50%, 13,14% y 5,64 pp.'],
]

export default function HomePage() {
  return (
    <main id="contenido" className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-14">
      <p className="font-mono text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
        Laboratorio 01 · resuelto
      </p>
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance md:text-5xl">
        Una landing, dos mensajes, una sola URL indexable.
      </h1>
      <p className="text-lg leading-relaxed text-muted-foreground">
        Taller Norte prueba dos mensajes sobre la misma oferta. La variante se asigna con un hash estable, los metadatos se publican desde el servidor y el canonical es siempre /practica.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/practica" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Abrir la landing
        </Link>
        <Link href="/bitacora" className="rounded-md border border-border px-4 py-2 text-sm">
          Abrir la bitácora
        </Link>
      </div>
      <ol className="flex flex-col gap-4">
        {FILES.map(([path, detail], index) => (
          <li key={path} className="flex flex-col gap-1 border-t border-border pt-3">
            <span className="font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
              0{index + 1}
            </span>
            <code className="font-mono text-sm">{path}</code>
            <span className="text-sm text-muted-foreground">{detail}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
