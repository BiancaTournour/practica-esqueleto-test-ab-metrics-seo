'use client'

import { useState, useTransition } from 'react'
import { recordConversion, type ConversionStatus } from '@/app/practica/actions'

const MESSAGES: Record<ConversionStatus, string> = {
  recorded: 'Listo: tu lugar quedó anotado.',
  duplicate: 'Ya habías hecho clic antes. No se suma otra conversión.',
  ignored: 'No se anotó: este navegador no tiene un visitante asignado.',
  error: 'No pudimos anotar el clic. Probá de nuevo en un momento.',
}

type CtaProps = {
  label: string
  /** En ?preview= el botón se ve y se puede tocar, pero no anota nada. */
  preview?: boolean
}

export function Cta({ label, preview = false }: CtaProps) {
  const [status, setStatus] = useState<ConversionStatus | 'preview' | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (preview) {
            setStatus('preview')
            return
          }
          startTransition(async () => {
            const result = await recordConversion()
            setStatus(result.status)
          })
        }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {label}
      </button>
      <p className="max-w-md text-sm text-muted-foreground" role="status" aria-live="polite">
        {status === 'preview'
          ? 'Vista previa: este clic no cuenta como conversión.'
          : status
            ? MESSAGES[status]
            : preview
              ? 'Vista previa: el botón no anota conversiones.'
              : ''}
      </p>
    </div>
  )
}
