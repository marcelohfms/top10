import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storeArquivo } from './store-arquivo'
import type { Sala } from './tipos'

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

  it('arquivo corrompido nao derruba o servidor: comeca vazio', async () => {
    const caminho = await caminhoTemp()
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(join(caminho, '..'), { recursive: true })
    await writeFile(caminho, '{nao json')
    const s = await storeArquivo(caminho)
    expect(await s.obter('ABCDE')).toBeNull()
  })
})
