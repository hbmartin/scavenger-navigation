'use client'

import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BlockedScreenProps {
  reason: 'location' | 'compass'
  onRetry: () => void
}

export function BlockedScreen({ reason, onRetry }: BlockedScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <ShieldAlert className="size-12 text-destructive" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-balance">
          {reason === 'location' ? 'Location access is required' : 'Compass access is required'}
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          The hunt can&apos;t run without it. Re-enable it for this site, then try again.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 text-left">
        <p className="mb-2 font-semibold">How to re-enable</p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">iPhone (Safari):</span> tap{' '}
            <span className="font-mono text-xs">aA</span> in the address bar → Website Settings →
            allow {reason === 'location' ? 'Location' : 'Motion & Orientation'}.
          </li>
          <li>
            <span className="font-medium text-foreground">Android (Chrome):</span> tap the lock icon
            in the address bar → Permissions → allow Location.
          </li>
        </ul>
      </div>

      <Button size="lg" className="h-14 w-full max-w-sm text-lg" onClick={onRetry}>
        Try again
      </Button>
    </main>
  )
}
