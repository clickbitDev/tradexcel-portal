import { getPublicRuntimeEnv } from '@/lib/public-env'

export function RuntimePublicEnvScript() {
  const publicEnv = getPublicRuntimeEnv()
  const serializedEnv = JSON.stringify(publicEnv).replace(/</g, '\\u003c')

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__PUBLIC_ENV__ = Object.assign(window.__PUBLIC_ENV__ || {}, ${serializedEnv});`,
      }}
      id="runtime-public-env"
    />
  )
}
