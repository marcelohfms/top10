import type { Sala } from './tipos'

/**
 * Compare-and-set: `gravarSe` so grava se a versao atual no store for
 * exatamente `versaoEsperada` (0 = ainda nao existe). E o que resolve dois
 * "Duvido" chegando ao mesmo tempo sem lock.
 */
export interface StoreSala {
  obter(codigo: string): Promise<Sala | null>
  gravarSe(sala: Sala, versaoEsperada: number): Promise<boolean>
}

export function storeMemoria(): StoreSala & { limpar(): void } {
  const salas = new Map<string, string>()
  return {
    async obter(codigo) {
      const bruto = salas.get(codigo)
      return bruto === undefined ? null : (JSON.parse(bruto) as Sala)
    },
    async gravarSe(sala, versaoEsperada) {
      const atual = salas.get(sala.codigo)
      const versaoAtual = atual === undefined ? 0 : (JSON.parse(atual) as Sala).versao
      if (versaoAtual !== versaoEsperada) return false
      salas.set(sala.codigo, JSON.stringify(sala))
      return true
    },
    limpar() {
      salas.clear()
    },
  }
}
