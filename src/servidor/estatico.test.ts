import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { resolverArquivoEstatico } from './estatico'

const DIST = join('/var/app', 'dist')
const INDEX = join(DIST, 'index.html')

describe('resolverArquivoEstatico', () => {
  it('resolve um asset normal que existe', () => {
    const r = resolverArquivoEstatico(DIST, '/assets/index-abc123.js', (c) => c === join(DIST, 'assets/index-abc123.js'))
    expect(r).toBe(join(DIST, 'assets/index-abc123.js'))
  })

  it('cai no index.html para rota de SPA sem arquivo correspondente', () => {
    const r = resolverArquivoEstatico(DIST, '/sala/KJQTM', () => false)
    expect(r).toBe(INDEX)
  })

  it('cai no index.html para path traversal com ..', () => {
    const r = resolverArquivoEstatico(DIST, '/../etc/passwd', () => true)
    expect(r).toBe(INDEX)
  })

  it('cai no index.html para path traversal codificado (%2f)', () => {
    const r = resolverArquivoEstatico(DIST, '/..%2f..%2fetc/passwd', () => true)
    expect(r).toBe(INDEX)
  })

  it('cai no index.html mesmo se existe() diz que sim para um diretorio irmao (dist-backup)', () => {
    // "join(DIST, url)" normalizado nunca produziria isso sozinho, mas o guard
    // precisa recusar qualquer caminho que apenas comece com a string DIST
    // sem ser de fato dentro dela (ex.: DIST + "-backup/x.js").
    const r = resolverArquivoEstatico(DIST, '/../dist-backup/x.js', () => true)
    expect(r).toBe(INDEX)
  })

  it('ignora query string ao resolver o arquivo', () => {
    const r = resolverArquivoEstatico(DIST, '/assets/app.css?v=2', (c) => c === join(DIST, 'assets/app.css'))
    expect(r).toBe(join(DIST, 'assets/app.css'))
  })

  it('cai no index.html quando o arquivo pedido nao existe', () => {
    const r = resolverArquivoEstatico(DIST, '/assets/nao-existe.js', () => false)
    expect(r).toBe(INDEX)
  })
})
