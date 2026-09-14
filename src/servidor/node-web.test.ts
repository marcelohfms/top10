import { describe, it, expect } from 'vitest'
import { createServer, request as requisicao, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { LIMITE_CORPO_BYTES, responderApi } from './node-web'

type Resposta = { status: number; corpo: string }

function subir(tratar: (r: Request) => Promise<Response>): Promise<Server> {
  return new Promise((resolve) => {
    const s = createServer((req, res) => { void responderApi(req, res, tratar) })
    s.listen(0, '127.0.0.1', () => resolve(s))
  })
}

function enviar(servidor: Server, corpo: string): Promise<Resposta> {
  const { port } = servidor.address() as AddressInfo
  return new Promise((resolve, reject) => {
    let respondeu = false
    const req = requisicao({ host: '127.0.0.1', port, method: 'POST', path: '/api/salas', headers: { 'content-type': 'application/json' } }, (res) => {
      let texto = ''
      res.setEncoding('utf8')
      res.on('data', (p: string) => { texto += p })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, corpo: texto }))
    })
    // O servidor pode cortar a conexao antes de ler tudo: o erro de escrita
    // nao importa se a resposta chegou.
    req.on('error', (e) => { if (!respondeu) reject(e) })
    req.end(corpo)
  })
}

describe('responderApi', () => {
  it('passa um corpo pequeno ao roteador e devolve a resposta dele', async () => {
    const servidor = await subir(async (r) => new Response(JSON.stringify({ eco: await r.json() }), { status: 200 }))
    try {
      const r = await enviar(servidor, JSON.stringify({ apelido: 'Ana' }))
      expect(r.status).toBe(200)
      expect(JSON.parse(r.corpo)).toEqual({ eco: { apelido: 'Ana' } })
    } finally {
      servidor.close()
    }
  })

  it('corpo maior que o limite recebe 413 sem chegar ao roteador', async () => {
    let chamadas = 0
    const servidor = await subir(async () => { chamadas++; return new Response(null, { status: 204 }) })
    try {
      const r = await enviar(servidor, 'x'.repeat(LIMITE_CORPO_BYTES + 1))
      expect(r.status).toBe(413)
      expect(JSON.parse(r.corpo).erro).toBe('corpo_grande')
      expect(chamadas).toBe(0)
    } finally {
      servidor.close()
    }
  })
})
