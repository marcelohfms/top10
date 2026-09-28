import { describe, it, expect } from 'vitest'
import { embaralhar } from './embaralhar'

describe('embaralhar', () => {
  it('devolve uma permutacao sem alterar a entrada', () => {
    const entrada = ['a', 'b', 'c', 'd']
    const saida = embaralhar(entrada, () => 0.5)
    expect(entrada).toEqual(['a', 'b', 'c', 'd'])
    expect([...saida].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('e deterministico para o mesmo gerador', () => {
    expect(embaralhar(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a'])
    expect(embaralhar(['a', 'b', 'c'], () => 0.99)).toEqual(['a', 'b', 'c'])
  })
})
