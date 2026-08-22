import type {
  Categoria,
  EstadoJogo,
  EstadoRodada,
  FaseJogo,
  RodadaConcluida,
} from './engine/types'

const CHAVE = 'top10:estado'
const VERSAO = 1

const FASES: readonly FaseJogo[] = ['setup', 'em_rodada', 'revelacao', 'decisao_tempo', 'fim_jogo']

type RodadaSerializada = Omit<EstadoRodada, 'categoria'> & { categoriaId: string }

type ConcluidaSerializada = {
  categoriaId: string
  vencedorId: string | null
  abortada: boolean
}

type EstadoSerializado = Omit<EstadoJogo, 'catalogo' | 'rodada' | 'concluidas'> & {
  rodada: RodadaSerializada | null
  concluidas: ConcluidaSerializada[]
}

/**
 * Nem o catalogo nem a categoria da rodada vao para o disco.
 *
 * O catalogo e recarregado do JSON do bundle. Ja a categoria da rodada e o
 * segredo do jogo: ela carrega os 10 itens em ordem de ranking, e o estado e
 * gravado a cada transicao. Se ela fosse embarcada aqui, qualquer jogador
 * poderia abrir o DevTools no meio da rodada e ler a resposta inteira, em
 * ordem. So o `id` atravessa; a lista e reidratada do catalogo na carga.
 */
function serializar(estado: EstadoJogo): EstadoSerializado {
  const { catalogo: _semCatalogo, rodada, concluidas, ...resto } = estado
  return {
    ...resto,
    rodada: rodada === null ? null : serializarRodada(rodada),
    concluidas: concluidas.map((c) => ({
      categoriaId: c.categoria.id,
      vencedorId: c.vencedorId,
      abortada: c.abortada,
    })),
  }
}

function serializarRodada(rodada: EstadoRodada): RodadaSerializada {
  const { categoria, ...resto } = rodada
  return { ...resto, categoriaId: categoria.id }
}

export function salvarEstado(estado: EstadoJogo): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO, estado: serializar(estado) }))
  } catch {
    // Sem espaco ou storage bloqueado: o jogo continua em memoria.
  }
}

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Checagem barata de formato. Um `top10:estado` editado a mao mas ainda
 * parseavel produziria um estado cuja `fase` nao casa com nenhum ramo do
 * `App`, deixando a tela vazia e sem saida. Melhor comecar do zero.
 */
function temFormatoValido(s: Record<string, unknown>): s is EstadoSerializado & Record<string, unknown> {
  if (!FASES.includes(s.fase as FaseJogo)) return false
  if (!Array.isArray(s.jogadores)) return false
  if (!Array.isArray(s.concluidas)) return false
  if (!eObjeto(s.placar)) return false
  if (!eObjeto(s.relogio)) return false
  if (typeof s.encerrarAposRodada !== 'boolean') return false
  if (s.rodada !== null) {
    if (!eObjeto(s.rodada)) return false
    if (typeof s.rodada.categoriaId !== 'string') return false
  }
  return s.concluidas.every(
    (c) => eObjeto(c) && typeof c.categoriaId === 'string' && typeof c.abortada === 'boolean',
  )
}

export function carregarEstado(catalogo: Categoria[]): EstadoJogo | null {
  const bruto = localStorage.getItem(CHAVE)
  if (bruto === null) return null
  try {
    const envelope = JSON.parse(bruto) as { versao?: number; estado?: unknown }
    if (envelope.versao !== VERSAO || !eObjeto(envelope.estado)) return null
    if (!temFormatoValido(envelope.estado)) return null

    const salvo = envelope.estado as EstadoSerializado
    const porId = new Map(catalogo.map((c) => [c.id, c]))

    // Se algum id sumiu (o JSON foi editado entre sessoes), nao da para
    // restaurar meia partida: melhor degradar para um comeco limpo.
    const concluidas: RodadaConcluida[] = []
    for (const c of salvo.concluidas) {
      const categoria = porId.get(c.categoriaId)
      if (categoria === undefined) return null
      concluidas.push({ categoria, vencedorId: c.vencedorId ?? null, abortada: c.abortada })
    }

    let rodada: EstadoRodada | null = null
    if (salvo.rodada !== null) {
      const categoria = porId.get(salvo.rodada.categoriaId)
      if (categoria === undefined) return null
      const { categoriaId: _semId, ...restoRodada } = salvo.rodada
      rodada = { ...restoRodada, categoria }
    }

    const { rodada: _r, concluidas: _c, ...resto } = salvo
    return { ...resto, catalogo, rodada, concluidas }
  } catch {
    return null
  }
}

export function limparEstado(): void {
  localStorage.removeItem(CHAVE)
}
