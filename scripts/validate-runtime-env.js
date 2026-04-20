const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
]

const RECOMMENDED_ENV_VARS = [
  "DIRECT_URL",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "ENABLE_DETAILED_PROD_ERRORS",
]

function hasValue(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0
}

function isLikelyUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function isLikelyPostgresUrl(value) {
  return /^(postgres|postgresql):\/\//.test(value)
}

const missingRequired = REQUIRED_ENV_VARS.filter((name) => !hasValue(name))
const missingRecommended = RECOMMENDED_ENV_VARS.filter((name) => !hasValue(name))
const validationErrors = []

if (hasValue("NEXT_PUBLIC_SUPABASE_URL") && !isLikelyUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  validationErrors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL.")
}

if (hasValue("DATABASE_URL") && !isLikelyPostgresUrl(process.env.DATABASE_URL)) {
  validationErrors.push("DATABASE_URL must be a valid postgres connection string.")
}

if (hasValue("DIRECT_URL") && !isLikelyPostgresUrl(process.env.DIRECT_URL)) {
  validationErrors.push("DIRECT_URL must be a valid postgres connection string when provided.")
}


if (missingRequired.length > 0 || validationErrors.length > 0) {
  console.error("[startup] Runtime environment validation failed.")

  if (missingRequired.length > 0) {
    console.error(`[startup] Missing required env vars: ${missingRequired.join(", ")}`)
  }

  for (const error of validationErrors) {
    console.error(`[startup] ${error}`)
  }

  console.error("[startup] In Dokploy, set NEXT_PUBLIC_* values in both Build Arguments and Environment Variables.")
  console.error("[startup] DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be available at runtime.")
  process.exit(1)
}

console.log(`[startup] Required env vars present: ${REQUIRED_ENV_VARS.join(", ")}`)

if (hasValue("ENABLE_DETAILED_PROD_ERRORS")) {
  console.warn(`[startup] ENABLE_DETAILED_PROD_ERRORS=${process.env.ENABLE_DETAILED_PROD_ERRORS}`)
}

if (missingRecommended.length > 0) {
  console.warn(`[startup] Recommended env vars missing: ${missingRecommended.join(", ")}`)
}

console.log("[startup] Runtime environment validation passed.")
