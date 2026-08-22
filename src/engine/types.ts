export type ItemCategoria = {
  nome: string
  apelidos: string[]
}

export type Categoria = {
  id: string
  titulo: string
  fonte: string
  itens: ItemCategoria[]
}

export type Jogador = { id: string; nome: string }

export type Palpite = {
  texto: string
  autorId: string
  resultado: 'pendente' | 'confirmado' | 'refutado'
}

export type FaseRodada = 'palpite' | 'janela_duvida' | 'fim_rodada'

export type EventoRodada =
  | { tipo: 'eliminado_por_duvida_certa'; eliminadoId: string; duvidadorId: string; palpite: string }
  | { tipo: 'eliminado_por_duvida_errada'; eliminadoId: string; autorId: string; palpite: string }

export type EstadoRodada = {
  categoria: Categoria
  fase: FaseRodada
  ordem: string[]
  vivos: string[]
  eliminados: string[]
  vezDe: string
  palpites: Palpite[]
  ultimoEvento: EventoRodada | null
  vencedorId: string | null
  abortada: boolean
}

export type AcaoRodada =
  | { tipo: 'palpite'; texto: string }
  | { tipo: 'ninguem_duvidou' }
  | { tipo: 'duvidar'; duvidadorId: string }

export type ErroRodada =
  | 'palpite_vazio'
  | 'palpite_duplicado'
  | 'fase_invalida'
  | 'duvidador_invalido'

export type ResultadoRodada =
  | { ok: true; estado: EstadoRodada }
  | { ok: false; erro: ErroRodada; estado: EstadoRodada }

export type ModoDuracao =
  | { tipo: 'categorias'; quantidade: number }
  | { tipo: 'tempo'; minutos: number }

export type EstadoRelogio = {
  modo: ModoDuracao
  iniciadoEm: number | null
  pausadoEm: number | null
  msPausados: number
  expirado: boolean
}

export type FaseJogo = 'setup' | 'em_rodada' | 'revelacao' | 'decisao_tempo' | 'fim_jogo'

export type RodadaConcluida = {
  categoria: Categoria
  vencedorId: string | null
  abortada: boolean
}

export type EstadoJogo = {
  fase: FaseJogo
  catalogo: Categoria[]
  jogadores: Jogador[]
  placar: Record<string, number>
  relogio: EstadoRelogio
  rodada: EstadoRodada | null
  concluidas: RodadaConcluida[]
  encerrarAposRodada: boolean
  faseAntesDaDecisao: FaseJogo | null
}

export type AcaoJogo =
  | { tipo: 'configurar'; jogadores: Jogador[]; modo: ModoDuracao }
  | { tipo: 'iniciar_rodada'; categoriaId: string }
  | { tipo: 'rodada'; acao: AcaoRodada }
  | { tipo: 'tick' }
  | { tipo: 'decidir_expiracao'; decisao: 'encerrar' | 'terminar_categoria' }
  | { tipo: 'avancar' }

export type ResultadoJogo =
  | { ok: true; estado: EstadoJogo }
  | { ok: false; erro: ErroRodada | 'acao_invalida'; estado: EstadoJogo }
