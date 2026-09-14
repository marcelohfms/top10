import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalTempo } from './ModalTempo'

describe('ModalTempo', () => {
  it('oferece as duas decisoes', async () => {
    const aoDecidir = vi.fn()
    render(<ModalTempo perspectiva="mesa" aoDecidir={aoDecidir} />)
    const usuario = userEvent.setup()

    expect(screen.getByRole('dialog')).toHaveTextContent('acabou')

    await usuario.click(screen.getByRole('button', { name: 'Encerrar agora' }))
    expect(aoDecidir).toHaveBeenCalledWith('encerrar')

    await usuario.click(screen.getByRole('button', { name: 'Terminar esta categoria' }))
    expect(aoDecidir).toHaveBeenCalledWith('terminar_categoria')
  })
})
