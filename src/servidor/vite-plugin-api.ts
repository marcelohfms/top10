import type { Plugin } from 'vite'
import { dependenciasPadrao, roteador } from './http'
import { escreverResponse, paraRequest } from './node-web'
import { storeMemoria } from './store'

/** Monta as rotas /api no servidor de desenvolvimento do Vite, com store em memoria. */
export function pluginApi(): Plugin {
  const deps = dependenciasPadrao(storeMemoria())
  return {
    name: 'top10-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        req.url = '/api' + (req.url ?? '')
        await escreverResponse(res, await roteador(await paraRequest(req), deps))
      })
    },
  }
}
