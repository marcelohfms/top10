import { carregarCategorias } from '../data/carregar'
import type { Categoria, ModoDuracao } from '../engine/types'
import { codigoValido, gerarCodigo } from './codigo'
import { aplicarAcaoNaSala, autenticar, criarSala, entrarNaSala, lerSala, montarVisao } from './sala'
import type { StoreSala } from './store'
import { TTL_SALA_MS, type AcaoSala, type ErroServidor, type Geradores, type Sala } from './tipos'

export type DependenciasHttp = {
  store: StoreSala
  catalogo: Categoria[]
  agora: () => number
  geradores: Geradores
}

export function dependenciasPadrao(store: StoreSala): DependenciasHttp {
  return {
    store,
    catalogo: carregarCategorias(),
    agora: () => Date.now(),
    geradores: {
      novoId: () => crypto.randomUUID(),
      novoToken: () => crypto.randomUUID() + crypto.randomUUID(),
      novoCodigo: () => gerarCodigo(Math.random),
    },
  }
}

const MENSAGENS: Record<ErroServidor, string> = {
  corpo_invalido: 'Requisição inválida.',
  token_invalido: 'Suas credenciais não valem para esta sala.',
  nao_autorizado: 'Você não pode fazer isso agora.',
  sala_inexistente: 'Sala não encontrada ou expirada.',
  versao_desatualizada: 'A sala mudou; veja o estado atual.',
  apelido_em_uso: 'Já tem alguém com esse apelido na sala.',
  acao_rejeitada: 'A ação não vale neste momento do jogo.',
  store_indisponivel: 'Não foi possível acessar a sala. Tente de novo.',
}

const HTTP: Record<ErroServidor, number> = {
  corpo_invalido: 400,
  token_invalido: 403,
  nao_autorizado: 403,
  sala_inexistente: 404,
  versao_desatualizada: 409,
  apelido_em_uso: 409,
  acao_rejeitada: 422,
  store_indisponivel: 503,
}

function jsonResp(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

function erro(e: ErroServidor, extra: Record<string, unknown> = {}): Response {
  return jsonResp(HTTP[e], { erro: e, mensagem: MENSAGENS[e], ...extra })
}

async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json()
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function modoValido(m: unknown): m is ModoDuracao {
  if (typeof m !== 'object' || m === null) return false
  const o = m as Record<string, unknown>
  if (o.tipo === 'categorias') return Number.isInteger(o.quantidade) && (o.quantidade as number) >= 1
  if (o.tipo === 'tempo') return Number.isInteger(o.minutos) && (o.minutos as number) >= 1
  return false
}

/** Valida a forma minima da acao vinda do cliente; a engine valida o resto. */
function acaoValida(a: unknown): a is AcaoSala {
  if (typeof a !== 'object' || a === null) return false
  const o = a as Record<string, unknown>
  switch (o.tipo) {
    case 'iniciar_partida':
      return modoValido(o.modo)
    case 'entrar_na_partida':
    case 'avancar':
      return true
    case 'iniciar_rodada':
      return typeof o.categoriaId === 'string'
    case 'decidir_expiracao':
      return o.decisao === 'encerrar' || o.decisao === 'terminar_categoria'
    case 'rodada': {
      const r = o.acao as Record<string, unknown> | undefined
      if (!r) return false
      if (r.tipo === 'palpite') return typeof r.texto === 'string' && typeof r.jogadorId === 'string'
      if (r.tipo === 'duvidar') return typeof r.duvidadorId === 'string'
      return r.tipo === 'ninguem_duvidou'
    }
    default:
      return false
  }
}

async function comStore<T>(fn: () => Promise<T>): Promise<T | Response> {
  try {
    return await fn()
  } catch {
    return erro('store_indisponivel')
  }
}

async function carregarSala(deps: DependenciasHttp, codigo: string): Promise<Sala | Response> {
  if (!codigoValido(codigo)) return erro('sala_inexistente')
  const r = await comStore(() => deps.store.obter(codigo))
  if (r instanceof Response) return r
  if (r === null) return erro('sala_inexistente')
  // TTL: sala parada ha mais de 6 h e tratada como inexistente. Fica no roteador
  // para valer igual em qualquer store.
  if (deps.agora() - r.atualizadaEm > TTL_SALA_MS) return erro('sala_inexistente')
  return r
}

function credenciais(request: Request): { id: string; token: string } | null {
  const id = request.headers.get('x-jogador-id')
  const token = request.headers.get('x-jogador-token')
  return id && token ? { id, token } : null
}

async function postSalas(request: Request, deps: DependenciasHttp): Promise<Response> {
  const corpo = await lerCorpo(request)
  if (!corpo || typeof corpo.apelido !== 'string' || corpo.apelido.trim() === '') return erro('corpo_invalido')
  const agora = deps.agora()
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { sala, jogador } = criarSala(corpo.apelido, agora, deps.geradores)
    const gravou = await comStore(() => deps.store.gravarSe(sala, 0))
    if (gravou instanceof Response) return gravou
    if (gravou) {
      return jsonResp(201, {
        codigo: sala.codigo,
        jogadorId: jogador.id,
        token: jogador.token,
        versao: sala.versao,
        visao: montarVisao(sala, jogador.id, agora, deps.catalogo),
      })
    }
  }
  return erro('store_indisponivel')
}

async function postEntrar(request: Request, deps: DependenciasHttp, codigo: string): Promise<Response> {
  const corpo = await lerCorpo(request)
  if (!corpo || typeof corpo.apelido !== 'string') return erro('corpo_invalido')
  const sala = await carregarSala(deps, codigo)
  if (sala instanceof Response) return sala
  const agora = deps.agora()
  const r = entrarNaSala(sala, corpo.apelido, agora, deps.geradores)
  if (!r.ok) return erro(r.erro, r.detalhe ? { detalhe: r.detalhe } : {})
  const gravou = await comStore(() => deps.store.gravarSe(r.valor.sala, sala.versao))
  if (gravou instanceof Response) return gravou
  if (!gravou) return erro('versao_desatualizada', { versao: sala.versao, visao: null })
  return jsonResp(200, {
    jogadorId: r.valor.jogador.id,
    token: r.valor.jogador.token,
    versao: r.valor.sala.versao,
    visao: montarVisao(r.valor.sala, r.valor.jogador.id, agora, deps.catalogo),
  })
}

async function getSala(request: Request, deps: DependenciasHttp, codigo: string): Promise<Response> {
  const cred = credenciais(request)
  if (!cred) return erro('token_invalido')
  const sala = await carregarSala(deps, codigo)
  if (sala instanceof Response) return sala
  if (!autenticar(sala, cred.id, cred.token)) return erro('token_invalido')

  const agora = deps.agora()
  const { sala: nova, visao } = lerSala(sala, cred.id, agora, deps.catalogo)
  // Grava sempre (registra presenca), com CAS na versao lida. Se perder a
  // corrida, nao importa: a leitura e informativa.
  await comStore(() => deps.store.gravarSe(nova, sala.versao))

  const vista = Number(new URL(request.url).searchParams.get('versao'))
  if (Number.isInteger(vista) && vista === nova.versao) return new Response(null, { status: 204 })
  return jsonResp(200, { versao: nova.versao, visao })
}

async function postAcoes(request: Request, deps: DependenciasHttp, codigo: string): Promise<Response> {
  const cred = credenciais(request)
  if (!cred) return erro('token_invalido')
  const corpo = await lerCorpo(request)
  if (!corpo || !Number.isInteger(corpo.versao) || !acaoValida(corpo.acao)) return erro('corpo_invalido')
  const sala = await carregarSala(deps, codigo)
  if (sala instanceof Response) return sala
  if (!autenticar(sala, cred.id, cred.token)) return erro('token_invalido')

  const agora = deps.agora()
  if (corpo.versao !== sala.versao) {
    return erro('versao_desatualizada', { versao: sala.versao, visao: montarVisao(sala, cred.id, agora, deps.catalogo) })
  }
  const r = aplicarAcaoNaSala(sala, cred.id, corpo.acao, agora, deps.catalogo)
  if (!r.ok) return erro(r.erro, r.detalhe ? { detalhe: r.detalhe } : {})
  const gravou = await comStore(() => deps.store.gravarSe(r.valor.sala, sala.versao))
  if (gravou instanceof Response) return gravou
  if (!gravou) {
    const atual = await comStore(() => deps.store.obter(codigo))
    if (atual instanceof Response) return atual
    const s = atual ?? sala
    return erro('versao_desatualizada', { versao: s.versao, visao: montarVisao(s, cred.id, agora, deps.catalogo) })
  }
  return jsonResp(200, { versao: r.valor.sala.versao, visao: r.valor.visao })
}

export async function roteador(request: Request, deps: DependenciasHttp): Promise<Response> {
  const { pathname } = new URL(request.url)
  const partes = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

  if (partes[0] !== 'salas') return erro('sala_inexistente')
  if (partes.length === 1) return request.method === 'POST' ? postSalas(request, deps) : erro('sala_inexistente')

  const codigo = partes[1].toUpperCase()
  if (partes.length === 2 && request.method === 'GET') return getSala(request, deps, codigo)
  if (partes.length === 3 && request.method === 'POST') {
    if (partes[2] === 'entrar') return postEntrar(request, deps, codigo)
    if (partes[2] === 'acoes') return postAcoes(request, deps, codigo)
  }
  return erro('sala_inexistente')
}
