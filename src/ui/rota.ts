import { useEffect, useState } from 'react'
import { codigoValido } from '../servidor/codigo'

export type Rota = { nome: 'mesa' } | { nome: 'online' } | { nome: 'sala'; codigo: string }

export function rotaDe(pathname: string): Rota {
  const partes = pathname.split('/').filter(Boolean)
  if (partes[0] === 'online') return { nome: 'online' }
  if (partes[0] === 'sala' && partes[1]) {
    const codigo = partes[1].toUpperCase()
    if (codigoValido(codigo)) return { nome: 'sala', codigo }
  }
  return { nome: 'mesa' }
}

export function navegar(caminho: string): void {
  window.history.pushState(null, '', caminho)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => rotaDe(window.location.pathname))
  useEffect(() => {
    const ao = () => setRota(rotaDe(window.location.pathname))
    window.addEventListener('popstate', ao)
    return () => window.removeEventListener('popstate', ao)
  }, [])
  return rota
}
