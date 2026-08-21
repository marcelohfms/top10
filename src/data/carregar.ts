import bruto from './categorias.json'
import type { Categoria } from '../engine/types'

export function carregarCategorias(): Categoria[] {
  return bruto as Categoria[]
}
