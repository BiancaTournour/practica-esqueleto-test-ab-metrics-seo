import type { Metadata } from 'next'
import Link from 'next/link'
import {
  HASH_EXAMPLE_ID,
  HASH_NAME,
  TEST_CASE,
  VARIANTS,
  assignVariant,
  conversionRate,
  emptyLog,
  formatCount,
  formatPoints,
  formatRate,
  rateGap,
  type ExperimentLog,
  type Variant,
} from '@/lib/experiment'
import { getStore } from '@/lib/store'

export const metadata: Metadata = {
  title: 'Bitácora',
  robots: { index: false, follow: false },
}

// La parte "en vivo" lee la base en cada request.
export const dynamic = 'force-dynamic'

const ROWS: Variant[] = ['a', 'b']

function StatsTable({ log, caption }: { log: ExperimentLog; caption: string }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="mb-3 text-left text-muted-foreground">{caption}</caption>
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 font-medium">Variante</th>
          <th className="py-2 font-medium">Impresiones</th>
          <th className="py-2 font-medium">Conversiones</th>
          <th className="py-2 font-medium">Tasa</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((variant) => (
          <tr key={variant} className="border-b border-border">
            <td className="py-3">
              {variant.toUpperCase()} · {VARIANTS[variant].name}
            </td>
            <td className="py-3 font-mono">{formatCount(log[variant].impressions)}</td>
            <td className="py-3 font-mono">{formatCount(log[variant].conversions)}</td>
            {/* La tasa sale de la fórmula (conversiones / impresiones), nunca de un texto fijo. */}
            <td className="py-3 font-mono">{formatRate(conversionRate(log[variant]))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

async function readLiveLog(): Promise<{ log: ExperimentLog; driver: string; error: boolean }> {
  try {
    const store = getStore()
    return { log: await store.readLog(), driver: store.driver, error: false }
  } catch (error) {
    console.error('[lab01] no se pudo leer la base', error)
    return { log: emptyLog(), driver: 'sin conexión', error: true }
  }
}

export default async function BitacoraPage() {
  const live = await readLiveLog()

  // La asignación se verifica: mismo id, mismo resultado, las veces que se repita.
  const demoRuns = Array.from({ length: 5 }, () => assignVariant(HASH_EXAMPLE_ID))
  const demoStable = demoRuns.every((v) => v === demoRuns[0])

  return (
    <main id="contenido" className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
      <p className="font-mono text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
        Bitácora del experimento
      </p>
      <h1 className="max-w-2xl font-serif text-4xl tracking-tight text-balance md:text-5xl">
        Impresiones, conversiones y tasa por variante.
      </h1>
      <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Tasa = conversiones / impresiones. Sin impresiones la tasa no existe, y se muestra como Pendiente, no como 0%.
        Esta página muestra una diferencia, no una prueba: no declara ganador.
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl">Caso de prueba fijo</h2>
        <StatsTable
          log={TEST_CASE}
          caption="Cohorte fija, igual aunque nadie haya entrado. A 18 / 240, B 31 / 236."
        />
        <p className="font-mono text-sm">B − A = {formatPoints(rateGap(TEST_CASE))}</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl">Log real de este sitio</h2>
        <StatsTable
          log={live.log}
          caption={
            live.error
              ? 'No se pudo leer la base. Se muestra vacío.'
              : `Leído de la base (${live.driver}). Una impresión por sesión de 30 minutos, una conversión por visitante.`
          }
        />
        <p className="font-mono text-sm">B − A = {formatPoints(rateGap(live.log))}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl">Asignación estable</h2>
        <p className="font-mono text-sm">
          assignVariant({`'${HASH_EXAMPLE_ID}'`}) → {demoRuns[0].toUpperCase()}
        </p>
        <p className="font-mono text-sm text-muted-foreground">
          5 repeticiones: {demoRuns.map((v) => v.toUpperCase()).join(' ')} ·{' '}
          {demoStable ? 'sin cambios' : 'INESTABLE'}
        </p>
        <p className="text-sm text-muted-foreground">Función de hash: {HASH_NAME}.</p>
      </section>

      <Link href="/practica" prefetch={false} className="text-sm text-muted-foreground underline">
        Volver a la landing
      </Link>
    </main>
  )
}
