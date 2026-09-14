import { useState } from 'react'
import { codigoValido } from '../../servidor/codigo'

type Props = {
  aoCriar: (apelido: string) => void
  aoEntrar: (codigo: string, apelido: string) => void
  erro: string | null
}

export function TelaEntrada({ aoCriar, aoEntrar, erro }: Props) {
  const [apelido, setApelido] = useState('')
  const [codigo, setCodigo] = useState('')
  const apelidoOk = apelido.trim() !== ''
  const codigoNorm = codigo.trim().toUpperCase()

  return (
    <section className="tela entrada-online">
      <h1>Top 10 com Blefe — online</h1>

      <div className="linha">
        <label htmlFor="apelido">Seu apelido</label>
        <input id="apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} autoComplete="nickname" />
      </div>

      {erro && <p role="alert" className="aviso">{erro}</p>}

      <h2>Criar uma sala nova</h2>
      <button type="button" className="principal" disabled={!apelidoOk} onClick={() => aoCriar(apelido.trim())}>
        Criar sala
      </button>

      <h2>Ou entrar numa sala</h2>
      <div className="linha">
        <label htmlFor="codigo">Código da sala</label>
        <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={5} autoCapitalize="characters" />
        <button
          type="button"
          disabled={!apelidoOk || !codigoValido(codigoNorm)}
          onClick={() => aoEntrar(codigoNorm, apelido.trim())}
        >
          Entrar na sala
        </button>
      </div>
    </section>
  )
}
