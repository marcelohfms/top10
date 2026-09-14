import { describe, it, expect } from 'vitest'
import { roteador, type DependenciasHttp } from './http'
import { storeMemoria } from './store'
import { carregarCategorias } from '../data/carregar'
import type { AcaoSala, VisaoSala } from './tipos'

function aparelho(deps: DependenciasHttp) {
  let cred: { id: string; token: string } | null = null
  let versao = 0
  let visao: VisaoSala | null = null
  const headers = () => ({ 'content-type': 'application/json', 'X-Jogador-Id': cred!.id, 'X-Jogador-Token': cred!.token })
  const adotar = (b: { versao: number; visao: VisaoSala }) => { versao = b.versao; visao = b.visao }
  return {
    get visao() { return visao! },
    async criar(apelido: string) {
      const r = await roteador(new Request('http://x/api/salas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apelido }) }), deps)
      const b = await r.json()
      cred = { id: b.jogadorId, token: b.token }
      adotar(b)
      return b.codigo as string
    },
    async entrar(codigo: string, apelido: string) {
      const r = await roteador(new Request(`http://x/api/salas/${codigo}/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apelido }) }), deps)
      const b = await r.json()
      cred = { id: b.jogadorId, token: b.token }
      adotar(b)
    },
    async poll(codigo: string) {
      const r = await roteador(new Request(`http://x/api/salas/${codigo}?versao=${versao}`, { headers: headers() }), deps)
      if (r.status === 200) adotar(await r.json())
      return r.status
    },
    async agir(codigo: string, acao: AcaoSala) {
      const r = await roteador(new Request(`http://x/api/salas/${codigo}/acoes`, { method: 'POST', headers: headers(), body: JSON.stringify({ versao, acao }) }), deps)
      const b = await r.json()
      if (r.status === 200 || r.status === 409) adotar(b)
      return r.status
    },
    id: () => cred!.id,
  }
}

describe('partida completa com dois aparelhos', () => {
  it('do lobby ao fim de jogo, sem nunca vazar a lista', async () => {
    let n = 0
    const deps: DependenciasHttp = {
      store: storeMemoria(),
      catalogo: carregarCategorias(),
      agora: () => 1_000_000 + n++ * 100,
      geradores: { novoId: () => `j${++n}`, novoToken: () => `t${n}`, novoCodigo: () => 'KJQTM' },
    }
    const ana = aparelho(deps)
    const bruno = aparelho(deps)

    const codigo = await ana.criar('Ana')
    await bruno.entrar(codigo, 'Bruno')
    expect(await ana.poll(codigo)).toBe(200)
    expect(ana.visao.jogadores).toHaveLength(2)

    expect(await ana.agir(codigo, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })).toBe(200)
    await bruno.poll(codigo)
    expect(bruno.visao.jogo?.categoriasDisponiveis).toEqual([])
    const primeira = ana.visao.jogo!.categoriasDisponiveis[0]
    expect(await ana.agir(codigo, { tipo: 'iniciar_rodada', categoriaId: primeira.id })).toBe(200)
    await bruno.poll(codigo)

    // Bruno tenta agir fora da vez: 403 (nao e ele em jogadorId) / 422 (engine).
    expect(await bruno.agir(codigo, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'x', jogadorId: bruno.id() } })).toBe(422)

    // Ana chuta algo que nao existe; a resposta nao tem itens.
    expect(await ana.agir(codigo, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'zzzqqqxxx', jogadorId: ana.id() } })).toBe(200)
    expect(JSON.stringify(ana.visao)).not.toContain('"itens"')

    // Bruno duvida com versao velha: 409 e adota; depois duvida certo.
    await bruno.poll(codigo)
    expect(bruno.visao.jogo?.podeAgir.duvidar).toBe(true)
    const status = await bruno.agir(codigo, { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: bruno.id() } })
    expect(status).toBe(200)
    expect(bruno.visao.jogo?.fase).toBe('revelacao')
    expect(bruno.visao.jogo?.rodada?.categoria.itens).toHaveLength(10)
    expect(bruno.visao.jogo?.placar[bruno.id()]).toBe(1)

    // So o host avanca.
    expect(await bruno.agir(codigo, { tipo: 'avancar' })).toBe(403)
    await ana.poll(codigo)
    expect(await ana.agir(codigo, { tipo: 'avancar' })).toBe(200)
    expect(ana.visao.jogo?.fase).toBe('fim_jogo')
  })
})
