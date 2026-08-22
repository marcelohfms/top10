import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { limparEstado } from '../persistencia'

beforeEach(() => limparEstado())

describe('App — partida completa', () => {
  it('vai do setup ao fim de jogo em uma rodada', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.clear(screen.getByLabelText('Quantidade de categorias'))
    await usuario.type(screen.getByLabelText('Quantidade de categorias'), '1')
    await usuario.click(screen.getByRole('button', { name: 'Começar partida' }))

    // Escolhe a primeira categoria disponivel.
    const botoesCategoria = screen.getAllByRole('button')
    await usuario.click(botoesCategoria[0])

    // Ana chuta algo certamente ausente e Bruno duvida: Ana sai, Bruno vence.
    await usuario.type(screen.getByLabelText('Seu palpite'), 'zzzqqqxxx')
    await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))
    await usuario.click(screen.getByRole('button', { name: 'Bruno duvida' }))

    expect(screen.getByText(/Bruno venceu a rodada/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Fim de jogo')).toBeInTheDocument()
  })

  it('rejeita palpite duplicado sem passar a vez', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    for (const nome of ['Ana', 'Bruno']) {
      await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
      await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
    }
    await usuario.click(screen.getByRole('button', { name: 'Começar partida' }))
    await usuario.click(screen.getAllByRole('button')[0])

    await usuario.type(screen.getByLabelText('Seu palpite'), 'zzzqqqxxx')
    await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))
    await usuario.click(screen.getByRole('button', { name: 'Ninguém duvidou' }))

    await usuario.type(screen.getByLabelText('Seu palpite'), 'zzzqqqxxx')
    await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))

    expect(screen.getByRole('alert')).toHaveTextContent('já foi dito')
    expect(screen.getByText(/Vez de Bruno/)).toBeInTheDocument()
  })
})
