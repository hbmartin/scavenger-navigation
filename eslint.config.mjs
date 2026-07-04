import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts', 'public/sw.js']),
  nextVitals,
  nextTs,
  {
    rules: {
      // Allow intentionally-unused underscore-prefixed bindings (e.g. the
      // next/font calls in app/layout.tsx, kept for their side effect).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
])
