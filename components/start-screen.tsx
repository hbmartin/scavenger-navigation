'use client'

import { Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StartScreenProps {
  huntTitle: string
  stopCount: number
  onStart: () => void
}

export function StartScreen({ huntTitle, stopCount, onStart }: StartScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary">
          <Navigation className="size-10 text-primary-foreground" aria-hidden="true" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Scavenger Navigation
        </p>
        <h1 className="text-4xl font-bold text-balance">{huntTitle}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          {stopCount} hidden stops. Follow the arrow, watch the distance drop, and get within 25
          meters to reveal each one.
        </p>
      </div>
      <Button size="lg" className="h-14 w-full max-w-sm text-lg" onClick={onStart}>
        Start the hunt
      </Button>
    </main>
  )
}
