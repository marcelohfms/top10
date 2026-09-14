import { useState } from 'react'
import type { AcaoRodada, ErroRodada, EstadoVisivel, PodeAgir } from '../engine/types'

export type Perspectiva = 'mesa' | { jogadorId: string; podeAgir: PodeAgir }

type Props = {
  estado: EstadoVisivel
  categorias: { id: string; titulo: string }[]
  erro: ErroRodada | 'acao_invalida' | null
  perspectiva: Perspectiva
  aoEscolherCategoria: (categoriaId: string) => void
  aoAgir: (acao: AcaoRodada) => void
}

const MENSAGENS: Record<ErroRodada | 'acao_invalida', string> = {
  palpite_vazio: 'Escreva alguma coisa antes de enviar.',
  palpite_duplicado: 'Esse palpite já foi dito nesta rodada. Tente outro.',
  fase_invalida: 'Ação fora de hora.',
  duvidador_invalido: 'Esse jogador não pode duvidar agora.',
  jogador_invalido: 'Não é a sua vez.',
  acao_invalida: 'Ação inválida.',
}

export function TelaRodada({ estado, categorias, erro, perspectiva, aoEscolherCategoria, aoAgir }: Props) {
  const [texto, setTexto] = useState('')
  const rodada = estado.rodada
  const nomeDe = (id: string) => estado.jogadores.find((j) => j.id === id)?.nome ?? id
  const mesa = perspectiva === 'mesa'
  const eu = mesa ? null : perspectiva

  if (rodada === null) {
    if (mesa || eu!.podeAgir.host) {
      return (
        <section className="tela">
          <h2>Escolha a categoria</h2>
          <div className="grade-categorias">
            {categorias.map((c) => (
              <button key={c.id} type="button" onClick={() => aoEscolherCategoria(c.id)}>
                {c.titulo}
              </button>
            ))}
          </div>
        </section>
      )
    }
    return (
      <section className="tela">
        <p>O anfitrião está escolhendo a categoria…</p>
      </section>
    )
  }

  const ultimo = rodada.palpites[rodada.palpites.length - 1]
  const mostraCampo = mesa ? rodada.fase === 'palpite' : eu!.podeAgir.palpite
  const autorDoCampo = mesa ? rodada.vezDe : eu!.jogadorId

  const enviarPalpite = () => {
    aoAgir({ tipo: 'palpite', texto, jogadorId: autorDoCampo })
    setTexto('')
  }

  return (
    <section className="tela">
      <h2>{rodada.categoria.titulo}</h2>

      <ul className="painel-jogadores">
        {rodada.ordem.map((id) => (
          <li key={id} className={rodada.vivos.includes(id) ? 'jogador-vivo' : 'jogador-eliminado'}>
            {nomeDe(id)}
            {eu && id === eu.jogadorId && ' (você)'}
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

      {rodada.fase === 'janela_duvida' && ultimo && (
        <p>
          {nomeDe(ultimo.autorId)} disse: <strong>{ultimo.texto}</strong>
        </p>
      )}

      {!mostraCampo && rodada.fase === 'palpite' && <p>Vez de {nomeDe(rodada.vezDe)}</p>}

      {mostraCampo && (
        <div className="linha">
          <p>{mesa ? `Vez de ${nomeDe(rodada.vezDe)}` : rodada.fase === 'palpite' ? 'Sua vez' : 'Você pode dar o próximo palpite'}</p>
          <label htmlFor="palpite">Seu palpite</label>
          <input
            id="palpite"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviarPalpite()
            }}
          />
          <button type="button" className="principal" onClick={enviarPalpite}>
            Dar palpite
          </button>
        </div>
      )}

      {rodada.fase === 'janela_duvida' && ultimo && mesa && (
        <div className="janela-duvida">
          <div className="grade-categorias">
            {rodada.vivos
              .filter((id) => id !== ultimo.autorId)
              .map((id) => (
                <button key={id} type="button" onClick={() => aoAgir({ tipo: 'duvidar', duvidadorId: id })}>
                  {nomeDe(id)} duvida
                </button>
              ))}
          </div>
          <button type="button" className="principal" onClick={() => aoAgir({ tipo: 'ninguem_duvidou' })}>
            Ninguém duvidou
          </button>
        </div>
      )}

      {rodada.fase === 'janela_duvida' && eu && eu.podeAgir.duvidar && (
        <div className="janela-duvida">
          <button type="button" className="principal" onClick={() => aoAgir({ tipo: 'duvidar', duvidadorId: eu.jogadorId })}>
            Duvido
          </button>
        </div>
      )}
    </section>
  )
}
