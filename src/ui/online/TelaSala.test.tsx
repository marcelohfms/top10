import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TelaSala } from './TelaSala'
import { salvarCredenciais } from './credenciais'
import type { VisaoSala } from '../../servidor/tipos'

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }))

const resposta = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn().mockResolvedValue(resposta(204))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const lobby: VisaoSala = {
  codigo: 'KJQTM', hostId: 'h', jogadorId: 'b', ehHost: false,
  jogadores: [{ id: 'h', apelido: 'Ana' }, { id: 'b', apelido: 'Bruno' }], jogo: null,
}

describe('TelaSala', () => {
  it('sem credenciais pede apelido', () => {
    render(<TelaSala codigo="KJQTM" />)
    expect(screen.getByLabelText('Seu apelido')).toBeInTheDocument()
  })

  it('com credenciais mostra o lobby', async () => {
    salvarCredenciais('KJQTM', { jogadorId: 'b', token: 't' })
    fetchMock.mockResolvedValueOnce(resposta(200, { versao: 1, visao: lobby }))
    render(<TelaSala codigo="KJQTM" />)
    await waitFor(() => expect(screen.getByText('KJQTM')).toBeInTheDocument())
    expect(screen.getByText(/aguardando/i)).toBeInTheDocument()
  })

  it('sala inexistente mostra aviso', async () => {
    salvarCredenciais('KJQTM', { jogadorId: 'b', token: 't' })
    fetchMock.mockResolvedValue(resposta(404, { erro: 'sala_inexistente', mensagem: 'Sala não encontrada ou expirada.' }))
    render(<TelaSala codigo="KJQTM" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não encontrada/))
  })
})
