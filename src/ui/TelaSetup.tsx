import { useState } from 'react'
import type { Jogador, ModoDuracao } from '../engine/types'

// `crypto.randomUUID` so existe em contexto seguro. Um `vite preview --host`
// aberto em http://192.168.x.x:4173 (celular na mesa, notebook espelhado na
// TV) nao e seguro, e ali a chamada quebraria o botao de adicionar jogador.
// Os ids so precisam ser unicos dentro de uma partida, entao um contador
// local basta.
let contadorDeJogadores = 0

function novoIdDeJogador(): string {
  contadorDeJogadores += 1
  return `jogador-${contadorDeJogadores}`
}

type Props = {
  aoConfigurar: (jogadores: Jogador[], modo: ModoDuracao) => void
  aoJogarOnline?: () => void
}

export function TelaSetup({ aoConfigurar, aoJogarOnline }: Props) {
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [nome, setNome] = useState('')
  const [tipoModo, setTipoModo] = useState<'categorias' | 'tempo'>('categorias')
  const [quantidade, setQuantidade] = useState(3)
  const [minutos, setMinutos] = useState(30)

  function adicionar() {
    const limpo = nome.trim()
    if (limpo === '') return
    setJogadores([...jogadores, { id: novoIdDeJogador(), nome: limpo }])
    setNome('')
  }

  function comecar() {
    const modo: ModoDuracao =
      tipoModo === 'categorias' ? { tipo: 'categorias', quantidade } : { tipo: 'tempo', minutos }
    aoConfigurar(jogadores, modo)
  }

  const duracaoValida =
    tipoModo === 'categorias'
      ? Number.isInteger(quantidade) && quantidade >= 1
      : Number.isInteger(minutos) && minutos >= 1

  return (
    <section className="tela tela-setup">
      <h1>Top 10 com Blefe</h1>

      {aoJogarOnline && (
        <button type="button" onClick={aoJogarOnline}>
          Jogar online
        </button>
      )}

      <h2>Jogadores</h2>
      <div className="linha">
        <label htmlFor="nome-jogador">Nome do jogador</label>
        <input
          id="nome-jogador"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') adicionar()
          }}
        />
        <button type="button" onClick={adicionar}>
          Adicionar jogador
        </button>
      </div>

      <ul className="lista-jogadores">
        {jogadores.map((j) => (
          <li key={j.id}>
            <span>{j.nome}</span>
            <button
              type="button"
              aria-label={`Remover ${j.nome}`}
              onClick={() => setJogadores(jogadores.filter((o) => o.id !== j.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <h2>Duração da partida</h2>
      <fieldset>
        <label>
          <input
            type="radio"
            name="modo"
            checked={tipoModo === 'categorias'}
            onChange={() => setTipoModo('categorias')}
          />
          Por categorias
        </label>
        <label>
          <input
            type="radio"
            name="modo"
            checked={tipoModo === 'tempo'}
            onChange={() => setTipoModo('tempo')}
          />
          Por tempo
        </label>
      </fieldset>

      {tipoModo === 'categorias' ? (
        <div className="linha">
          <label htmlFor="quantidade">Quantidade de categorias</label>
          <input
            id="quantidade"
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
          />
        </div>
      ) : (
        <div className="linha">
          <label htmlFor="minutos">Minutos de partida</label>
          <input
            id="minutos"
            type="number"
            min={1}
            value={minutos}
            onChange={(e) => setMinutos(Number(e.target.value))}
          />
        </div>
      )}

      <button
        type="button"
        className="principal"
        disabled={jogadores.length < 2 || !duracaoValida}
        onClick={comecar}
      >
        Começar partida
      </button>
    </section>
  )
}
