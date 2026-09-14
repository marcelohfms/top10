import { join, normalize, sep } from 'node:path'

/**
 * Resolve o arquivo estatico a servir para uma URL: o proprio arquivo se ele
 * cair DENTRO de `dist` e existir, senao o `index.html` (fallback de SPA).
 *
 * `dist` deve ser um caminho absoluto ja resolvido (ver `resolve()` em
 * `servidor.ts`). A checagem usa `dist + sep` como prefixo — nao so `dist` —
 * para que um diretorio irmao cujo nome estende o de `dist` (ex.: `dist` vs
 * `dist-backup`) nunca seja aceito so por `startsWith` casar como string.
 * `existe` e injetado para a funcao ficar pura e testavel sem tocar disco.
 */
export function resolverArquivoEstatico(dist: string, url: string, existe: (caminho: string) => boolean): string {
  const indice = join(dist, 'index.html')
  const semQuery = url.split('?')[0] ?? '/'
  const caminho = normalize(join(dist, decodeURIComponentSeguro(semQuery)))
  const dentroDeDist = caminho === dist || caminho.startsWith(dist + sep)
  return dentroDeDist && existe(caminho) ? caminho : indice
}

function decodeURIComponentSeguro(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
