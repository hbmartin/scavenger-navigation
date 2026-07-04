'use client'

// ARRIVED reveal: name + photo, gate to next stop (PRD §6.7).

import { useState } from 'react'
import { CheckCircle2, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Stop } from '@/lib/hunt-data'

interface ArrivedScreenProps {
  stop: Stop
  stopNumber: number
  stopCount: number
  isLast: boolean
  onNext: () => void
}

export function ArrivedScreen({ stop, stopNumber, stopCount, isLast, onNext }: ArrivedScreenProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-3">
        <CheckCircle2 className="size-12 text-accent" aria-hidden="true" />
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Stop {stopNumber} of {stopCount} found
        </p>
        <h1 className="text-3xl font-bold text-balance">{stop.name}</h1>
      </div>

      {stop.photoUrl && (
        <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card">
          {imageFailed ? (
            <div className="flex aspect-square flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="size-10" aria-hidden="true" />
              <p className="text-sm">Photo unavailable</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stop.photoUrl}
              alt={`Photo of ${stop.name}`}
              className="aspect-square w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>
      )}

      {stop.description && (
        <p className="w-full max-w-sm text-pretty text-base leading-relaxed text-muted-foreground">
          {stop.description}
        </p>
      )}

      <Button size="lg" className="h-14 w-full max-w-sm text-lg" onClick={onNext}>
        {isLast ? 'Finish' : 'Next stop'}
      </Button>
    </main>
  )
}
