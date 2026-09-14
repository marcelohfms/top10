import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StoreSala } from './store'
import type { Sala } from './tipos'

/**
 * Memoria como fonte da verdade, com snapshot em disco depois de cada
 * gravacao bem-sucedida — para uma partida sobreviver a um restart do
 * processo. A escrita e atomica (arquivo temporario + rename) e serializada:
 * nunca ha duas escritas em voo, e uma gravacao que chega durante outra so
 * agenda mais uma no fim.
 */
export async function storeArquivo(caminho: string): Promise<StoreSala & { aguardarGravacao(): Promise<void> }> {
  const salas = new Map<string, Sala>()
  try {
    const bruto = JSON.parse(await readFile(caminho, 'utf8')) as Record<string, Sala>
    for (const [codigo, sala] of Object.entries(bruto)) salas.set(codigo, sala)
  } catch {
    // arquivo inexistente ou corrompido: comeca vazio
  }

  let escrevendo: Promise<void> = Promise.resolve()
  let pendente = false

  const escrever = async () => {
    await mkdir(dirname(caminho), { recursive: true })
    const temp = `${caminho}.tmp`
    await writeFile(temp, JSON.stringify(Object.fromEntries(salas)))
    await rename(temp, caminho)
  }

  const agendarEscrita = () => {
    if (pendente) return
    pendente = true
    escrevendo = escrevendo.then(async () => {
      pendente = false
      try {
        await escrever()
      } catch (e) {
        console.error('[store-arquivo] falha ao gravar snapshot:', e)
      }
    })
  }

  return {
    async obter(codigo) {
      const s = salas.get(codigo)
      return s === undefined ? null : structuredClone(s)
    },
    async gravarSe(sala, versaoEsperada) {
      const atual = salas.get(sala.codigo)
      const versaoAtual = atual === undefined ? 0 : atual.versao
      if (versaoAtual !== versaoEsperada) return false
      salas.set(sala.codigo, structuredClone(sala))
      agendarEscrita()
      return true
    },
    aguardarGravacao: () => escrevendo,
  }
}
