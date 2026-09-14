import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StoreSala } from './store'
import { TTL_SALA_MS, type Sala } from './tipos'

export type StoreArquivo = StoreSala & {
  aguardarGravacao(): Promise<void>
  /**
   * Descarta as salas paradas ha mais que o TTL e agenda o snapshot. Quem
   * cria o store chama na subida e periodicamente; aqui nao ha relogio.
   */
  removerExpiradas(agora: number): number
}

/**
 * Memoria como fonte da verdade, com snapshot em disco depois de cada
 * gravacao que muda a versao — para uma partida sobreviver a um restart do
 * processo. Gravacoes so de presenca (mesma versao, a cada poll) ficam apenas
 * na memoria: nao valem uma reescrita do arquivo por segundo. A escrita e
 * atomica (arquivo temporario + rename) e serializada: nunca ha duas escritas
 * em voo, e uma gravacao que chega durante outra so agenda mais uma no fim.
 */
export async function storeArquivo(caminho: string): Promise<StoreArquivo> {
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

  const removerExpiradas = (agora: number): number => {
    let removidas = 0
    for (const [codigo, sala] of salas) {
      if (sala.atualizadaEm + TTL_SALA_MS < agora) {
        salas.delete(codigo)
        removidas++
      }
    }
    if (removidas > 0) agendarEscrita()
    return removidas
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
      if (sala.versao !== versaoAtual) agendarEscrita()
      return true
    },
    aguardarGravacao: () => escrevendo,
    removerExpiradas,
  }
}
