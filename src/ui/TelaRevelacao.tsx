import type { EstadoVisivel } from '../engine/types'
import type { Perspectiva } from './TelaRodada'

type Props = {
  estado: EstadoVisivel
  perspectiva: Perspectiva
  aoAvancar: () => void
}

export function TelaRevelacao({ estado, perspectiva, aoAvancar }: Props) {
  const rodada = estado.rodada
  if (rodada === null) return null
  const nomeDe = (id: string) => estado.jogadores.find((j) => j.id === id)?.nome ?? id
  const podeAvancar = perspectiva === 'mesa' || perspectiva.podeAgir.host

  return (
    <section className="tela">
      <h2>{rodada.categoria.titulo}</h2>
      {rodada.vencedorId && <p className="aviso">{nomeDe(rodada.vencedorId)} venceu a rodada!</p>}

      <ol className="lista-revelada">
        {(rodada.categoria.itens ?? []).map((item) => (
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

      {podeAvancar ? (
        <button type="button" className="principal" onClick={aoAvancar}>
          Continuar
        </button>
      ) : (
        <p>Aguardando o anfitrião…</p>
      )}
    </section>
  )
}
