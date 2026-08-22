import { describe, it, expect } from 'vitest'
import {
  criarRelogio,
  iniciarRelogio,
  pausarRelogio,
  retomarRelogio,
  msDecorridos,
  msRestantes,
  verificarExpiracao,
} from './relogio'

const MIN = 60_000
const T0 = 1_000_000

describe('modo por categorias', () => {
  it('nao tem tempo restante', () => {
    const r = iniciarRelogio(criarRelogio({ tipo: 'categorias', quantidade: 5 }), T0)
    expect(msRestantes(r, T0 + 10 * MIN)).toBeNull()
  })

  it('nunca expira', () => {
    const r = iniciarRelogio(criarRelogio({ tipo: 'categorias', quantidade: 5 }), T0)
    expect(verificarExpiracao(r, T0 + 999 * MIN).expirado).toBe(false)
  })

  it('conta tempo decorrido para exibicao', () => {
    const r = iniciarRelogio(criarRelogio({ tipo: 'categorias', quantidade: 5 }), T0)
    expect(msDecorridos(r, T0 + 3 * MIN)).toBe(3 * MIN)
  })
})

describe('modo por tempo', () => {
  const modo = { tipo: 'tempo', minutos: 30 } as const

  it('nao conta antes de iniciar', () => {
    const r = criarRelogio(modo)
    expect(msDecorridos(r, T0)).toBe(0)
    expect(msRestantes(r, T0)).toBe(30 * MIN)
  })

  it('conta a partir do inicio', () => {
    const r = iniciarRelogio(criarRelogio(modo), T0)
    expect(msRestantes(r, T0 + 10 * MIN)).toBe(20 * MIN)
  })

  it('nao expira antes do limite', () => {
    const r = iniciarRelogio(criarRelogio(modo), T0)
    expect(verificarExpiracao(r, T0 + 29 * MIN).expirado).toBe(false)
  })

  it('expira exatamente no limite', () => {
    const r = iniciarRelogio(criarRelogio(modo), T0)
    expect(verificarExpiracao(r, T0 + 30 * MIN).expirado).toBe(true)
  })

  it('nao deixa o restante ficar negativo', () => {
    const r = iniciarRelogio(criarRelogio(modo), T0)
    expect(msRestantes(r, T0 + 45 * MIN)).toBe(0)
  })
})

describe('pausa', () => {
  const modo = { tipo: 'tempo', minutos: 30 } as const

  it('congela o tempo enquanto pausado', () => {
    const r = pausarRelogio(iniciarRelogio(criarRelogio(modo), T0), T0 + 10 * MIN)
    expect(msRestantes(r, T0 + 25 * MIN)).toBe(20 * MIN)
  })

  it('nao expira enquanto pausado', () => {
    const r = pausarRelogio(iniciarRelogio(criarRelogio(modo), T0), T0 + 10 * MIN)
    expect(verificarExpiracao(r, T0 + 99 * MIN).expirado).toBe(false)
  })

  it('devolve o tempo pausado ao retomar', () => {
    let r = iniciarRelogio(criarRelogio(modo), T0)
    r = pausarRelogio(r, T0 + 10 * MIN)
    r = retomarRelogio(r, T0 + 25 * MIN)
    expect(msRestantes(r, T0 + 26 * MIN)).toBe(19 * MIN)
  })
})
