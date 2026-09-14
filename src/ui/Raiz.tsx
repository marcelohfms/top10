import { useState } from 'react'
import { App } from './App'
import { TelaEntrada } from './online/TelaEntrada'
import { TelaSala } from './online/TelaSala'
import { criarSalaApi } from './online/cliente-api'
import { salvarCredenciais } from './online/credenciais'
import { navegar, useRota } from './rota'
import './estilos.css'

const CHAVE_APELIDO_PENDENTE = 'top10:apelido-pendente'

function Online() {
  const [erro, setErro] = useState<string | null>(null)
  return (
    <TelaEntrada
      erro={erro}
      aoCriar={async (apelido) => {
        const r = await criarSalaApi(apelido)
        if (!r.ok) {
          setErro(r.mensagem)
          return
        }
        salvarCredenciais(r.corpo.codigo, { jogadorId: r.corpo.jogadorId, token: r.corpo.token })
        navegar(`/sala/${r.corpo.codigo}`)
      }}
      aoEntrar={(codigo, apelido) => {
        sessionStorage.setItem(CHAVE_APELIDO_PENDENTE, apelido)
        navegar(`/sala/${codigo}`)
      }}
    />
  )
}

export function Raiz() {
  const rota = useRota()
  if (rota.nome === 'online') return <Online />
  if (rota.nome === 'sala') return <TelaSala codigo={rota.codigo} />
  return <App />
}
