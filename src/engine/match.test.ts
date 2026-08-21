import { describe, it, expect } from 'vitest'
import { similaridade, casaComItem, encontrarItem } from './match'
import type { ItemCategoria } from './types'

const item = (nome: string, apelidos: string[] = []): ItemCategoria => ({ nome, apelidos })

describe('similaridade', () => {
  it('e 1 para strings identicas', () => {
    expect(similaridade('brasil', 'brasil')).toBe(1)
  })

  it('cai conforme a distancia de edicao', () => {
    expect(similaridade('nitrogenio', 'nitorgenio')).toBeGreaterThan(0.85)
    expect(similaridade('brasil', 'brunei')).toBeLessThan(0.85)
  })
})

describe('casaComItem — etapa de normalizacao', () => {
  it('ignora caixa e acento', () => {
    expect(casaComItem('nitrogenio', item('Nitrogênio'))).toBe(true)
    expect(casaComItem('NITROGÊNIO', item('Nitrogênio'))).toBe(true)
  })

  it('ignora artigo inicial', () => {
    expect(casaComItem('os Estados Unidos', item('Estados Unidos'))).toBe(true)
  })
})

describe('casaComItem — etapa de apelidos', () => {
  it('aceita sigla cadastrada', () => {
    const eua = item('Estados Unidos', ['eua', 'usa', 'estados unidos da america'])
    expect(casaComItem('EUA', eua)).toBe(true)
    expect(casaComItem('U.S.A.', eua)).toBe(true)
  })

  it('aceita typo dentro de um apelido', () => {
    expect(casaComItem('nitrogeneo', item('Nitrogênio', ['azoto']))).toBe(true)
  })
})

describe('casaComItem — etapa de similaridade', () => {
  it('aceita transposicao de letras', () => {
    expect(casaComItem('nitorgenio', item('Nitrogênio'))).toBe(true)
  })

  it('aceita letra faltando em palavra longa', () => {
    expect(casaComItem('dinamarc', item('Dinamarca'))).toBe(true)
  })

  it('exige match exato para strings curtas', () => {
    expect(casaComItem('chade', item('Chile'))).toBe(false)
    expect(casaComItem('chile', item('Chile'))).toBe(true)
  })
})

describe('casaComItem — falso-positivos proibidos', () => {
  const proibidos: Array<[string, string]> = [
    ['brasil', 'Brunei'],
    ['chade', 'Chile'],
    ['china', 'Chile'],
    ['austria', 'Australia'],
    ['iran', 'Iraque'],
    ['oxigenio', 'Nitrogênio'],
  ]

  it.each(proibidos)('%s nao casa com %s', (palpite, nome) => {
    expect(casaComItem(palpite, item(nome))).toBe(false)
  })
})

describe('encontrarItem', () => {
  const itens = [
    item('Nitrogênio', ['n2', 'azoto']),
    item('Oxigênio', ['o2']),
    item('Argônio', []),
  ]

  it('devolve o item correspondente', () => {
    expect(encontrarItem('o2', itens)?.nome).toBe('Oxigênio')
  })

  it('devolve null quando nada casa', () => {
    expect(encontrarItem('helio', itens)).toBeNull()
  })
})
