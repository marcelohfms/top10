import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSala } from './useSala'
import { salvarCredenciais, lerCredenciais } from './credenciais'
import type { VisaoSala } from '../../servidor/tipos'

const visao = (versao: number): VisaoSala => ({
  codigo: 'ABCDE', hostId: 'h', jogadorId: 'h', ehHost: true,
  jogadores: [{ id: 'h', apelido: 'Ana' }], jogo: null, ...({ versao } as object),
})

function resposta(status: number, corpo?: unknown) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useSala', () => {
  it('sem credenciais nao faz poll', () => {
    const { result } = renderHook(() => useSala('ABCDE'))
    expect(result.current.conexao).toBe('sem_credenciais')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('entrar salva credenciais e comeca a fazer poll', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { jogadorId: 'j', token: 't', versao: 2, visao: visao(2) }))
      .mockResolvedValue(resposta(204))
    const { result } = renderHook(() => useSala('ABCDE'))
    await act(() => result.current.entrar('Bruno'))
    expect(lerCredenciais('ABCDE')).toEqual({ jogadorId: 'j', token: 't' })
    expect(result.current.versao).toBe(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(String(url)).toContain('/api/salas/ABCDE?versao=2')
    expect((init as RequestInit).headers).toMatchObject({ 'X-Jogador-Id': 'j', 'X-Jogador-Token': 't' })
  })

  it('o poll informa o ultimo status de host conhecido', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockResolvedValueOnce(resposta(200, { versao: 1, visao: { ...visao(1), ehHost: false } }))
      .mockResolvedValueOnce(resposta(200, { versao: 1, visao: { ...visao(1), ehHost: true } }))
      .mockResolvedValue(resposta(204))
    const { result } = renderHook(() => useSala('ABCDE'))
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/salas/ABCDE')
    await waitFor(() => expect(result.current.visao?.ehHost).toBe(false))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/salas/ABCDE?versao=1&host=0')
    await waitFor(() => expect(result.current.visao?.ehHost).toBe(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(String(fetchMock.mock.calls[2][0])).toBe('/api/salas/ABCDE?versao=1&host=1')
  })

  it('204 mantem a visao; 200 substitui', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockResolvedValueOnce(resposta(200, { versao: 1, visao: visao(1) }))
      .mockResolvedValueOnce(resposta(204))
      .mockResolvedValueOnce(resposta(200, { versao: 3, visao: visao(3) }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.versao).toBe(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.versao).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.versao).toBe(3)
    expect(result.current.conexao).toBe('ok')
  })

  it('falha de rede vira reconectando com backoff, e volta ao normal', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockRejectedValueOnce(new Error('rede'))
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(resposta(200, { versao: 1, visao: visao(1) }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.conexao).toBe('reconectando'))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(result.current.conexao).toBe('ok')
  })

  it('404 para o poll e marca sala inexistente', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock.mockResolvedValue(resposta(404, { erro: 'sala_inexistente', mensagem: 'x' }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.conexao).toBe('sala_inexistente'))
    const n = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(fetchMock.mock.calls.length).toBe(n)
  })

  it('403 limpa credenciais', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock.mockResolvedValue(resposta(403, { erro: 'token_invalido', mensagem: 'x' }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.conexao).toBe('token_invalido'))
    expect(lerCredenciais('ABCDE')).toBeNull()
  })

  it('agir com 409 adota a visao devolvida; 422 expoe o erro; sucesso limpa', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockResolvedValueOnce(resposta(200, { versao: 1, visao: visao(1) }))
      .mockResolvedValueOnce(resposta(409, { erro: 'versao_desatualizada', mensagem: 'x', versao: 2, visao: visao(2) }))
      .mockResolvedValueOnce(resposta(422, { erro: 'acao_rejeitada', mensagem: 'Ação inválida', detalhe: 'palpite_vazio' }))
      .mockResolvedValueOnce(resposta(200, { versao: 3, visao: visao(3) }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.versao).toBe(1))
    await act(() => result.current.agir({ tipo: 'avancar' }))
    expect(result.current.versao).toBe(2)
    await act(() => result.current.agir({ tipo: 'avancar' }))
    expect(result.current.erro).toEqual({ mensagem: 'Ação inválida', detalhe: 'palpite_vazio' })
    await act(() => result.current.agir({ tipo: 'avancar' }))
    expect(result.current.erro).toBeNull()
    expect(result.current.versao).toBe(3)
  })

  it('pausa o poll com a aba oculta e retoma ao voltar', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock.mockResolvedValue(resposta(204))
    renderHook(() => useSala('ABCDE'))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const antes = fetchMock.mock.calls.length
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(fetchMock.mock.calls.length).toBe(antes)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(fetchMock.mock.calls.length).toBeGreaterThan(antes)
  })
})
