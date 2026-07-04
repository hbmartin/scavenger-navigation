'use client'

import { Compass, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PermissionGateProps {
  huntTitle: string
  requesting: boolean
  onEnable: () => void
}

export function PermissionGate({ huntTitle, requesting, onEnable }: PermissionGateProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Scavenger Navigation
        </p>
        <h1 className="text-3xl font-bold text-balance">{huntTitle}</h1>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 text-left">
          <MapPin className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Location</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tracks your distance to each hidden stop.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 text-left">
          <Compass className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Compass</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Rotates the arrow so it points at the target in real space.
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" className="h-14 w-full text-lg" onClick={onEnable} disabled={requesting}>
          {requesting ? 'Waiting for permissions…' : 'Enable location & compass'}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your phone will ask twice — allow both. Nothing is sent anywhere; everything runs on your
          device.
        </p>
      </div>
    </main>
  )
}
