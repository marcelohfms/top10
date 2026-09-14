import { aplicarAcaoJogo, criarJogo } from '../engine/jogo'
import { normalizar } from '../engine/normalizar'
import { visaoPublica } from '../engine/visao'
import type { AcaoJogo, Categoria, EstadoJogo } from '../engine/types'
import { ehHostEfetivo, podeExecutar } from './autorizacao'
import type { AcaoSala, ErroServidor, Geradores, JogadorSala, Sala, VisaoSala } from './tipos'

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: ErroServidor; detalhe?: string }

export function criarSala(apelido: string, agora: number, g: Geradores): { sala: Sala; jogador: JogadorSala } {
  const jogador: JogadorSala = { id: g.novoId(), apelido: apelido.trim(), token: g.novoToken(), ultimoPollEm: agora }
  const sala: Sala = {
    codigo: g.novoCodigo(),
    hostId: jogador.id,
    jogadores: [jogador],
    jogo: null,
    versao: 1,
    criadaEm: agora,
    atualizadaEm: agora,
  }
  return { sala, jogador }
}

export function entrarNaSala(sala: Sala, apelido: string, agora: number, g: Geradores): Resultado<{ sala: Sala; jogador: JogadorSala }> {
  const limpo = apelido.trim()
  if (limpo === '') return { ok: false, erro: 'corpo_invalido', detalhe: 'apelido vazio' }
  const alvo = normalizar(limpo)
  if (sala.jogadores.some((j) => normalizar(j.apelido) === alvo)) {
    return { ok: false, erro: 'apelido_em_uso' }
  }
  const jogador: JogadorSala = { id: g.novoId(), apelido: limpo, token: g.novoToken(), ultimoPollEm: agora }
  return {
    ok: true,
    valor: {
      sala: { ...sala, jogadores: [...sala.jogadores, jogador], versao: sala.versao + 1, atualizadaEm: agora },
      jogador,
    },
  }
}

export function autenticar(sala: Sala, jogadorId: string, token: string): boolean {
  const j = sala.jogadores.find((x) => x.id === jogadorId)
  return j !== undefined && j.token === token
}

function hidratar(sala: Sala, catalogo: Categoria[]): EstadoJogo | null {
  return sala.jogo === null ? null : { ...sala.jogo, catalogo }
}

function desidratar(jogo: EstadoJogo): Omit<EstadoJogo, 'catalogo'> {
  const { catalogo: _c, ...resto } = jogo
  return resto
}

export function montarVisao(sala: Sala, jogadorId: string, agora: number, catalogo: Categoria[]): VisaoSala {
  const ehHost = ehHostEfetivo(sala, jogadorId, agora)
  const jogo = hidratar(sala, catalogo)
  return {
    codigo: sala.codigo,
    hostId: sala.hostId,
    jogadorId,
    ehHost,
    jogadores: sala.jogadores.map((j) => ({ id: j.id, apelido: j.apelido })),
    jogo: jogo === null ? null : visaoPublica(jogo, jogadorId, ehHost),
  }
}

function registrarPoll(sala: Sala, jogadorId: string, agora: number): Sala {
  return {
    ...sala,
    jogadores: sala.jogadores.map((j) => (j.id === jogadorId ? { ...j, ultimoPollEm: agora } : j)),
  }
}

/** Le a sala para um jogador. Registra presenca e, no modo por tempo, aplica o tick. */
export function lerSala(sala: Sala, jogadorId: string, agora: number, catalogo: Categoria[]): { sala: Sala; visao: VisaoSala } {
  let atual = registrarPoll(sala, jogadorId, agora)
  const jogo = hidratar(atual, catalogo)
  if (jogo !== null && jogo.relogio.modo.tipo === 'tempo') {
    const r = aplicarAcaoJogo(jogo, { tipo: 'tick' }, agora)
    if (r.ok && r.estado !== jogo) {
      atual = { ...atual, jogo: desidratar(r.estado), versao: atual.versao + 1, atualizadaEm: agora }
    }
  }
  return { sala: atual, visao: montarVisao(atual, jogadorId, agora, catalogo) }
}

function traduzir(sala: Sala, acao: AcaoSala, jogadorId: string): AcaoJogo {
  if (acao.tipo === 'iniciar_partida') {
    return {
      tipo: 'configurar',
      jogadores: sala.jogadores.map((j) => ({ id: j.id, nome: j.apelido })),
      modo: acao.modo,
    }
  }
  if (acao.tipo === 'entrar_na_partida') {
    const j = sala.jogadores.find((x) => x.id === jogadorId)!
    return { tipo: 'adicionar_jogador', jogador: { id: j.id, nome: j.apelido } }
  }
  return acao
}

export function aplicarAcaoNaSala(
  sala: Sala,
  jogadorId: string,
  acao: AcaoSala,
  agora: number,
  catalogo: Categoria[],
): Resultado<{ sala: Sala; visao: VisaoSala }> {
  if (!podeExecutar(sala, jogadorId, acao, agora)) return { ok: false, erro: 'nao_autorizado' }

  if (acao.tipo === 'iniciar_partida') {
    const jogoAtual = hidratar(sala, catalogo)
    if (jogoAtual !== null && jogoAtual.fase !== 'fim_jogo') {
      return { ok: false, erro: 'acao_rejeitada', detalhe: 'partida_em_andamento' }
    }
  }

  const jogo =
    acao.tipo === 'iniciar_partida'
      ? criarJogo(catalogo)
      : hidratar(sala, catalogo) ?? criarJogo(catalogo)
  const r = aplicarAcaoJogo(jogo, traduzir(sala, acao, jogadorId), agora)
  if (!r.ok) return { ok: false, erro: 'acao_rejeitada', detalhe: r.erro }

  const nova: Sala = {
    ...registrarPoll(sala, jogadorId, agora),
    jogo: desidratar(r.estado),
    versao: sala.versao + 1,
    atualizadaEm: agora,
  }
  return { ok: true, valor: { sala: nova, visao: montarVisao(nova, jogadorId, agora, catalogo) } }
}
