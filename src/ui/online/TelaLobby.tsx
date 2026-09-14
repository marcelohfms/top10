import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { ModoDuracao } from '../../engine/types'
import type { VisaoSala } from '../../servidor/tipos'

type Props = {
  visao: VisaoSala
  urlSala: string
  aoIniciar: (modo: ModoDuracao) => void
  aoEntrarNaPartida: () => void
}

export function TelaLobby({ visao, urlSala, aoIniciar, aoEntrarNaPartida }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tipoModo, setTipoModo] = useState<'categorias' | 'tempo'>('categorias')
  const [quantidade, setQuantidade] = useState(3)
  const [minutos, setMinutos] = useState(30)

  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, urlSala, { width: 220 })
  }, [urlSala])

  const partidaRolando = visao.jogo !== null && visao.jogo.fase !== 'fim_jogo'
  const estouNaPartida = visao.jogo?.jogadores.some((j) => j.id === visao.jogadorId) ?? false

  const duracaoValida =
    tipoModo === 'categorias' ? Number.isInteger(quantidade) && quantidade >= 1 : Number.isInteger(minutos) && minutos >= 1
  const podeIniciar = visao.jogadores.length >= 2 && duracaoValida

  return (
    <section className="tela">
      <h1>Sala</h1>
      <p className="codigo-sala">{visao.codigo}</p>
      <canvas ref={canvas} className="qr" aria-label="QR code do link da sala" />
      <p className="fonte">{urlSala}</p>

      <h2>Quem está na sala</h2>
      <ul className="lista-jogadores">
        {visao.jogadores.map((j) => (
          <li key={j.id}>
            <span>{j.apelido}</span>
            {j.id === visao.hostId && <span className="fonte"> (anfitrião)</span>}
          </li>
        ))}
      </ul>

      {partidaRolando && !estouNaPartida && (
        <>
          <p className="aviso">A partida já começou. Você entra na próxima rodada.</p>
          <button type="button" className="principal" onClick={aoEntrarNaPartida}>
            Entrar na próxima rodada
          </button>
        </>
      )}

      {!partidaRolando && visao.ehHost && (
        <>
          <h2>Duração da partida</h2>
          <fieldset>
            <label>
              <input type="radio" name="modo" checked={tipoModo === 'categorias'} onChange={() => setTipoModo('categorias')} />
              Por categorias
            </label>
            <label>
              <input type="radio" name="modo" checked={tipoModo === 'tempo'} onChange={() => setTipoModo('tempo')} />
              Por tempo
            </label>
          </fieldset>
          {tipoModo === 'categorias' ? (
            <div className="linha">
              <label htmlFor="quantidade">Quantidade de categorias</label>
              <input id="quantidade" type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
            </div>
          ) : (
            <div className="linha">
              <label htmlFor="minutos">Minutos de partida</label>
              <input id="minutos" type="number" min={1} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
            </div>
          )}
          <button
            type="button"
            className="principal"
            disabled={!podeIniciar}
            onClick={() => aoIniciar(tipoModo === 'categorias' ? { tipo: 'categorias', quantidade } : { tipo: 'tempo', minutos })}
          >
            Começar partida
          </button>
        </>
      )}

      {!partidaRolando && !visao.ehHost && <p>Aguardando o anfitrião começar a partida…</p>}
    </section>
  )
}
