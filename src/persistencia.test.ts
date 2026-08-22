import { describe, it, expect, beforeEach } from 'vitest'
import { salvarEstado, carregarEstado, limparEstado } from './persistencia'
import { criarJogo, aplicarAcaoJogo } from './engine/jogo'
import type { Categoria } from './engine/types'

const NOMES_SECRETOS = [
  'Nitrogenio',
  'Oxigenio',
  'Argonio',
  'Vapor de agua',
  'Dioxido de carbono',
  'Neonio',
  'Helio',
  'Metano',
  'Criptonio',
  'Hidrogenio',
]

const catalogo: Categoria[] = [
  {
    id: 'c1',
    titulo: 'Teste',
    fonte: 'teste',
    itens: NOMES_SECRETOS.map((nome) => ({ nome, apelidos: [`apelido de ${nome}`] })),
  },
  {
    id: 'c2',
    titulo: 'Outra',
    fonte: 'teste',
    itens: Array.from({ length: 10 }, (_, i) => ({ nome: `Coisa ${i}`, apelidos: [] })),
  },
]

const jogadores = [
  { id: 'a', nome: 'Ana' },
  { id: 'b', nome: 'Bruno' },
]

function partidaConfigurada() {
  const r = aplicarAcaoJogo(
    criarJogo(catalogo),
    { tipo: 'configurar', jogadores, modo: { tipo: 'tempo', minutos: 30 } },
    1000,
  )
  if (!r.ok) throw new Error('setup falhou')
  return r.estado
}

beforeEach(() => limparEstado())

describe('persistencia', () => {
  it('devolve null quando nao ha nada salvo', () => {
    expect(carregarEstado(catalogo)).toBeNull()
  })

  it('faz round-trip do estado', () => {
    const estado = partidaConfigurada()
    salvarEstado(estado)
    expect(carregarEstado(catalogo)).toEqual(estado)
  })

  it('nao grava nenhum item da lista secreta no localStorage', () => {
    const r = aplicarAcaoJogo(
      partidaConfigurada(),
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      2000,
    )
    if (!r.ok) throw new Error('iniciar_rodada falhou')

    salvarEstado(r.estado)
    const bruto = localStorage.getItem('top10:estado')
    expect(bruto).not.toBeNull()

    for (const nome of NOMES_SECRETOS) {
      expect(bruto).not.toContain(nome)
      expect(bruto).not.toContain(`apelido de ${nome}`)
    }
  })

  it('faz round-trip de uma rodada em andamento reidratando a categoria pelo id', () => {
    const r = aplicarAcaoJogo(
      partidaConfigurada(),
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      2000,
    )
    if (!r.ok) throw new Error('iniciar_rodada falhou')

    salvarEstado(r.estado)
    const carregado = carregarEstado(catalogo)
    expect(carregado).toEqual(r.estado)
    expect(carregado?.rodada?.categoria).toBe(catalogo[0])
  })

  it('faz round-trip das rodadas concluidas reidratando as categorias pelo id', () => {
    let estado = partidaConfigurada()
    const passos = [
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Chumbo' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
    ] as const
    for (const acao of passos) {
      const r = aplicarAcaoJogo(estado, acao, 2000)
      if (!r.ok) throw new Error(`acao ${acao.tipo} falhou`)
      estado = r.estado
    }
    expect(estado.concluidas).toHaveLength(1)

    salvarEstado(estado)
    const carregado = carregarEstado(catalogo)
    expect(carregado).toEqual(estado)
    expect(carregado?.concluidas[0].categoria).toBe(catalogo[0])
  })

  it('devolve null quando a categoria salva nao existe mais no catalogo', () => {
    const r = aplicarAcaoJogo(
      partidaConfigurada(),
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      2000,
    )
    if (!r.ok) throw new Error('iniciar_rodada falhou')
    salvarEstado(r.estado)

    const catalogoEditado: Categoria[] = [catalogo[1]]
    expect(carregarEstado(catalogoEditado)).toBeNull()
  })

  it('devolve null quando a fase salva nao e uma fase conhecida', () => {
    const estado = partidaConfigurada()
    salvarEstado(estado)
    const bruto = JSON.parse(localStorage.getItem('top10:estado') as string)
    bruto.estado.fase = 'tela_secreta'
    localStorage.setItem('top10:estado', JSON.stringify(bruto))

    expect(carregarEstado(catalogo)).toBeNull()
  })

  it('devolve null quando o estado salvo perdeu campos obrigatorios', () => {
    localStorage.setItem(
      'top10:estado',
      JSON.stringify({ versao: 1, estado: { fase: 'em_rodada' } }),
    )
    expect(carregarEstado(catalogo)).toBeNull()
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
