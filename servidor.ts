import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
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

// Varredura de salas expiradas: na subida e a cada 10 min, para memoria e
// arquivo nao crescerem para sempre. O roteador ja recusa acesso a elas.
const INTERVALO_VARREDURA_MS = 10 * 60 * 1000
const varrer = () => {
  const n = store.removerExpiradas(Date.now())
  if (n > 0) console.log(`[servidor] ${n} sala(s) expirada(s) removida(s)`)
}
varrer()
setInterval(varrer, INTERVALO_VARREDURA_MS).unref()

async function tratar(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const leitura = createReadStream(arquivo)
    leitura.on('error', rejectPromise)
    res.on('close', resolvePromise)
    leitura.pipe(res)
  })
}

const servidor = createServer(async (req, res) => {
  try {
    await tratar(req, res)
  } catch (e) {
    // Uma unica requisicao malformada (ex.: null byte na URL) nunca pode
    // derrubar o processo inteiro — isso reiniciaria o pm2 e descartaria
    // todas as salas em memoria ate o proximo snapshot.
    console.error('[servidor] erro tratando requisicao:', e)
    if (res.headersSent) {
      res.destroy()
    } else {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ erro: 'interno', mensagem: 'Erro interno.' }))
    }
  }
})

servidor.listen(PORTA, () => {
  console.log(`Top 10 com Blefe em http://localhost:${PORTA} (salas em ${DADOS})`)
})
