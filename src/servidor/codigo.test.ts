import { describe, it, expect } from 'vitest'
import { gerarCodigo, codigoValido, ALFABETO_CODIGO } from './codigo'

describe('gerarCodigo', () => {
  it('tem 5 letras do alfabeto sem I e O', () => {
    const c = gerarCodigo(Math.random)
    expect(c).toHaveLength(5)
    for (const l of c) expect(ALFABETO_CODIGO).toContain(l)
    expect(ALFABETO_CODIGO).not.toContain('I')
    expect(ALFABETO_CODIGO).not.toContain('O')
  })

  it('e deterministico dado o aleatorio', () => {
    let i = 0
    const seq = [0, 0.5, 0.999, 0.25, 0.75]
    const fake = () => seq[i++ % seq.length]
    expect(gerarCodigo(fake)).toBe(gerarCodigo((i = 0, fake)))
  })
})

describe('codigoValido', () => {
  it.each(['ABCDE', 'KJQTM'])('%s e valido', (c) => expect(codigoValido(c)).toBe(true))
  it.each(['abcde', 'ABCD', 'ABCDEF', 'ABCDI', 'ABC-E', ''])('%s e invalido', (c) =>
    expect(codigoValido(c)).toBe(false),
  )
})
