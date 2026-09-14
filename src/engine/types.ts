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
  | { tipo: 'palpite'; texto: string; jogadorId: string }
  | { tipo: 'ninguem_duvidou' }
  | { tipo: 'duvidar'; duvidadorId: string }

export type ErroRodada =
  | 'palpite_vazio'
  | 'palpite_duplicado'
  | 'fase_invalida'
  | 'duvidador_invalido'
  | 'jogador_invalido'

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
  | { tipo: 'adicionar_jogador'; jogador: Jogador }

export type ResultadoJogo =
  | { ok: true; estado: EstadoJogo }
  | { ok: false; erro: ErroRodada | 'acao_invalida'; estado: EstadoJogo }

/** Categoria como o cliente pode ve-la: `itens` so existe depois da revelacao. */
export type CategoriaVisivel = {
  id: string
  titulo: string
  fonte: string
  itens?: ItemCategoria[]
}

export type RodadaVisivel = Omit<EstadoRodada, 'categoria'> & { categoria: CategoriaVisivel }

/**
 * Subconjunto de EstadoJogo que as telas leem. EstadoJogo e atribuivel a
 * EstadoVisivel; a visao publica online tambem. Assim as mesmas telas servem
 * o modo de um dispositivo e o modo online.
 */
export type EstadoVisivel = {
  fase: FaseJogo
  jogadores: Jogador[]
  placar: Record<string, number>
  relogio: EstadoRelogio
  rodada: RodadaVisivel | null
  concluidas: RodadaConcluida[]
  encerrarAposRodada: boolean
}

export type PodeAgir = { palpite: boolean; duvidar: boolean; host: boolean }

export type VisaoJogo = EstadoVisivel & {
  jogadorId: string
  categoriasDisponiveis: { id: string; titulo: string }[]
  podeAgir: PodeAgir
}
