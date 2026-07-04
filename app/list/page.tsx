import { HUNT } from '@/lib/hunt-data'

export const metadata = {
  title: `Stop List | ${HUNT.title}`,
}

export default function StopListPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Hidden stop index
          </p>
          <h1 className="text-3xl font-bold text-balance">{HUNT.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {HUNT.stops.length} stops in hunt order.
          </p>
        </header>

        <ol className="flex flex-col gap-3">
          {HUNT.stops.map((stop, index) => {
            const radiusMeters = stop.radiusMeters ?? HUNT.arrivalRadiusMeters

            return (
              <li
                key={`${stop.name}-${index}`}
                className="rounded-md border border-border bg-card p-4 text-card-foreground"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm text-primary-foreground"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-balance">{stop.name}</h2>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Latitude</dt>
                        <dd className="font-mono">{stop.lat.toFixed(6)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Longitude</dt>
                        <dd className="font-mono">{stop.lng.toFixed(6)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Radius</dt>
                        <dd className="font-mono">{radiusMeters}m</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </main>
  )
}
