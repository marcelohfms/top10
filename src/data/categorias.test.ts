import { describe, it, expect } from 'vitest'
import { carregarCategorias } from './carregar'
import { casaComItem } from '../engine/match'

const categorias = carregarCategorias()

describe('catalogo de categorias', () => {
  it('tem pelo menos 30 categorias', () => {
    expect(categorias.length).toBeGreaterThanOrEqual(30)
  })

  it('tem ids unicos', () => {
    const ids = categorias.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(categorias.map((c) => [c.id, c] as const))(
    '%s tem exatamente 10 itens, titulo e fonte',
    (_id, categoria) => {
      expect(categoria.itens).toHaveLength(10)
      expect(categoria.titulo.length).toBeGreaterThan(0)
      expect(categoria.fonte.length).toBeGreaterThan(0)
    },
  )

  it.each(categorias.map((c) => [c.id, c] as const))(
    '%s nao tem itens que colidem pelo matching',
    (_id, categoria) => {
      const colisoes: string[] = []
      for (let i = 0; i < categoria.itens.length; i++) {
        for (let j = i + 1; j < categoria.itens.length; j++) {
          if (casaComItem(categoria.itens[i].nome, categoria.itens[j])) {
            colisoes.push(`${categoria.itens[i].nome} ~ ${categoria.itens[j].nome}`)
          }
        }
      }
      expect(colisoes).toEqual([])
    },
  )
})
