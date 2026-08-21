const ARTIGOS_INICIAIS = new Set(['o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos'])

export function normalizar(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const palavras = base.split(' ').filter((p) => p.length > 0)
  if (palavras.length > 1 && ARTIGOS_INICIAIS.has(palavras[0])) {
    return palavras.slice(1).join(' ')
  }
  return palavras.join(' ')
}
