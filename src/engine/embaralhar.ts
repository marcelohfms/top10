/** Fisher-Yates sobre uma copia; `aleatorio` injetavel para testes deterministicos. */
export function embaralhar<T>(itens: readonly T[], aleatorio: () => number = Math.random): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}
