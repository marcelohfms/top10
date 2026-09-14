import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storeArquivo } from './store-arquivo'
import { TTL_SALA_MS, type Sala } from './tipos'

const sala = (versao: number): Sala => ({
  codigo: 'ABCDE', hostId: 'h', jogadores: [], jogo: null, versao, criadaEm: 0, atualizadaEm: 0,
})

async function caminhoTemp() {
  return join(await mkdtemp(join(tmpdir(), 'top10-')), 'salas.json')
}

describe('storeArquivo', () => {
  it('comeca vazio quando o arquivo nao existe', async () => {
    const s = await storeArquivo(await caminhoTemp())
    expect(await s.obter('ABCDE')).toBeNull()
  })

  it('faz CAS como o store em memoria', async () => {
    const s = await storeArquivo(await caminhoTemp())
    expect(await s.gravarSe(sala(1), 0)).toBe(true)
    expect(await s.gravarSe(sala(1), 0)).toBe(false)
    expect(await s.gravarSe(sala(2), 1)).toBe(true)
    expect(await s.gravarSe(sala(3), 1)).toBe(false)
    expect((await s.obter('ABCDE'))?.versao).toBe(2)
  })

  it('persiste no disco e recarrega numa nova instancia', async () => {
    const caminho = await caminhoTemp()
    const s1 = await storeArquivo(caminho)
    await s1.gravarSe(sala(1), 0)
    await s1.gravarSe(sala(2), 1)
    await s1.aguardarGravacao()
    expect(JSON.parse(await readFile(caminho, 'utf8')).ABCDE.versao).toBe(2)
    const s2 = await storeArquivo(caminho)
    expect((await s2.obter('ABCDE'))?.versao).toBe(2)
  })

  it('ao recarregar com agoraNaCarga, todos os jogadores ganham presenca fresca', async () => {
    const caminho = await caminhoTemp()
    const s1 = await storeArquivo(caminho)
    await s1.gravarSe({ ...sala(1), jogadores: [{ id: 'h', apelido: 'Ana', token: 't', ultimoPollEm: 0 }] }, 0)
    await s1.aguardarGravacao()
    const s2 = await storeArquivo(caminho, 5_000)
    expect((await s2.obter('ABCDE'))?.jogadores[0].ultimoPollEm).toBe(5_000)
  })

  it('gravacao so de presenca (mesma versao) atualiza a memoria mas nao reescreve o disco', async () => {
    const caminho = await caminhoTemp()
    const s = await storeArquivo(caminho)
    const comPoll = (versao: number, ultimoPollEm: number): Sala => ({
      ...sala(versao), jogadores: [{ id: 'h', apelido: 'Ana', token: 't', ultimoPollEm }],
    })
    await s.gravarSe(comPoll(1, 0), 0)
    await s.aguardarGravacao()
    const antes = await readFile(caminho, 'utf8')

    expect(await s.gravarSe(comPoll(1, 500), 1)).toBe(true)
    await s.aguardarGravacao()
    expect((await s.obter('ABCDE'))?.jogadores[0].ultimoPollEm).toBe(500)
    expect(await readFile(caminho, 'utf8')).toBe(antes)

    await s.gravarSe(comPoll(2, 900), 1)
    await s.aguardarGravacao()
    expect(JSON.parse(await readFile(caminho, 'utf8')).ABCDE.jogadores[0].ultimoPollEm).toBe(900)
  })

  it('removerExpiradas descarta salas paradas ha mais que o TTL e grava o snapshot', async () => {
    const caminho = await caminhoTemp()
    const s = await storeArquivo(caminho)
    await s.gravarSe({ ...sala(1), codigo: 'VELHA', atualizadaEm: 0 }, 0)
    await s.gravarSe({ ...sala(1), codigo: 'NOVAA', atualizadaEm: 1000 }, 0)
    await s.aguardarGravacao()

    expect(s.removerExpiradas(TTL_SALA_MS + 500)).toBe(1)
    expect(await s.obter('VELHA')).toBeNull()
    expect((await s.obter('NOVAA'))?.versao).toBe(1)
    await s.aguardarGravacao()
    expect(Object.keys(JSON.parse(await readFile(caminho, 'utf8')))).toEqual(['NOVAA'])
  })

  it('arquivo corrompido nao derruba o servidor: comeca vazio', async () => {
    const caminho = await caminhoTemp()
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(join(caminho, '..'), { recursive: true })
    await writeFile(caminho, '{nao json')
    const s = await storeArquivo(caminho)
    expect(await s.obter('ABCDE')).toBeNull()
  })
})
