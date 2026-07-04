'use client'

// COMPLETE screen — terminal state, no restart (per product decision).

import { Trophy } from 'lucide-react'

interface CompleteScreenProps {
  huntTitle: string
  stopCount: number
}

export function CompleteScreen({ huntTitle, stopCount }: CompleteScreenProps) {
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
    </main>
  )
}
