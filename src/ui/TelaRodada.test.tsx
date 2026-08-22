import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelaRodada } from './TelaRodada'
import { criarJogo, aplicarAcaoJogo } from '../engine/jogo'
import type { Categoria, EstadoJogo } from '../engine/types'

const categoria: Categoria = {
  id: 'c1',
  titulo: 'Categoria de teste',
  fonte: 'teste',
  itens: Array.from({ length: 10 }, (_, i) => ({ nome: `Item ${i}`, apelidos: [] })),
}

function estadoConfigurado(): EstadoJogo {
  const r = aplicarAcaoJogo(
    criarJogo([categoria]),
    {
      tipo: 'configurar',
      jogadores: [
        { id: 'a', nome: 'Ana' },
        { id: 'b', nome: 'Bruno' },
      ],
      modo: { tipo: 'categorias', quantidade: 1 },
    },
    0,
  )
  if (!r.ok) throw new Error('setup falhou')
  return r.estado
}

function estadoEmRodada(): EstadoJogo {
  const r = aplicarAcaoJogo(estadoConfigurado(), { tipo: 'iniciar_rodada', categoriaId: 'c1' }, 0)
  if (!r.ok) throw new Error('inicio falhou')
  return r.estado
}

describe('TelaRodada — escolha de categoria', () => {
  it('lista as categorias disponiveis quando nao ha rodada', async () => {
    const aoEscolherCategoria = vi.fn()
    render(
      <TelaRodada
        estado={estadoConfigurado()}
        erro={null}
        aoEscolherCategoria={aoEscolherCategoria}
        aoAgir={vi.fn()}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Categoria de teste' }))
    expect(aoEscolherCategoria).toHaveBeenCalledWith('c1')
  })
})

describe('TelaRodada — fase de palpite', () => {
  it('mostra de quem e a vez e nao revela nenhum item da lista', () => {
    render(
      <TelaRodada estado={estadoEmRodada()} erro={null} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.getByText(/Vez de Ana/)).toBeInTheDocument()
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument()
  })

  it('envia o palpite digitado', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoEmRodada()} erro={null} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    const usuario = userEvent.setup()
    await usuario.type(screen.getByLabelText('Seu palpite'), 'Item 3')
    await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'palpite', texto: 'Item 3' })
  })

  it('exibe aviso de palpite duplicado', () => {
    render(
      <TelaRodada
        estado={estadoEmRodada()}
        erro="palpite_duplicado"
        aoEscolherCategoria={vi.fn()}
        aoAgir={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('já foi dito')
  })
})

describe('TelaRodada — janela de duvida', () => {
  function estadoComPalpite(): EstadoJogo {
    const r = aplicarAcaoJogo(
      estadoEmRodada(),
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Item 3' } },
      0,
    )
    if (!r.ok) throw new Error('palpite falhou')
    return r.estado
  }

  it('mostra o palpite e um botao de duvidar por jogador vivo, exceto o autor', () => {
    render(
      <TelaRodada estado={estadoComPalpite()} erro={null} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.getByText(/Item 3/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bruno duvida' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ana duvida' })).not.toBeInTheDocument()
  })

  it('envia a duvida', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoComPalpite()} erro={null} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bruno duvida' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'duvidar', duvidadorId: 'b' })
  })

  it('envia ninguem duvidou', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoComPalpite()} erro={null} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ninguém duvidou' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'ninguem_duvidou' })
  })
})
