import { HOST_AUSENTE_MS, type AcaoSala, type Sala } from './tipos'

export function ehHostEfetivo(sala: Sala, jogadorId: string, agora: number): boolean {
  if (sala.hostId === jogadorId) return true
  const host = sala.jogadores.find((j) => j.id === sala.hostId)
  if (!host) return true
  return agora - host.ultimoPollEm > HOST_AUSENTE_MS
}

export function podeExecutar(sala: Sala, jogadorId: string, acao: AcaoSala, agora: number): boolean {
  switch (acao.tipo) {
    case 'iniciar_partida':
    case 'iniciar_rodada':
    case 'avancar':
    case 'decidir_expiracao':
      return ehHostEfetivo(sala, jogadorId, agora)
    case 'entrar_na_partida':
      return true
    case 'rodada':
      if (acao.acao.tipo === 'palpite') return acao.acao.jogadorId === jogadorId
      if (acao.acao.tipo === 'duvidar') return acao.acao.duvidadorId === jogadorId
      return false // ninguem_duvidou nao existe online: o proximo palpite fecha a janela
  }
}
