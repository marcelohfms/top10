import type { Plugin } from 'vite'
import { dependenciasPadrao, roteador } from './http'
import { responderApi } from './node-web'
import { storeMemoria } from './store'

/** Monta as rotas /api no servidor de desenvolvimento do Vite, com store em memoria. */
export function pluginApi(): Plugin {
  const deps = dependenciasPadrao(storeMemoria())
  return {
    name: 'top10-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        req.url = '/api' + (req.url ?? '')
        try {
          await responderApi(req, res, (request) => roteador(request, deps))
        } catch (e) {
          // Mesmo tratamento do servidor.ts: um erro numa requisicao nao vira
          // rejeicao nao tratada no processo do Vite.
          console.error('[api] erro tratando requisicao:', e)
          if (res.headersSent) {
            res.destroy()
          } else {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ erro: 'interno', mensagem: 'Erro interno.' }))
          }
        }
      })
    },
  }
}
