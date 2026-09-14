import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TelaRevelacao } from './TelaRevelacao'
import { criarJogo, aplicarAcaoJogo } from '../engine/jogo'
import type { AcaoJogo, Categoria, EstadoJogo } from '../engine/types'

const categoria: Categoria = {
  id: 'c1',
  titulo: 'Categoria de teste',
  fonte: 'Fonte X, 2024',
  itens: Array.from({ length: 10 }, (_, i) => ({ nome: `Item ${i}`, apelidos: [] })),
}

function encadear(estado: EstadoJogo, ...acoes: AcaoJogo[]): EstadoJogo {
  return acoes.reduce((atual, acao) => {
    const r = aplicarAcaoJogo(atual, acao, 0)
    if (!r.ok) throw new Error(r.erro)
    return r.estado
  }, estado)
}

describe('TelaRevelacao', () => {
  it('revela os 10 itens em ordem, com a fonte e o vencedor', () => {
    const estado = encadear(
      criarJogo([categoria]),
      {
        tipo: 'configurar',
        jogadores: [{ id: 'a', nome: 'Ana' }, { id: 'b', nome: 'Bruno' }],
        modo: { tipo: 'categorias', quantidade: 2 },
      },
      { tipo: 'iniciar_rodada', categoriaId: 'c1' },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
    )

    render(<TelaRevelacao estado={estado} perspectiva="mesa" aoAvancar={vi.fn()} />)

    const itens = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(itens[0]).toContain('Item 0')
    expect(itens[9]).toContain('Item 9')
    expect(screen.getByText(/Fonte X, 2024/)).toBeInTheDocument()
    expect(screen.getByText(/Bruno venceu/)).toBeInTheDocument()
  })
})
