/**
 * Auth compartilhado de vendas.liganer.com.br (/auth/me.php).
 * Outros apps no mesmo domínio podem reutilizar este módulo.
 */
export type VendasUser = {
  id: string
  email: string
  name: string
}

export async function fetchVendasUser(): Promise<VendasUser | null> {
  try {
    const res = await fetch('/auth/me.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ok?: boolean; user?: VendasUser }
    if (!data?.user?.email) return null
    return {
      id: String(data.user.id || data.user.email),
      email: String(data.user.email),
      name: String(data.user.name || data.user.email),
    }
  } catch {
    return null
  }
}

export function vendasLoginUrl(nextPath = window.location.pathname): string {
  return `/login.html?next=${encodeURIComponent(nextPath)}`
}
