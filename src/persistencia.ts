import type { Categoria, EstadoJogo } from './engine/types'

const CHAVE = 'top10:estado'
const VERSAO = 1

export function salvarEstado(estado: EstadoJogo): void {
  try {
    // O catalogo nao vai para o disco: ele e recarregado do JSON do bundle.
    const { catalogo: _ignorado, ...resto } = estado
    localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO, estado: resto }))
  } catch {
    // Sem espaco ou storage bloqueado: o jogo continua em memoria.
  }
}

export function carregarEstado(catalogo: Categoria[]): EstadoJogo | null {
  const bruto = localStorage.getItem(CHAVE)
  if (bruto === null) return null
  try {
    const envelope = JSON.parse(bruto) as { versao?: number; estado?: unknown }
    if (envelope.versao !== VERSAO || typeof envelope.estado !== 'object' || envelope.estado === null) {
      return null
    }
    return { ...(envelope.estado as Omit<EstadoJogo, 'catalogo'>), catalogo }
  } catch {
    return null
  }
}

export function limparEstado(): void {
  localStorage.removeItem(CHAVE)
}
