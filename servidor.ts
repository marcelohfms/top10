import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { dependenciasPadrao, roteador } from './src/servidor/http'
import { resolverArquivoEstatico } from './src/servidor/estatico'
import { escreverResponse, paraRequest } from './src/servidor/node-web'
import { storeArquivo } from './src/servidor/store-arquivo'

const PORTA = Number(process.env.PORTA ?? 3000)
const DIST = resolve(process.env.DIST ?? 'dist')
const DADOS = resolve(process.env.DADOS ?? 'dados/salas.json')

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

const store = await storeArquivo(DADOS)
const deps = dependenciasPadrao(store)

const servidor = createServer(async (req, res) => {
  const url = req.url ?? '/'
  if (url.startsWith('/api/')) {
    await escreverResponse(res, await roteador(await paraRequest(req), deps))
    return
  }

  // Estatico com fallback SPA: qualquer caminho sem arquivo cai no index.html.
  const existeComoArquivo = (caminho: string) => existsSync(caminho) && statSync(caminho).isFile()
  const arquivo = resolverArquivoEstatico(DIST, url, existeComoArquivo)
  res.setHeader('content-type', TIPOS[extname(arquivo)] ?? 'application/octet-stream')
  if (arquivo !== join(DIST, 'index.html')) res.setHeader('cache-control', 'public, max-age=31536000, immutable')
  createReadStream(arquivo).pipe(res)
})

servidor.listen(PORTA, () => {
  console.log(`Top 10 com Blefe em http://localhost:${PORTA} (salas em ${DADOS})`)
})
