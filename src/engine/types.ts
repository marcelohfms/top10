export type ItemCategoria = {
  nome: string
  apelidos: string[]
}

export type Categoria = {
  id: string
  titulo: string
  fonte: string
  itens: ItemCategoria[]
}
