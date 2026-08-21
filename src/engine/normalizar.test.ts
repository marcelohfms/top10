import { describe, it, expect } from 'vitest'
import { normalizar } from './normalizar'

describe('normalizar', () => {
  it('passa para minusculas', () => {
    expect(normalizar('NITROGÊNIO')).toBe('nitrogenio')
  })

  it('remove acentos e cedilha', () => {
    expect(normalizar('Suíça')).toBe('suica')
    expect(normalizar('Japão')).toBe('japao')
  })

  it('remove pontuacao', () => {
    expect(normalizar('E.U.A.')).toBe('eua')
    expect(normalizar("Cote d'Ivoire")).toBe('cote divoire')
  })

  it('colapsa espacos e apara as bordas', () => {
    expect(normalizar('  Estados   Unidos  ')).toBe('estados unidos')
  })

  it('remove artigos e preposicoes iniciais', () => {
    expect(normalizar('Os Estados Unidos')).toBe('estados unidos')
    expect(normalizar('a Australia')).toBe('australia')
  })

  it('nao remove artigo quando ele e a palavra inteira', () => {
    expect(normalizar('As')).toBe('as')
  })

  it('trata entrada vazia', () => {
    expect(normalizar('   ')).toBe('')
  })
})
