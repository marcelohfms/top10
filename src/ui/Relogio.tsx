import { useEffect, useState } from 'react'
import { msDecorridos, msRestantes } from '../engine/relogio'
import type { EstadoVisivel } from '../engine/types'

function formatar(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutos = Math.floor(total / 60)
  const segundos = total % 60
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
}

type Props = {
  estado: EstadoVisivel
}

export function Relogio({ estado }: Props) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const restante = msRestantes(estado.relogio, agora)
  if (restante !== null) {
    return <p className="relogio">Tempo restante: {formatar(restante)}</p>
  }

  const limite =
    estado.relogio.modo.tipo === 'categorias' ? estado.relogio.modo.quantidade : 0
  return (
    <p className="relogio">
      Rodada {Math.min(estado.concluidas.length + 1, limite)} de {limite} · {formatar(msDecorridos(estado.relogio, agora))}
    </p>
  )
}
