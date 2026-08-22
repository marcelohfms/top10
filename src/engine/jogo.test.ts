import { describe, it, expect } from 'vitest'
import { criarJogo, aplicarAcaoJogo } from './jogo'
import type { AcaoJogo, Categoria, EstadoJogo, Jogador } from './types'

const MIN = 60_000
const T0 = 1_000_000

function categoriaFake(id: string): Categoria {
  return {
    id,
    titulo: `Categoria ${id}`,
    fonte: 'teste',
    itens: [
      'Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo',
      'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett',
    ].map((nome) => ({ nome, apelidos: [] })),
  }
}

const catalogo = [categoriaFake('c1'), categoriaFake('c2'), categoriaFake('c3')]
const jogadores: Jogador[] = [
  { id: 'a', nome: 'Ana' },
  { id: 'b', nome: 'Bruno' },
]

function aplicar(estado: EstadoJogo, agora: number, ...acoes: AcaoJogo[]): EstadoJogo {
  return acoes.reduce((atual, acao) => {
    const r = aplicarAcaoJogo(atual, acao, agora)
    if (!r.ok) throw new Error(`acao rejeitada: ${r.erro}`)
    return r.estado
  }, estado)
}

/** Joga uma rodada inteira ate sobrar um: 'a' chuta errado e 'b' duvida. */
function rodadaCompleta(estado: EstadoJogo, agora: number, categoriaId: string): EstadoJogo {
  return aplicar(
    estado,
    agora,
    { tipo: 'iniciar_rodada', categoriaId },
    { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu' } },
    { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
  )
}

describe('configuracao', () => {
  it('zera o placar e vai para em_rodada', () => {
    const e = aplicar(criarJogo(catalogo), T0, {
      tipo: 'configurar',
      jogadores,
      modo: { tipo: 'categorias', quantidade: 2 },
    })
    expect(e.fase).toBe('em_rodada')
    expect(e.placar).toEqual({ a: 0, b: 0 })
  })
})

describe('fluxo de rodada', () => {
  const base = () =>
    aplicar(criarJogo(catalogo), T0, {
      tipo: 'configurar',
      jogadores,
      modo: { tipo: 'categorias', quantidade: 2 },
    })

  it('vai para revelacao e pontua o vencedor', () => {
    const e = rodadaCompleta(base(), T0, 'c1')
    expect(e.fase).toBe('revelacao')
    expect(e.placar).toEqual({ a: 0, b: 1 })
    expect(e.concluidas).toHaveLength(1)
  })

  it('inicia o relogio no primeiro palpite', () => {
    const e = aplicar(
      base(),
      T0,
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa' } },
    )
    expect(e.relogio.iniciadoEm).toBe(T0)
  })

  it('nao repete categoria ja jogada', () => {
    let e = rodadaCompleta(base(), T0, 'c1')
    e = aplicar(e, T0, { tipo: 'avancar' })
    const r = aplicarAcaoJogo(e, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, T0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('acao_invalida')
  })

  it('propaga o erro da rodada sem alterar o estado', () => {
    const e = aplicar(base(), T0, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    const r = aplicarAcaoJogo(e, { tipo: 'rodada', acao: { tipo: 'palpite', texto: '' } }, T0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('palpite_vazio')
    expect(r.estado).toEqual(e)
  })
})

describe('encerramento por numero de categorias', () => {
  it('termina depois da enesima rodada', () => {
    let e = aplicar(criarJogo(catalogo), T0, {
      tipo: 'configurar',
      jogadores,
      modo: { tipo: 'categorias', quantidade: 2 },
    })
    e = rodadaCompleta(e, T0, 'c1')
    e = aplicar(e, T0, { tipo: 'avancar' })
    expect(e.fase).toBe('em_rodada')
    e = rodadaCompleta(e, T0, 'c2')
    e = aplicar(e, T0, { tipo: 'avancar' })
    expect(e.fase).toBe('fim_jogo')
  })
})

describe('encerramento por tempo', () => {
  const base = () =>
    aplicar(criarJogo(catalogo), T0, {
      tipo: 'configurar',
      jogadores,
      modo: { tipo: 'tempo', minutos: 30 },
    })

  it('abre a decisao quando o tempo zera no meio da rodada', () => {
    let e = aplicar(
      base(),
      T0,
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa' } },
    )
    e = aplicar(e, T0 + 30 * MIN, { tipo: 'tick' })
    expect(e.fase).toBe('decisao_tempo')
    expect(e.relogio.pausadoEm).toBe(T0 + 30 * MIN)
  })

  it('encerrar agora aborta a rodada sem pontuar', () => {
    let e = aplicar(
      base(),
      T0,
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa' } },
    )
    e = aplicar(e, T0 + 30 * MIN, { tipo: 'tick' })
    e = aplicar(e, T0 + 31 * MIN, { tipo: 'decidir_expiracao', decisao: 'encerrar' })
    expect(e.fase).toBe('fim_jogo')
    expect(e.placar).toEqual({ a: 0, b: 0 })
    expect(e.concluidas).toEqual([
      { categoria: catalogo[0], vencedorId: null, abortada: true },
    ])
  })

  it('terminar categoria retoma a rodada exatamente de onde parou', () => {
    let e = aplicar(
      base(),
      T0,
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu' } },
    )
    const rodadaAntes = e.rodada
    e = aplicar(e, T0 + 30 * MIN, { tipo: 'tick' })
    e = aplicar(e, T0 + 31 * MIN, { tipo: 'decidir_expiracao', decisao: 'terminar_categoria' })
    expect(e.fase).toBe('em_rodada')
    expect(e.rodada).toEqual(rodadaAntes)
    expect(e.encerrarAposRodada).toBe(true)

    e = aplicar(e, T0 + 32 * MIN, { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } })
    expect(e.placar).toEqual({ a: 0, b: 1 })
    e = aplicar(e, T0 + 33 * MIN, { tipo: 'avancar' })
    expect(e.fase).toBe('fim_jogo')
  })

  it('nao reabre a decisao depois de escolher terminar a categoria', () => {
    let e = aplicar(
      base(),
      T0,
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu' } },
    )
    e = aplicar(e, T0 + 30 * MIN, { tipo: 'tick' })
    e = aplicar(e, T0 + 31 * MIN, { tipo: 'decidir_expiracao', decisao: 'terminar_categoria' })
    e = aplicar(e, T0 + 32 * MIN, { tipo: 'tick' })
    expect(e.fase).toBe('em_rodada')
  })

  it('encerra direto quando o tempo zera na revelacao', () => {
    let e = rodadaCompleta(base(), T0, 'c1')
    expect(e.fase).toBe('revelacao')
    e = aplicar(e, T0 + 30 * MIN, { tipo: 'tick' })
    expect(e.fase).toBe('fim_jogo')
  })

  it('ignora tick sem expiracao', () => {
    let e = aplicar(
      base(),
      T0,
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa' } },
    )
    const antes = e
    e = aplicar(e, T0 + 5 * MIN, { tipo: 'tick' })
    expect(e.fase).toBe(antes.fase)
  })
})

describe('fim por falta de categorias', () => {
  it('encerra quando o catalogo se esgota', () => {
    let e = aplicar(criarJogo(catalogo), T0, {
      tipo: 'configurar',
      jogadores,
      modo: { tipo: 'categorias', quantidade: 10 },
    })
    for (const c of catalogo) {
      e = rodadaCompleta(e, T0, c.id)
      e = aplicar(e, T0, { tipo: 'avancar' })
    }
    expect(e.fase).toBe('fim_jogo')
  })
})
