import { describe, it, expect, beforeEach } from 'vitest'
import { salvarEstado, carregarEstado, limparEstado } from './persistencia'
import { criarJogo, aplicarAcaoJogo } from './engine/jogo'
import type { Categoria } from './engine/types'

const catalogo: Categoria[] = [
  {
    id: 'c1',
    titulo: 'Teste',
    fonte: 'teste',
    itens: Array.from({ length: 10 }, (_, i) => ({ nome: `Item ${i}`, apelidos: [] })),
  },
]

beforeEach(() => limparEstado())

describe('persistencia', () => {
  it('devolve null quando nao ha nada salvo', () => {
    expect(carregarEstado(catalogo)).toBeNull()
  })

  it('faz round-trip do estado', () => {
    const r = aplicarAcaoJogo(
      criarJogo(catalogo),
      {
        tipo: 'configurar',
        jogadores: [{ id: 'a', nome: 'Ana' }, { id: 'b', nome: 'Bruno' }],
        modo: { tipo: 'tempo', minutos: 30 },
      },
      1000,
    )
    if (!r.ok) throw new Error('setup falhou')

    salvarEstado(r.estado)
    expect(carregarEstado(catalogo)).toEqual(r.estado)
  })

  it('devolve null quando o conteudo salvo esta corrompido', () => {
    localStorage.setItem('top10:estado', '{ isso nao e json')
    expect(carregarEstado(catalogo)).toBeNull()
  })

  it('devolve null quando a versao do formato nao bate', () => {
    localStorage.setItem('top10:estado', JSON.stringify({ versao: 0, estado: {} }))
    expect(carregarEstado(catalogo)).toBeNull()
  })

  it('limpa o estado salvo', () => {
    const jogo = criarJogo(catalogo)
    salvarEstado(jogo)
    limparEstado()
    expect(carregarEstado(catalogo)).toBeNull()
  })
})
