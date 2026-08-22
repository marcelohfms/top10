import type { EstadoRelogio, ModoDuracao } from './types'

const MS_POR_MINUTO = 60_000

export function criarRelogio(modo: ModoDuracao): EstadoRelogio {
  return { modo, iniciadoEm: null, pausadoEm: null, msPausados: 0, expirado: false }
}

export function iniciarRelogio(r: EstadoRelogio, agora: number): EstadoRelogio {
  if (r.iniciadoEm !== null) return r
  return { ...r, iniciadoEm: agora }
}

export function pausarRelogio(r: EstadoRelogio, agora: number): EstadoRelogio {
  if (r.pausadoEm !== null) return r
  return { ...r, pausadoEm: agora }
}

export function retomarRelogio(r: EstadoRelogio, agora: number): EstadoRelogio {
  if (r.pausadoEm === null) return r
  return { ...r, pausadoEm: null, msPausados: r.msPausados + (agora - r.pausadoEm) }
}

export function msDecorridos(r: EstadoRelogio, agora: number): number {
  if (r.iniciadoEm === null) return 0
  const fim = r.pausadoEm ?? agora
  return Math.max(0, fim - r.iniciadoEm - r.msPausados)
}

export function msRestantes(r: EstadoRelogio, agora: number): number | null {
  if (r.modo.tipo !== 'tempo') return null
  const limite = r.modo.minutos * MS_POR_MINUTO
  return Math.max(0, limite - msDecorridos(r, agora))
}

export function verificarExpiracao(r: EstadoRelogio, agora: number): EstadoRelogio {
  if (r.expirado) return r
  if (r.modo.tipo !== 'tempo') return r
  if (r.pausadoEm !== null) return r
  const restante = msRestantes(r, agora)
  if (restante !== null && restante <= 0) return { ...r, expirado: true }
  return r
}
