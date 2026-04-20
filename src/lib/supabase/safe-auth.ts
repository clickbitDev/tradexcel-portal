type AuthCapableClient = {
  auth: {
    getUser: (...args: any[]) => Promise<any>
    getSession: (...args: any[]) => Promise<any>
  }
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}

async function buildFallbackUserResult(getSession: AuthCapableClient['auth']['getSession'], context: string, error: unknown) {
  console.error(`[SupabaseAuth:${context}] getUser threw`, formatError(error))

  try {
    const sessionResult = await getSession()
    const sessionUser = sessionResult?.data?.session?.user ?? null

    if (sessionUser) {
      console.warn(`[SupabaseAuth:${context}] Falling back to session-backed user lookup.`)
    }

    return {
      data: {
        user: sessionUser,
      },
      error: sessionResult?.error ?? null,
    }
  } catch (sessionError) {
    console.error(`[SupabaseAuth:${context}] getSession fallback threw`, formatError(sessionError))

    return {
      data: {
        user: null,
      },
      error: error instanceof Error ? error : new Error('Supabase auth lookup failed'),
    }
  }
}

export async function safeGetUser<TClient extends AuthCapableClient>(client: TClient, context: string, ...args: any[]) {
  const getUser = client.auth.getUser.bind(client.auth)
  const getSession = client.auth.getSession.bind(client.auth)

  try {
    return await getUser(...args)
  } catch (error) {
    return buildFallbackUserResult(getSession, context, error)
  }
}

export function withSafeGetUser<TClient extends AuthCapableClient>(client: TClient, context: string): TClient {
  const getUser = client.auth.getUser.bind(client.auth)
  const getSession = client.auth.getSession.bind(client.auth)

  ;(client.auth as { getUser: (...args: any[]) => Promise<any> }).getUser = async (...args: any[]) => {
    try {
      return await getUser(...args)
    } catch (error) {
      return buildFallbackUserResult(getSession, context, error)
    }
  }

  return client
}
