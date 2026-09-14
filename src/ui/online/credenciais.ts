export type Credenciais = { jogadorId: string; token: string }

const chave = (codigo: string) => `top10:sala:${codigo}`

export function lerCredenciais(codigo: string): Credenciais | null {
  try {
    const bruto = localStorage.getItem(chave(codigo))
    if (!bruto) return null
    const v = JSON.parse(bruto) as Partial<Credenciais>
    return typeof v.jogadorId === 'string' && typeof v.token === 'string' ? { jogadorId: v.jogadorId, token: v.token } : null
  } catch {
    return null
  }
}

export function salvarCredenciais(codigo: string, c: Credenciais): void {
  try {
    localStorage.setItem(chave(codigo), JSON.stringify(c))
  } catch {
    // sem storage: a sessao dura ate recarregar a pagina
  }
}

export function limparCredenciais(codigo: string): void {
  try {
    localStorage.removeItem(chave(codigo))
  } catch {
    // nada a fazer
  }
}
