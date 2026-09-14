import type { EstadoJogo, ModoDuracao, AcaoJogo, VisaoJogo } from '../engine/types'

export type JogadorSala = { id: string; apelido: string; token: string; ultimoPollEm: number }

export type Sala = {
  codigo: string
  hostId: string
  jogadores: JogadorSala[]
  jogo: Omit<EstadoJogo, 'catalogo'> | null
  versao: number
  criadaEm: number
  atualizadaEm: number
}

export type AcaoSala =
  | { tipo: 'iniciar_partida'; modo: ModoDuracao }
  | { tipo: 'entrar_na_partida' }
  | Exclude<AcaoJogo, { tipo: 'configurar' } | { tipo: 'adicionar_jogador' } | { tipo: 'tick' }>

export type VisaoSala = {
  codigo: string
  hostId: string
  jogadorId: string
  ehHost: boolean
  jogadores: { id: string; apelido: string }[]
  jogo: VisaoJogo | null
}

export type ErroServidor =
  | 'corpo_invalido'
  | 'token_invalido'
  | 'nao_autorizado'
  | 'sala_inexistente'
  | 'versao_desatualizada'
  | 'apelido_em_uso'
  | 'acao_rejeitada'
  | 'store_indisponivel'
  | 'corpo_grande'

export type Geradores = {
  novoId(): string
  novoToken(): string
  novoCodigo(): string
}

export const TTL_SALA_MS = 6 * 60 * 60 * 1000
export const HOST_AUSENTE_MS = 30_000
