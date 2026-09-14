import type { AcaoSala, ErroServidor, VisaoSala } from '../../servidor/tipos'
import type { Credenciais } from './credenciais'

export type RespostaApi<T> =
  | { ok: true; status: number; corpo: T }
  | { ok: false; status: number; erro: ErroServidor; mensagem: string; detalhe?: string; versao?: number; visao?: VisaoSala }
  | { ok: false; status: 0; erro: 'rede'; mensagem: string }

async function chamar<T>(url: string, init: RequestInit, semCorpo = false): Promise<RespostaApi<T | null>> {
  let resp: Response
  try {
    resp = await fetch(url, init)
  } catch {
    return { ok: false, status: 0, erro: 'rede', mensagem: 'Sem conexão.' }
  }
  if (resp.status === 204 && semCorpo) return { ok: true, status: 204, corpo: null }
  let corpo: Record<string, unknown> = {}
  try {
    corpo = (await resp.json()) as Record<string, unknown>
  } catch {
    // corpo vazio ou nao-JSON
  }
  if (resp.ok) return { ok: true, status: resp.status, corpo: corpo as T }
  return {
    ok: false,
    status: resp.status,
    erro: (corpo.erro as ErroServidor) ?? 'store_indisponivel',
    mensagem: (corpo.mensagem as string) ?? 'Erro inesperado.',
    detalhe: corpo.detalhe as string | undefined,
    versao: corpo.versao as number | undefined,
    visao: corpo.visao as VisaoSala | undefined,
  }
}

const json = (corpo: unknown, extra: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...extra },
  body: JSON.stringify(corpo),
})
const auth = (c: Credenciais) => ({ 'X-Jogador-Id': c.jogadorId, 'X-Jogador-Token': c.token })

export type CorpoEntrada = { jogadorId: string; token: string; versao: number; visao: VisaoSala }
export type CorpoLeitura = { versao: number; visao: VisaoSala }

export function criarSalaApi(apelido: string) {
  return chamar<CorpoEntrada & { codigo: string }>('/api/salas', json({ apelido })) as Promise<RespostaApi<CorpoEntrada & { codigo: string }>>
}
export function entrarApi(codigo: string, apelido: string) {
  return chamar<CorpoEntrada>(`/api/salas/${codigo}/entrar`, json({ apelido })) as Promise<RespostaApi<CorpoEntrada>>
}
export function lerApi(codigo: string, c: Credenciais, versao: number | null, ehHost: boolean | null = null) {
  // `host` e o ultimo status de host que o cliente viu: o servidor devolve 200
  // se ele mudou, mesmo com a mesma versao.
  const q = versao === null ? '' : `?versao=${versao}${ehHost === null ? '' : `&host=${ehHost ? 1 : 0}`}`
  return chamar<CorpoLeitura>(`/api/salas/${codigo}${q}`, { method: 'GET', headers: auth(c) }, true)
}
export function agirApi(codigo: string, c: Credenciais, versao: number, acao: AcaoSala) {
  return chamar<CorpoLeitura>(`/api/salas/${codigo}/acoes`, json({ versao, acao }, auth(c))) as Promise<RespostaApi<CorpoLeitura>>
}
