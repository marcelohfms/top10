import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TelaFimJogo } from './TelaFimJogo'
import type { Categoria, EstadoJogo } from '../engine/types'

const categoria: Categoria = {
  id: 'c1',
  titulo: 'Categoria de teste',
  fonte: 'teste',
  itens: Array.from({ length: 10 }, (_, i) => ({ nome: `Item ${i}`, apelidos: [] })),
}

const base: EstadoJogo = {
  fase: 'fim_jogo',
  catalogo: [categoria],
  jogadores: [
    { id: 'a', nome: 'Ana' },
    { id: 'b', nome: 'Bruno' },
  ],
  placar: { a: 2, b: 2 },
  relogio: {
    modo: { tipo: 'tempo', minutos: 30 },
    iniciadoEm: 0,
    pausadoEm: null,
    msPausados: 0,
    expirado: true,
  },
  rodada: null,
  concluidas: [{ categoria, vencedorId: null, abortada: true }],
  encerrarAposRodada: false,
  faseAntesDaDecisao: null,
}

describe('TelaFimJogo', () => {
  it('mostra empate quando ha empate no topo', () => {
    render(<TelaFimJogo estado={base} aoReiniciar={vi.fn()} />)
    expect(screen.getByText(/Empate/)).toBeInTheDocument()
  })

  it('revela a lista da rodada abortada', () => {
    render(<TelaFimJogo estado={base} aoReiniciar={vi.fn()} />)
    expect(screen.getByText(/rodada interrompida/i)).toBeInTheDocument()
    expect(screen.getByText('Item 0')).toBeInTheDocument()
  })

  it('mostra um unico vencedor quando nao ha empate', () => {
    render(<TelaFimJogo estado={{ ...base, placar: { a: 3, b: 1 } }} aoReiniciar={vi.fn()} />)
    expect(screen.getByText(/Ana venceu a partida/)).toBeInTheDocument()
  })
})
