'use client'

// COMPLETE screen — terminal state with an explicit restart affordance.

import { RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CompleteScreenProps {
  huntTitle: string
  stopCount: number
  onRestart: () => void
}

export function CompleteScreen({ huntTitle, stopCount, onRestart }: CompleteScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-accent">
        <Trophy className="size-12 text-accent-foreground" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Hunt complete
        </p>
        <h1 className="text-4xl font-bold text-balance">{huntTitle}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          All {stopCount} stops found. Nicely done.
        </p>
      </div>
      <Button size="lg" className="h-14 w-full max-w-sm gap-2 text-lg" onClick={onRestart}>
        <RotateCcw className="size-5" aria-hidden="true" />
        Restart hunt
      </Button>
    </main>
  )
}
