import type { IncomingMessage, ServerResponse } from 'node:http'

export async function paraRequest(req: IncomingMessage, origem = 'http://localhost'): Promise<Request> {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const pedacos: Buffer[] = []
  for await (const p of req) pedacos.push(p as Buffer)
  const body = pedacos.length > 0 ? Buffer.concat(pedacos) : undefined
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
