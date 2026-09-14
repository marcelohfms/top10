import { describe, it, expect, beforeEach } from 'vitest'
import { roteador, type DependenciasHttp } from './http'
import { storeMemoria } from './store'
import { TTL_SALA_MS } from './tipos'
import type { Categoria } from '../engine/types'

function cat(id: string): Categoria {
  return { id, titulo: `Cat ${id}`, fonte: 'teste', itens: 'ABCDEFGHIJ'.split('').map((n) => ({ nome: `${n}${id}`, apelidos: [] })) }
}

let deps: DependenciasHttp
let relogio: number

beforeEach(() => {
  let n = 0
  relogio = 1_000_000
  deps = {
    store: storeMemoria(),
    catalogo: [cat('c1'), cat('c2')],
    agora: () => relogio,
    geradores: { novoId: () => `j${++n}`, novoToken: () => `t${n}`, novoCodigo: () => 'ABCDE' },
  }
})

const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const req = (metodo: string, caminho: string, init: RequestInit = {}) =>
  roteador(new Request(`http://x${caminho}`, { method: metodo, ...init }), deps)
const auth = (id: string, token: string) => ({ 'X-Jogador-Id': id, 'X-Jogador-Token': token })

async function salaComDois() {
  const c = await (await req('POST', '/api/salas', json({ apelido: 'Ana' }))).json()
  const e = await (await req('POST', '/api/salas/ABCDE/entrar', json({ apelido: 'Bruno' }))).json()
  return { host: { id: c.jogadorId, token: c.token }, outro: { id: e.jogadorId, token: e.token }, versao: e.versao }
}

describe('criar e entrar', () => {
  it('cria sala', async () => {
    const r = await req('POST', '/api/salas', json({ apelido: 'Ana' }))
    expect(r.status).toBe(201)
    const b = await r.json()
    expect(b.codigo).toBe('ABCDE')
    expect(b.token).toBe('t1')
    expect(b.visao.ehHost).toBe(true)
  })

  it('rejeita corpo invalido', async () => {
    const r = await req('POST', '/api/salas', { body: '{nao json', headers: { 'content-type': 'application/json' } })
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('corpo_invalido')
  })

  it('entrar em sala inexistente', async () => {
    const r = await req('POST', '/api/salas/ZZZZZ/entrar', json({ apelido: 'B' }))
    expect(r.status).toBe(404)
  })

  it('codigo malformado e 404', async () => {
    const r = await req('POST', '/api/salas/abc/entrar', json({ apelido: 'B' }))
    expect(r.status).toBe(404)
  })

  it('apelido repetido e 409', async () => {
    await req('POST', '/api/salas', json({ apelido: 'Ana' }))
    const r = await req('POST', '/api/salas/ABCDE/entrar', json({ apelido: 'ana' }))
    expect(r.status).toBe(409)
    expect((await r.json()).erro).toBe('apelido_em_uso')
  })
})

describe('ler', () => {
  it('exige token valido', async () => {
    const { host } = await salaComDois()
    expect((await req('GET', '/api/salas/ABCDE', { headers: auth(host.id, 'errado') })).status).toBe(403)
    expect((await req('GET', '/api/salas/ABCDE')).status).toBe(403)
  })

  it('204 quando a versao nao mudou', async () => {
    const { host, versao } = await salaComDois()
    const r = await req('GET', `/api/salas/ABCDE?versao=${versao}`, { headers: auth(host.id, host.token) })
    expect(r.status).toBe(204)
  })

  it('200 com visao quando mudou', async () => {
    const { outro, versao } = await salaComDois()
    const r = await req('GET', `/api/salas/ABCDE?versao=${versao - 1}`, { headers: auth(outro.id, outro.token) })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.versao).toBe(versao)
    expect(b.visao.jogadorId).toBe(outro.id)
    expect(b.visao.jogadores).toHaveLength(2)
  })

  it('sala parada ha mais de 6 h e 404', async () => {
    const { host } = await salaComDois()
    relogio += TTL_SALA_MS + 1
    const r = await req('GET', '/api/salas/ABCDE', { headers: auth(host.id, host.token) })
    expect(r.status).toBe(404)
  })
})

describe('acoes', () => {
  const acao = (c: { id: string; token: string }, versao: number, acao: unknown) =>
    req('POST', '/api/salas/ABCDE/acoes', {
      ...json({ versao, acao }),
      headers: { ...auth(c.id, c.token), 'content-type': 'application/json' },
    })

  it('host inicia a partida e a rodada; nao host recebe 403', async () => {
    const { host, outro, versao } = await salaComDois()
    const r1 = await acao(host, versao, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })
    expect(r1.status).toBe(200)
    const b1 = await r1.json()
    const r2 = await acao(outro, b1.versao, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    expect(r2.status).toBe(403)
  })

  it('versao desatualizada e 409 com a visao atual', async () => {
    const { host, versao } = await salaComDois()
    const r = await acao(host, versao - 1, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })
    expect(r.status).toBe(409)
    const b = await r.json()
    expect(b.erro).toBe('versao_desatualizada')
    expect(b.versao).toBe(versao)
    expect(b.visao.codigo).toBe('ABCDE')
  })

  it('acao recusada pela engine e 422 com detalhe', async () => {
    const { host, versao } = await salaComDois()
    const r = await acao(host, versao, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    expect(r.status).toBe(422)
    expect((await r.json()).detalhe).toBe('acao_invalida')
  })

  it('a resposta de uma rodada em curso nunca contem itens', async () => {
    const { host, versao } = await salaComDois()
    const b1 = await (await acao(host, versao, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })).json()
    const r2 = await acao(host, b1.versao, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    const texto = await r2.text()
    expect(texto).toContain('Cat c1')
    for (const n of 'ABCDEFGHIJ') expect(texto).not.toContain(`${n}c1`)
  })
})

describe('store indisponivel', () => {
  it('devolve 503 sem aplicar nada', async () => {
    deps.store = { obter: async () => { throw new Error('boom') }, gravarSe: async () => { throw new Error('boom') } }
    const r = await req('POST', '/api/salas', json({ apelido: 'Ana' }))
    expect(r.status).toBe(503)
    expect((await r.json()).erro).toBe('store_indisponivel')
  })
})

describe('rotas desconhecidas', () => {
  it('404', async () => {
    expect((await req('GET', '/api/nada')).status).toBe(404)
    expect((await req('DELETE', '/api/salas')).status).toBe(404)
  })
})
