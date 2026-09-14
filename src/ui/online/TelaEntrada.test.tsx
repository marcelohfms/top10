import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelaEntrada } from './TelaEntrada'

describe('TelaEntrada', () => {
  it('cria sala com apelido', async () => {
    const aoCriar = vi.fn()
    render(<TelaEntrada aoCriar={aoCriar} aoEntrar={vi.fn()} erro={null} />)
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu apelido'), 'Ana')
    await u.click(screen.getByRole('button', { name: 'Criar sala' }))
    expect(aoCriar).toHaveBeenCalledWith('Ana')
  })

  it('entra com codigo em maiusculas', async () => {
    const aoEntrar = vi.fn()
    render(<TelaEntrada aoCriar={vi.fn()} aoEntrar={aoEntrar} erro={null} />)
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu apelido'), 'Bruno')
    await u.type(screen.getByLabelText('Código da sala'), 'kjqtm')
    await u.click(screen.getByRole('button', { name: 'Entrar na sala' }))
    expect(aoEntrar).toHaveBeenCalledWith('KJQTM', 'Bruno')
  })

  it('botoes desabilitados sem apelido; entrar desabilitado sem codigo valido', async () => {
    render(<TelaEntrada aoCriar={vi.fn()} aoEntrar={vi.fn()} erro={null} />)
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Entrar na sala' })).toBeDisabled()
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu apelido'), 'Ana')
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeEnabled()
    await u.type(screen.getByLabelText('Código da sala'), 'ABC')
    expect(screen.getByRole('button', { name: 'Entrar na sala' })).toBeDisabled()
  })

  it('mostra erro', () => {
    render(<TelaEntrada aoCriar={vi.fn()} aoEntrar={vi.fn()} erro="Sala não encontrada" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sala não encontrada')
  })
})
