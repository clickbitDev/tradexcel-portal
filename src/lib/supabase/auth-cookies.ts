type CookieLike = {
    name: string
}

export function hasSupabaseAuthCookies(cookies: CookieLike[]): boolean {
    return cookies.some(({ name }) => name.includes('sb-') && (name.includes('auth') || name.includes('token')))
}
