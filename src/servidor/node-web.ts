import type { IncomingMessage, ServerResponse } from 'node:http'
import { respostaErro } from './http'

/** Maior corpo aceito. A API so recebe JSON pequeno; acima disso e abuso. */
export const LIMITE_CORPO_BYTES = 64 * 1024

export class ErroCorpoGrande extends Error {
  constructor() {
    super(`corpo maior que ${LIMITE_CORPO_BYTES} bytes`)
    this.name = 'ErroCorpoGrande'
  }
}

/**
 * Le o corpo ate o limite. Ao estourar, para de ler (sem destruir o socket:
 * a resposta 413 ainda precisa sair) e rejeita com ErroCorpoGrande.
 */
function lerCorpo(req: IncomingMessage): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const pedacos: Buffer[] = []
    let total = 0
    const aoReceber = (p: Buffer) => {
      total += p.length
      if (total > LIMITE_CORPO_BYTES) {
        req.off('data', aoReceber)
        req.pause()
        reject(new ErroCorpoGrande())
        return
      }
      pedacos.push(p)
    }
    req.on('data', aoReceber)
    req.on('end', () => resolve(pedacos.length > 0 ? Buffer.concat(pedacos) : undefined))
    req.on('error', reject)
  })
}

export async function paraRequest(req: IncomingMessage, origem = 'http://localhost'): Promise<Request> {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const body = await lerCorpo(req)
  return new Request(origem + (req.url ?? '/'), {
    method: req.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  })
}

export async function escreverResponse(res: ServerResponse, resp: Response): Promise<void> {
  res.statusCode = resp.status
  resp.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(resp.status === 204 ? undefined : await resp.text())
}

/**
 * Converte a requisicao do Node, entrega ao roteador e escreve a resposta.
 * Corpo acima do limite vira 413 e a conexao e fechada depois da resposta,
 * para o resto do corpo nao ficar pendurado no socket.
 */
export async function responderApi(
  req: IncomingMessage,
  res: ServerResponse,
  tratar: (request: Request) => Promise<Response>,
): Promise<void> {
  let request: Request
  try {
    request = await paraRequest(req)
  } catch (e) {
    if (!(e instanceof ErroCorpoGrande)) throw e
    res.setHeader('connection', 'close')
    res.once('finish', () => req.destroy())
    await escreverResponse(res, respostaErro('corpo_grande'))
    return
  }
  await escreverResponse(res, await tratar(request))
}
