import { describe, it, expect } from 'vitest'
import { visaoPublica } from './visao'
import { criarJogo, aplicarAcaoJogo } from './jogo'
import type { AcaoJogo, Categoria, EstadoJogo } from './types'

const T0 = 1_000_000

function cat(id: string, nomes: string[]): Categoria {
  return { id, titulo: `Cat ${id}`, fonte: 'teste', itens: nomes.map((nome) => ({ nome, apelidos: [`ap-${nome}`] })) }
}
const catalogo = [
  cat('c1', ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett']),
  cat('c2', ['Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango']),
]
const jogadores = [
  { id: 'a', nome: 'Ana' },
  { id: 'b', nome: 'Bruno' },
  { id: 'c', nome: 'Carla' },
]

function aplicar(estado: EstadoJogo, ...acoes: AcaoJogo[]): EstadoJogo {
  return acoes.reduce((atual, acao) => {
    const r = aplicarAcaoJogo(atual, acao, T0)
    if (!r.ok) throw new Error(r.erro)
    return r.estado
  }, estado)
}

const configurado = () =>
  aplicar(criarJogo(catalogo), { tipo: 'configurar', jogadores, modo: { tipo: 'categorias', quantidade: 2 } })

const emRodada = () => aplicar(configurado(), { tipo: 'iniciar_rodada', categoriaId: 'c1' })

describe('sigilo', () => {
  it('nao serializa nenhum item nem apelido durante a rodada', () => {
    // O palpite e 'Zulu', que NAO esta na lista: o texto do palpite e publico
    // (o jogador o disse em voz alta) e tem de aparecer na visao; o que nao
    // pode aparecer e a lista. Se o palpite fosse um item real, o nome
    // apareceria legitimamente como texto do palpite — nao como vazamento.
    const e = aplicar(emRodada(), { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } })
    const texto = JSON.stringify(visaoPublica(e, 'b', false))
    expect(texto).toContain('Zulu')
    for (const item of catalogo[0].itens) {
      expect(texto).not.toContain(item.nome)
      for (const ap of item.apelidos) expect(texto).not.toContain(ap)
    }
    expect(texto).not.toContain('catalogo')
  })

  it('nao serializa itens de categorias nao jogadas mesmo para o host', () => {
    const texto = JSON.stringify(visaoPublica(configurado(), 'a', true))
    for (const c of catalogo) for (const item of c.itens) expect(texto).not.toContain(item.nome)
    expect(texto).toContain('Cat c1')
  })

  it('nao serializa itens durante decisao_tempo', () => {
    let e = aplicar(criarJogo(catalogo), { tipo: 'configurar', jogadores, modo: { tipo: 'tempo', minutos: 1 } })
    e = aplicar(e, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } })
    const r = aplicarAcaoJogo(e, { tipo: 'tick' }, T0 + 60_001)
    expect(r.estado.fase).toBe('decisao_tempo')
    const texto = JSON.stringify(visaoPublica(r.estado, 'a', true))
    for (const item of catalogo[0].itens) expect(texto).not.toContain(item.nome)
  })

  it('revela os itens da rodada em revelacao e fim_jogo', () => {
    const e = aplicar(
      emRodada(),
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Yankee', jogadorId: 'b' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'c' } },
    )
    expect(e.fase).toBe('revelacao')
    const v = visaoPublica(e, 'a', false)
    expect(v.rodada?.categoria.itens?.map((i) => i.nome)).toEqual(catalogo[0].itens.map((i) => i.nome))
    expect(v.concluidas[0].categoria.itens).toHaveLength(10)
  })
})

describe('podeAgir', () => {
  it('so a vez pode palpitar em fase de palpite', () => {
    const e = emRodada()
    expect(visaoPublica(e, 'a', false).podeAgir).toEqual({ palpite: true, duvidar: false, host: false })
    expect(visaoPublica(e, 'b', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
  })

  it('na janela de duvida, o proximo pode palpitar e os outros vivos podem duvidar', () => {
    const e = aplicar(emRodada(), { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa', jogadorId: 'a' } })
    expect(visaoPublica(e, 'a', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
    expect(visaoPublica(e, 'b', false).podeAgir).toEqual({ palpite: true, duvidar: true, host: false })
    expect(visaoPublica(e, 'c', false).podeAgir).toEqual({ palpite: false, duvidar: true, host: false })
  })

  it('eliminado nao faz nada', () => {
    const e = aplicar(
      emRodada(),
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa', jogadorId: 'b' } },
    )
    expect(visaoPublica(e, 'a', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
  })

  it('host ve categorias disponiveis; nao host ve lista vazia', () => {
    const e = configurado()
    expect(visaoPublica(e, 'a', true).categoriasDisponiveis).toEqual([
      { id: 'c1', titulo: 'Cat c1' },
      { id: 'c2', titulo: 'Cat c2' },
    ])
    expect(visaoPublica(e, 'a', true).podeAgir.host).toBe(true)
    expect(visaoPublica(e, 'b', false).categoriasDisponiveis).toEqual([])
  })

  it('jogador que nao esta no jogo nao pode nada', () => {
    const e = emRodada()
    expect(visaoPublica(e, 'zzz', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
  })
})

describe('forma', () => {
  it('o texto de um palpite que coincide com um item aparece — e informacao publica', () => {
    const e = aplicar(emRodada(), { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa', jogadorId: 'a' } })
    const v = visaoPublica(e, 'b', false)
    expect(v.rodada?.palpites[0].texto).toBe('Alfa')
    expect(v.rodada?.palpites[0].resultado).toBe('pendente')
    expect(v.rodada?.categoria.itens).toBeUndefined()
  })

  it('carrega jogadorId, fase, placar, relogio e encerrarAposRodada', () => {
    const v = visaoPublica(emRodada(), 'b', false)
    expect(v.jogadorId).toBe('b')
    expect(v.fase).toBe('em_rodada')
    expect(v.placar).toEqual({ a: 0, b: 0, c: 0 })
    expect(v.relogio.modo).toEqual({ tipo: 'categorias', quantidade: 2 })
    expect(v.rodada?.categoria).toEqual({ id: 'c1', titulo: 'Cat c1', fonte: 'teste' })
  })
})
