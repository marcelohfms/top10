import type { EstadoJogo } from '../engine/types'

type Props = {
  estado: EstadoJogo
  aoAvancar: () => void
}

export function TelaRevelacao({ estado, aoAvancar }: Props) {
  const rodada = estado.rodada
  if (rodada === null) return null
  const nomeDe = (id: string) => estado.jogadores.find((j) => j.id === id)?.nome ?? id

  return (
    <section className="tela">
      <h2>{rodada.categoria.titulo}</h2>
      {rodada.vencedorId && <p className="aviso">{nomeDe(rodada.vencedorId)} venceu a rodada!</p>}

      <ol className="lista-revelada">
        {rodada.categoria.itens.map((item) => (
          <li key={item.nome}>{item.nome}</li>
        ))}
      </ol>
      <p className="fonte">Fonte: {rodada.categoria.fonte}</p>

      <h3>Placar</h3>
      <ul className="placar">
        {estado.jogadores.map((j) => (
          <li key={j.id}>
            {j.nome}: {estado.placar[j.id] ?? 0}
          </li>
        ))}
      </ul>

      <button type="button" className="principal" onClick={aoAvancar}>
        Continuar
      </button>
    </section>
  )
}
