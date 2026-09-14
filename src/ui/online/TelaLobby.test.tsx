import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelaLobby } from './TelaLobby'
import type { VisaoSala } from '../../servidor/tipos'
import type { VisaoJogo } from '../../engine/types'

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }))

const base: VisaoSala = {
  codigo: 'KJQTM', hostId: 'h', jogadorId: 'h', ehHost: true,
  jogadores: [{ id: 'h', apelido: 'Ana' }, { id: 'b', apelido: 'Bruno' }], jogo: null,
}

describe('TelaLobby', () => {
  it('mostra codigo, QR e jogadores', () => {
    render(<TelaLobby visao={base} urlSala="http://x/sala/KJQTM" aoIniciar={vi.fn()} aoEntrarNaPartida={vi.fn()} />)
    expect(screen.getByText('KJQTM')).toBeInTheDocument()
    expect(screen.getByLabelText('QR code do link da sala')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('host escolhe o modo e inicia', async () => {
    const aoIniciar = vi.fn()
    render(<TelaLobby visao={base} urlSala="u" aoIniciar={aoIniciar} aoEntrarNaPartida={vi.fn()} />)
    const u = userEvent.setup()
    await u.click(screen.getByRole('radio', { name: 'Por tempo' }))
    await u.clear(screen.getByLabelText('Minutos de partida'))
    await u.type(screen.getByLabelText('Minutos de partida'), '20')
    await u.click(screen.getByRole('button', { name: 'Começar partida' }))
    expect(aoIniciar).toHaveBeenCalledWith({ tipo: 'tempo', minutos: 20 })
  })

  it('host com um jogador so nao pode iniciar', () => {
    render(<TelaLobby visao={{ ...base, jogadores: [base.jogadores[0]] }} urlSala="u" aoIniciar={vi.fn()} aoEntrarNaPartida={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled()
  })

  it('nao host ve espera, sem controles', () => {
    render(<TelaLobby visao={{ ...base, jogadorId: 'b', ehHost: false }} urlSala="u" aoIniciar={vi.fn()} aoEntrarNaPartida={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument()
    expect(screen.getByText(/aguardando/i)).toBeInTheDocument()
  })

  it('quem chega com a partida rolando pode entrar na proxima rodada', async () => {
    const aoEntrarNaPartida = vi.fn()
    const jogo: VisaoJogo = { jogadorId: 'c', fase: 'em_rodada', jogadores: [{ id: 'h', nome: 'Ana' }, { id: 'b', nome: 'Bruno' }], placar: {}, relogio: { modo: { tipo: 'categorias', quantidade: 3 }, iniciadoEm: null, pausadoEm: null, msPausados: 0, expirado: false }, rodada: null, concluidas: [], encerrarAposRodada: false, categoriasDisponiveis: [], podeAgir: { palpite: false, duvidar: false, host: false } }
    render(<TelaLobby visao={{ ...base, jogadorId: 'c', ehHost: false, jogo }} urlSala="u" aoIniciar={vi.fn()} aoEntrarNaPartida={aoEntrarNaPartida} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar na próxima rodada' }))
    expect(aoEntrarNaPartida).toHaveBeenCalled()
  })
})
