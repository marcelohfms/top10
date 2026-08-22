import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelaSetup } from './TelaSetup'

describe('TelaSetup', () => {
  it('exige pelo menos dois jogadores para comecar', async () => {
    const aoConfigurar = vi.fn()
    render(<TelaSetup aoConfigurar={aoConfigurar} />)
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText('Nome do jogador'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))

    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled()
  })

  it('envia jogadores e modo por categorias', async () => {
    const aoConfigurar = vi.fn()
    render(<TelaSetup aoConfigurar={aoConfigurar} />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.click(screen.getByRole('radio', { name: 'Por categorias' }))
    await usuario.clear(screen.getByLabelText('Quantidade de categorias'))
    await usuario.type(screen.getByLabelText('Quantidade de categorias'), '5')
    await usuario.click(screen.getByRole('button', { name: 'Começar partida' }))

    expect(aoConfigurar).toHaveBeenCalledWith(
      [
        { id: expect.any(String), nome: 'Ana' },
        { id: expect.any(String), nome: 'Bruno' },
      ],
      { tipo: 'categorias', quantidade: 5 },
    )
  })

  it('envia modo por tempo', async () => {
    const aoConfigurar = vi.fn()
    render(<TelaSetup aoConfigurar={aoConfigurar} />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.click(screen.getByRole('radio', { name: 'Por tempo' }))
    await usuario.clear(screen.getByLabelText('Minutos de partida'))
    await usuario.type(screen.getByLabelText('Minutos de partida'), '45')
    await usuario.click(screen.getByRole('button', { name: 'Começar partida' }))

    expect(aoConfigurar).toHaveBeenCalledWith(expect.any(Array), { tipo: 'tempo', minutos: 45 })
  })

  it('adiciona jogadores mesmo sem crypto.randomUUID (contexto nao seguro)', async () => {
    // `vite preview --host` aberto em http://192.168.x.x:4173 nao e um contexto
    // seguro: `crypto.randomUUID` simplesmente nao existe la.
    const descritor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      const aoConfigurar = vi.fn()
      render(<TelaSetup aoConfigurar={aoConfigurar} />)
      const usuario = userEvent.setup()

      for (const nome of ['Ana', 'Bruno']) {
        await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
        await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
      }
      await usuario.click(screen.getByRole('button', { name: 'Começar partida' }))

      const [jogadores] = aoConfigurar.mock.calls[0]
      expect(jogadores.map((j: { nome: string }) => j.nome)).toEqual(['Ana', 'Bruno'])
      expect(new Set(jogadores.map((j: { id: string }) => j.id)).size).toBe(2)
    } finally {
      if (descritor) Object.defineProperty(globalThis, 'crypto', descritor)
    }
  })

  it('remove um jogador da lista', async () => {
    render(<TelaSetup aoConfigurar={vi.fn()} />)
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText('Nome do jogador'), 'Ana')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    await usuario.click(screen.getByRole('button', { name: 'Remover Ana' }))

    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('desabilita comecar partida quando a quantidade de categorias esta vazia', async () => {
    render(<TelaSetup aoConfigurar={vi.fn()} />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.click(screen.getByRole('radio', { name: 'Por categorias' }))
    await usuario.clear(screen.getByLabelText('Quantidade de categorias'))

    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled()
  })

  it('desabilita comecar partida quando os minutos estao vazios', async () => {
    render(<TelaSetup aoConfigurar={vi.fn()} />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.click(screen.getByRole('radio', { name: 'Por tempo' }))
    await usuario.clear(screen.getByLabelText('Minutos de partida'))

    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled()
  })

  it('reabilita comecar partida ao voltar para categorias com quantidade valida', async () => {
    render(<TelaSetup aoConfigurar={vi.fn()} />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.click(screen.getByRole('radio', { name: 'Por tempo' }))
    await usuario.clear(screen.getByLabelText('Minutos de partida'))
    await usuario.click(screen.getByRole('radio', { name: 'Por categorias' }))

    expect(screen.getByRole('button', { name: 'Começar partida' })).not.toBeDisabled()
  })
})
