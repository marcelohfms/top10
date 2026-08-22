import { useState } from 'react'
import { categoriasDisponiveis } from '../engine/jogo'
import type { AcaoRodada, ErroRodada, EstadoJogo } from '../engine/types'

type Props = {
  estado: EstadoJogo
  erro: ErroRodada | 'acao_invalida' | null
  aoEscolherCategoria: (categoriaId: string) => void
  aoAgir: (acao: AcaoRodada) => void
}

const MENSAGENS: Record<string, string> = {
  palpite_vazio: 'Escreva alguma coisa antes de enviar.',
  palpite_duplicado: 'Esse palpite já foi dito nesta rodada. Tente outro.',
  fase_invalida: 'Ação fora de hora.',
  duvidador_invalido: 'Esse jogador não pode duvidar agora.',
  acao_invalida: 'Ação inválida.',
}

export function TelaRodada({ estado, erro, aoEscolherCategoria, aoAgir }: Props) {
  const [texto, setTexto] = useState('')
  const rodada = estado.rodada
  const nomeDe = (id: string) => estado.jogadores.find((j) => j.id === id)?.nome ?? id

  if (rodada === null) {
    return (
      <section className="tela">
        <h2>Escolha a categoria</h2>
        <div className="grade-categorias">
          {categoriasDisponiveis(estado).map((c) => (
            <button key={c.id} type="button" onClick={() => aoEscolherCategoria(c.id)}>
              {c.titulo}
            </button>
          ))}
        </div>
      </section>
    )
  }

  const ultimo = rodada.palpites[rodada.palpites.length - 1]

  return (
    <section className="tela">
      <h2>{rodada.categoria.titulo}</h2>

      <ul className="painel-jogadores">
        {rodada.ordem.map((id) => (
          <li key={id} className={rodada.vivos.includes(id) ? 'jogador-vivo' : 'jogador-eliminado'}>
            {nomeDe(id)}
          </li>
        ))}
      </ul>

      {rodada.ultimoEvento && (
        <p className="aviso">
          {rodada.ultimoEvento.tipo === 'eliminado_por_duvida_certa'
            ? `${nomeDe(rodada.ultimoEvento.duvidadorId)} acertou: "${rodada.ultimoEvento.palpite}" não está na lista. ${nomeDe(rodada.ultimoEvento.eliminadoId)} está fora.`
            : `"${rodada.ultimoEvento.palpite}" está na lista! ${nomeDe(rodada.ultimoEvento.eliminadoId)} duvidou errado e está fora.`}
        </p>
      )}

      {erro && <p role="alert" className="aviso">{MENSAGENS[erro]}</p>}

      {rodada.fase === 'palpite' && (
        <div className="linha">
          <p>Vez de {nomeDe(rodada.vezDe)}</p>
          <label htmlFor="palpite">Seu palpite</label>
          <input
            id="palpite"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && texto.trim() !== '') {
                aoAgir({ tipo: 'palpite', texto })
                setTexto('')
              }
            }}
          />
          <button
            type="button"
            className="principal"
            onClick={() => {
              aoAgir({ tipo: 'palpite', texto })
              setTexto('')
            }}
          >
            Dar palpite
          </button>
        </div>
      )}

      {rodada.fase === 'janela_duvida' && ultimo && (
        <div className="janela-duvida">
          <p>
            {nomeDe(ultimo.autorId)} disse: <strong>{ultimo.texto}</strong>
          </p>
          <div className="grade-categorias">
            {rodada.vivos
              .filter((id) => id !== ultimo.autorId)
              .map((id) => (
                <button key={id} type="button" onClick={() => aoAgir({ tipo: 'duvidar', duvidadorId: id })}>
                  {nomeDe(id)} duvida
                </button>
              ))}
          </div>
          <button
            type="button"
            className="principal"
            onClick={() => aoAgir({ tipo: 'ninguem_duvidou' })}
          >
            Ninguém duvidou
          </button>
        </div>
      )}
    </section>
  )
}
