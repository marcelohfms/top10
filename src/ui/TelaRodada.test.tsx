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

function estadoComPalpite(): EstadoJogo {
  const r = aplicarAcaoJogo(
    estadoEmRodada(),
    { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Item 3', jogadorId: 'a' } },
    0,
  )
  if (!r.ok) throw new Error('palpite falhou')
  return r.estado
}

describe('TelaRodada — escolha de categoria', () => {
  it('lista as categorias disponiveis quando nao ha rodada', async () => {
    const aoEscolherCategoria = vi.fn()
    render(
      <TelaRodada
        estado={estadoConfigurado()}
        categorias={[{ id: 'c1', titulo: 'Categoria de teste' }]}
        perspectiva="mesa"
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
      <TelaRodada
        estado={estadoEmRodada()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={vi.fn()}
      />,
    )
    expect(screen.getByText(/Vez de Ana/)).toBeInTheDocument()
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument()
  })

  it('envia o palpite digitado', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada
        estado={estadoEmRodada()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={aoAgir}
      />,
    )
    const usuario = userEvent.setup()
    await usuario.type(screen.getByLabelText('Seu palpite'), 'Item 3')
    await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'palpite', texto: 'Item 3', jogadorId: 'a' })
  })

  it('exibe aviso de palpite duplicado', () => {
    render(
      <TelaRodada
        estado={estadoEmRodada()}
        categorias={[]}
        perspectiva="mesa"
        erro="palpite_duplicado"
        aoEscolherCategoria={vi.fn()}
        aoAgir={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('já foi dito')
  })

  it('envia o palpite ao pressionar Enter, igual ao botao', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada
        estado={estadoEmRodada()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={aoAgir}
      />,
    )
    const usuario = userEvent.setup()
    await usuario.type(screen.getByLabelText('Seu palpite'), 'Item 3{Enter}')
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'palpite', texto: 'Item 3', jogadorId: 'a' })
  })

  it('envia o palpite ao pressionar Enter mesmo com o campo vazio', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada
        estado={estadoEmRodada()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={aoAgir}
      />,
    )
    const usuario = userEvent.setup()
    await usuario.type(screen.getByLabelText('Seu palpite'), '{Enter}')
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'palpite', texto: '', jogadorId: 'a' })
  })

  it('limpa o campo apos enviar com Enter', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada
        estado={estadoEmRodada()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={aoAgir}
      />,
    )
    const usuario = userEvent.setup()
    const campo = screen.getByLabelText('Seu palpite') as HTMLInputElement
    await usuario.type(campo, 'Item 3{Enter}')
    expect(campo.value).toBe('')
  })
})

describe('TelaRodada — janela de duvida', () => {
  it('mostra o palpite e um botao de duvidar por jogador vivo, exceto o autor', () => {
    render(
      <TelaRodada
        estado={estadoComPalpite()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={vi.fn()}
      />,
    )
    expect(screen.getByText(/Item 3/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bruno duvida' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ana duvida' })).not.toBeInTheDocument()
  })

  it('envia a duvida', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada
        estado={estadoComPalpite()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={aoAgir}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bruno duvida' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'duvidar', duvidadorId: 'b' })
  })

  it('envia ninguem duvidou', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada
        estado={estadoComPalpite()}
        categorias={[]}
        perspectiva="mesa"
        erro={null}
        aoEscolherCategoria={vi.fn()}
        aoAgir={aoAgir}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ninguém duvidou' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'ninguem_duvidou' })
  })
})

describe('TelaRodada — perspectiva de jogador', () => {
  const p = (jogadorId: string, podeAgir: Partial<{ palpite: boolean; duvidar: boolean; host: boolean }>) =>
    ({ jogadorId, podeAgir: { palpite: false, duvidar: false, host: false, ...podeAgir } }) as const

  it('quem e a vez ve o campo; quem nao e, so a mesa', () => {
    const estado = estadoEmRodada()
    const { rerender } = render(
      <TelaRodada estado={estado} categorias={[]} erro={null} perspectiva={p('a', { palpite: true })} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.getByLabelText('Seu palpite')).toBeInTheDocument()
    rerender(
      <TelaRodada estado={estado} categorias={[]} erro={null} perspectiva={p('b', {})} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.queryByLabelText('Seu palpite')).not.toBeInTheDocument()
    expect(screen.getByText(/Vez de Ana/)).toBeInTheDocument()
  })

  it('palpite leva o jogadorId da perspectiva', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoEmRodada()} categorias={[]} erro={null} perspectiva={p('a', { palpite: true })} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu palpite'), 'Item 3')
    await u.click(screen.getByRole('button', { name: 'Dar palpite' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'palpite', texto: 'Item 3', jogadorId: 'a' })
  })

  it('na janela, um unico botao Duvido para quem pode, e nunca "Ninguem duvidou"', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoComPalpite()} categorias={[]} erro={null} perspectiva={p('b', { duvidar: true, palpite: true })} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    expect(screen.queryByRole('button', { name: 'Ninguém duvidou' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bruno duvida/ })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Duvido' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'duvidar', duvidadorId: 'b' })
    expect(screen.getByLabelText('Seu palpite')).toBeInTheDocument()
  })

  it('autor do palpite nao ve Duvido', () => {
    render(
      <TelaRodada estado={estadoComPalpite()} categorias={[]} erro={null} perspectiva={p('a', {})} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: 'Duvido' })).not.toBeInTheDocument()
  })

  it('escolha de categoria so para host', () => {
    const estado = estadoConfigurado()
    const cats = [{ id: 'c1', titulo: 'Categoria de teste' }]
    const { rerender } = render(
      <TelaRodada estado={estado} categorias={cats} erro={null} perspectiva={p('a', { host: true })} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Categoria de teste' })).toBeInTheDocument()
    rerender(
      <TelaRodada estado={estado} categorias={[]} erro={null} perspectiva={p('b', {})} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: 'Categoria de teste' })).not.toBeInTheDocument()
    expect(screen.getByText(/anfitrião/i)).toBeInTheDocument()
  })
})
