// Hardcoded hunt data. Edit this file to change the hunt (PRD §5).
// The order of Hunt.stops defines the hunt sequence.
// Coordinates below were imported from the Melrose Avenue street art walk CSV.

export interface Stop {
  name: string // revealed only on arrival
  lat: number
  lng: number
  hint?: string // optional navigation hint
  photoUrl?: string // optional arrival photo
  description?: string // optional arrival description
  radiusMeters?: number // optional per-stop override
}

export interface Hunt {
  id: string
  title: string
  arrivalRadiusMeters: number
  stops: Stop[]
}

export function getStopSlug(stop: Pick<Stop, 'name'>): string {
  return stop.name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const HUNT: Hunt = {
  id: 'art-day-on-melrose-melrose-avenue-street-art-walk-v1',
  title: 'Art Day on Melrose: Melrose Avenue Street Art Walk',
  arrivalRadiusMeters: 12,
  stops: [
    {
      name: 'Sons & Daughters Bookshop',
      hint: '🧑‍🧑‍🧒‍🧒📖',
      description: 'Founded in 2024, Sons and Daughters started as an online bookstore and is now a physical storefront.',
      photoUrl: 'https://sonsanddaughtersbooks.com/cdn/shop/files/SonsAndDaughters_Logomark_6caf5afe-24a8-4e84-a4ce-92dd4c3b5542.png?v=1715841734&width=1100',
      lat: 34.0838724,
      lng: -118.3600728,
    },
    {
      name: 'Sportie LA Yard Murals',
      hint: '👟',
      lat: 34.08387,
      lng: -118.3585404,
      description:
        'Artists: Corie Mattie, Artlord, Dirt Cobain / various artists. Yard murals at Sportie LA, 7753 Melrose Ave (Ogden/Genesee). North side.',
    },
    {
      name: 'HVW8 Art + Design Gallery',
      hint: '🖼️',
      photoUrl: 'https://hvw8.com/wp-content/uploads/2020/12/logo-inverted.png',
      description: 'Founded in Montréal in 1998, HVW8 Art + Design Gallery is an art gallery in Los Angeles, with a Berlin presence as well.',
      lat: 34.083438,
      lng: -118.3574537,
    },
    {
      name: 'Typhoon Murals',
      lat: 34.0838378,
      lng: -118.35537,
      photoUrl: 'https://melroseartsdistrict.com/wp-content/uploads/2023/02/4-N-Curson-Rasmus-Balstrom.jpg',
      hint: '🌪️',
      description:
        'Artists: Balstroehm / HiJack. North side of Melrose Ave between Curson Ave and Sierra Bonita Ave.',
    },
    {
      name: 'Kobe Bryan/Nipsey Hussle',
      hint: '🏀',
      photoUrl: 'https://melroseartsdistrict.com/wp-content/uploads/2023/02/6-Alec-Monopoly.jpg',
      lat: 34.0838045,
      lng: -118.354342,
      description:
        'Artists: Pastey White, The 169, WRDSMTH, Mr. Romano / local artists. North side of Melrose Ave near Sierra Bonita Ave.',
    },
    {
      name: 'Mauro Cafe',
      photoUrl: 'https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/37b871c9-1d9a-584f-ba86-19407ca3c292/d1d3938e-c060-561f-b224-1e83e6d54654.jpg',
      hint: '🇮🇹🍷',
      lat: 34.0837271,
      lng: -118.352824,
    },
    {
      name: 'Monopoly Man',
      hint: '_____ Deal',
      lat: 34.0833677,
      lng: -118.3523132,
    },
    {
      name: 'Alleyway Murals (South Fuller)',
      photoUrl: 'https://melroseartsdistrict.com/wp-content/uploads/2023/02/16-Cant-Read-Name.jpg',
      lat: 34.0832355,
      lng: -118.3499154,
      description: 'Artists: various. South-side alley of Melrose Ave near Fuller Ave.',
    },
    {
      name: 'Alleyway Mural (Ronan)',
      hint: '💐',
      photoUrl: 'https://melroseartsdistrict.com/wp-content/uploads/2023/02/12-David-Flores.jpg',
      lat: 34.0837945,
      lng: -118.3493445,
      description:
        'Artists: CBS Crew, WCA and MTA Crews. Alley on the north side of Melrose Ave between Fuller Ave and Poinsettia Pl.',
    },
    {
      name: "Lala's Argentine (Wine)",
      hint: '🇦🇷🍷',
      photoUrl: 'https://lalasgrill.com/images/lalas-logo-l.png',
      lat: 34.0836986,
      lng: -118.3473872,
    },
    {
      name: 'Daybird',
      hint: '🐤',
      description: 'Szechuan Fried Chicken!',
      lat: 34.0836419,
      lng: -118.3468362,
    },
    {
      name: 'Dragon Mural',
      hint: '🍜🐉',
      photoUrl: 'https://melroseartsdistrict.com/wp-content/uploads/2023/02/14-Dragon-David-Flores.jpg',
      lat: 34.0836856,
      lng: -118.3446031,
      description: 'Artist: David Flores. North side of Melrose Ave near La Brea Ave.',
    },
    {
      name: 'Hollywood Books + Galerie Half',
      hint: '📚',
      photoUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFENTguJvcnvl27xhrUqiQCfwiaxzK5x9fNBxE4k0_jS_yxmv7TmHxU2CjXZRZfZAHvWBjKxPWAn8rMWE-6jzW41pvd2lgxQsARS_8tR7U1MmRJFsIRrFuN2yhjYJ3KXvzH0lWGMTiqwLQ=s1360-w1360-h1020-rw',
      lat: 34.0835406,
      lng: -118.3422818,
    },
    {
      name: 'KP Projects',
      hint: '🖼️',
      description: 'KP Projects is a contemporary art gallery in Los Angeles that focuses on pop‑surrealism, contemporary painting and photography and regularly hosts exhibitions and openings.',
      photoUrl:'https://static.where-e.com/United_States/Kp-Projects-Merry-Karnowsky-Gallery_f36aebae71a16260cd29271bf4a89bdb.jpg',
      lat: 34.0828621,
      lng: -118.3442058,
    },
    {
      name: 'Generation8',
      hint: '🎉',
      description: '🐇',
      lat: 34.0833508,
      lng: -118.3468245,
    },
  ],
}

// ---- Tuning constants (PRD §6.6, §11, §12) ----

/** Consecutive in-radius fixes required before completing a stop. */
export const DEBOUNCE_FIX_COUNT = 3

/**
 * Trust a sub-radius fix only when reported accuracy ≤ multiplier × radius.
 * iOS accuracy is quantized and jumpy; loosen toward 2× (or higher) if the
 * geofence rarely fires outdoors (PRD §12).
 */
export const ACCURACY_GATE_MULTIPLIER = 1.5

/** LA magnetic declination — applied on Android when heading is magnetic (PRD §7.4). */
export const DECLINATION_DEG = 11.5

/** Exponential smoothing alphas. */
export const DISTANCE_SMOOTHING_ALPHA = 0.35
export const HEADING_SMOOTHING_ALPHA = 0.3
