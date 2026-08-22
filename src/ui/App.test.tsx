import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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

  it('mantém o alerta de erro visível apesar do tick do modo por tempo, e uma ação válida ainda o limpa', async () => {
    // So o setInterval/clearInterval do relogio e mockado: o restante (setTimeout,
    // usado pelo userEvent entre interacoes) continua real, evitando travamentos.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      const usuario = userEvent.setup()
      render(<App />)

      for (const nome of ['Ana', 'Bruno']) {
        await usuario.type(screen.getByLabelText('Nome do jogador'), nome)
        await usuario.click(screen.getByRole('button', { name: 'Adicionar jogador' }))
      }
      await usuario.click(screen.getByRole('radio', { name: 'Por tempo' }))
      await usuario.click(screen.getByRole('button', { name: 'Começar partida' }))
      await usuario.click(screen.getAllByRole('button')[0])

      // Palpite vazio: dispara o alerta de erro sem passar a vez.
      await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Escreva alguma coisa')

      // Deixa o tick do relógio (a cada 500ms, no modo por tempo) disparar
      // pelo menos uma vez. Um tick não é uma ação do jogador e não pode
      // apagar o alerta.
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(screen.getByRole('alert')).toHaveTextContent('Escreva alguma coisa')

      // Uma ação de verdade do jogador ainda precisa limpar o alerta.
      await usuario.type(screen.getByLabelText('Seu palpite'), 'resposta-valida')
      await usuario.click(screen.getByRole('button', { name: 'Dar palpite' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
