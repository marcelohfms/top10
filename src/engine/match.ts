import { normalizar } from './normalizar'
import type { ItemCategoria } from './types'

const LIMIAR_SIMILARIDADE = 0.85
const TAMANHO_MINIMO_PARA_TOLERANCIA = 6

/**
 * Damerau-Levenshtein na variante OSA (optimal string alignment): igual a
 * Levenshtein, mas trocar duas letras vizinhas custa 1 em vez de 2. Isso e o
 * que separa um erro de digitacao ("nitorgenio") de um palpite errado.
 */
export function distanciaEdicao(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const linhas = a.length + 1
  const colunas = b.length + 1
  const d: number[][] = Array.from({ length: linhas }, (_, i) =>
    Array.from({ length: colunas }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )

  for (let i = 1; i < linhas; i++) {
    for (let j = 1; j < colunas; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i][j - 1] + 1, d[i - 1][j] + 1, d[i - 1][j - 1] + custo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }

  return d[a.length][b.length]
}

export function similaridade(a: string, b: string): number {
  const maior = Math.max(a.length, b.length)
  if (maior === 0) return 1
  return 1 - distanciaEdicao(a, b) / maior
}

function casaComTolerancia(palpite: string, alvo: string): boolean {
  if (palpite === alvo) return true
  // Strings curtas exigem match exato: a distancia de edicao entre paises
  // curtos e pequena demais para distinguir palpite errado de erro de digitacao.
  if (alvo.length < TAMANHO_MINIMO_PARA_TOLERANCIA) return false
  if (palpite.length < TAMANHO_MINIMO_PARA_TOLERANCIA) return false
  return similaridade(palpite, alvo) >= LIMIAR_SIMILARIDADE
}

export function casaComItem(palpite: string, item: ItemCategoria): boolean {
  const p = normalizar(palpite)
  if (p === '') return false

  const alvos = [item.nome, ...item.apelidos].map(normalizar)
  return alvos.some((alvo) => casaComTolerancia(p, alvo))
}

export function encontrarItem(palpite: string, itens: ItemCategoria[]): ItemCategoria | null {
  return itens.find((item) => casaComItem(palpite, item)) ?? null
}
