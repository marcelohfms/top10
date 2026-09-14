export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const TAMANHO = 5

export function gerarCodigo(aleatorio: () => number): string {
  let s = ''
  for (let i = 0; i < TAMANHO; i++) {
    s += ALFABETO_CODIGO[Math.floor(aleatorio() * ALFABETO_CODIGO.length)]
  }
  return s
}

export function codigoValido(s: string): boolean {
  return s.length === TAMANHO && [...s].every((l) => ALFABETO_CODIGO.includes(l))
}
