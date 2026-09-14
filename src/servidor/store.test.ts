import { describe, it, expect } from 'vitest'
import { storeMemoria } from './store'
import type { Sala } from './tipos'

const sala = (versao: number): Sala => ({
  codigo: 'ABCDE',
  hostId: 'h',
  jogadores: [],
  jogo: null,
  versao,
  criadaEm: 0,
  atualizadaEm: 0,
})

describe('storeMemoria', () => {
  it('devolve null para codigo desconhecido', async () => {
    expect(await storeMemoria().obter('ZZZZZ')).toBeNull()
  })

  it('cria quando a versao esperada e 0 e nao existe', async () => {
    const s = storeMemoria()
    expect(await s.gravarSe(sala(1), 0)).toBe(true)
    expect((await s.obter('ABCDE'))?.versao).toBe(1)
  })

  it('recusa criar se ja existe', async () => {
    const s = storeMemoria()
    await s.gravarSe(sala(1), 0)
    expect(await s.gravarSe(sala(1), 0)).toBe(false)
  })

  it('grava quando a versao bate e recusa quando nao bate', async () => {
    const s = storeMemoria()
    await s.gravarSe(sala(1), 0)
    expect(await s.gravarSe(sala(2), 1)).toBe(true)
    expect(await s.gravarSe(sala(3), 1)).toBe(false)
    expect((await s.obter('ABCDE'))?.versao).toBe(2)
  })

  it('devolve uma copia, nao a referencia guardada', async () => {
    const s = storeMemoria()
    await s.gravarSe(sala(1), 0)
    const a = await s.obter('ABCDE')
    a!.hostId = 'mutado'
    expect((await s.obter('ABCDE'))?.hostId).toBe('h')
  })
})
