import type { EstadoVisivel } from '../engine/types'
import type { Perspectiva } from './TelaRodada'

type Props = {
  estado: EstadoVisivel
  perspectiva: Perspectiva
  rotuloReiniciar: string
  aoReiniciar: () => void
}

export function TelaFimJogo({ estado, rotuloReiniciar, aoReiniciar }: Props) {
  const maior = Math.max(0, ...Object.values(estado.placar))
  const campeoes = estado.jogadores.filter((j) => (estado.placar[j.id] ?? 0) === maior)

  return (
    <section className="tela">
      <h1>Fim de jogo</h1>
      <p className="aviso">
        {campeoes.length > 1
          ? `Empate entre ${campeoes.map((c) => c.nome).join(', ')} com ${maior} ponto(s).`
          : `${campeoes[0]?.nome} venceu a partida com ${maior} ponto(s)!`}
      </p>

      <h2>Placar final</h2>
      <ul className="placar">
        {[...estado.jogadores]
          .sort((x, y) => (estado.placar[y.id] ?? 0) - (estado.placar[x.id] ?? 0))
          .map((j) => (
            <li key={j.id}>
              {j.nome}: {estado.placar[j.id] ?? 0}
            </li>
          ))}
      </ul>

      <h2>As listas</h2>
      {estado.concluidas.map((c) => (
        <article key={c.categoria.id}>
          <h3>
            {c.categoria.titulo}
            {c.abortada && ' — rodada interrompida pelo tempo, sem pontuação'}
          </h3>
          <ol className="lista-revelada">
            {(c.categoria.itens ?? []).map((item) => (
              <li key={item.nome}>{item.nome}</li>
            ))}
          </ol>
          <p className="fonte">Fonte: {c.categoria.fonte}</p>
        </article>
      ))}

      <button type="button" className="principal" onClick={aoReiniciar}>
        {rotuloReiniciar}
      </button>
    </section>
  )
}
