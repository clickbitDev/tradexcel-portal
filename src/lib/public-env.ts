export const PUBLIC_RUNTIME_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
] as const

export type PublicRuntimeEnvKey = (typeof PUBLIC_RUNTIME_ENV_KEYS)[number]

export type PublicRuntimeEnv = Partial<Record<PublicRuntimeEnvKey, string>>

declare global {
  interface Window {
    __PUBLIC_ENV__?: PublicRuntimeEnv
  }
}

export function readEnvValue(name: string): string | undefined {
  const value = process.env[name]

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getPublicRuntimeEnv(): PublicRuntimeEnv {
  return PUBLIC_RUNTIME_ENV_KEYS.reduce<PublicRuntimeEnv>((accumulator, key) => {
    const value = readEnvValue(key)

    if (value) {
      accumulator[key] = value
    }

    return accumulator
  }, {})
}

export function getPublicEnvValue(key: PublicRuntimeEnvKey): string | undefined {
  const buildTimeValue = readEnvValue(key)

  if (buildTimeValue) {
    return buildTimeValue
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  const runtimeValue = window.__PUBLIC_ENV__?.[key]
  return typeof runtimeValue === 'string' && runtimeValue.trim().length > 0
    ? runtimeValue.trim()
    : undefined
}
