import { useEffect } from 'react'
import { navegar } from '../rota'
import { ModalTempo } from '../ModalTempo'
import { Relogio } from '../Relogio'
import { TelaFimJogo } from '../TelaFimJogo'
import { TelaRevelacao } from '../TelaRevelacao'
import { TelaRodada, type Perspectiva } from '../TelaRodada'
import { TelaEntrada } from './TelaEntrada'
import { TelaLobby } from './TelaLobby'
import { useSala } from './useSala'
import type { ErroRodada } from '../../engine/types'

const CHAVE_APELIDO_PENDENTE = 'top10:apelido-pendente'

export function TelaSala({ codigo }: { codigo: string }) {
  const { visao, conexao, erro, entrar, agir } = useSala(codigo)

  useEffect(() => {
    if (conexao !== 'sem_credenciais') return
    const apelido = sessionStorage.getItem(CHAVE_APELIDO_PENDENTE)
    if (!apelido) return
    sessionStorage.removeItem(CHAVE_APELIDO_PENDENTE)
    void entrar(apelido)
    // Roda so ao montar sem credenciais: a chave e removida antes de chamar
    // `entrar`, entao uma segunda execucao (StrictMode) nao a encontra mais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (conexao === 'sem_credenciais' || conexao === 'token_invalido') {
    return (
      <TelaEntrada
        aoCriar={() => navegar('/online')}
        aoEntrar={(_c, apelido) => void entrar(apelido)}
        erro={conexao === 'token_invalido' ? 'Suas credenciais não valem mais para esta sala. Entre de novo.' : erro?.mensagem ?? null}
      />
    )
  }

  if (conexao === 'sala_inexistente') {
    return (
      <section className="tela">
        <p role="alert" className="aviso">Sala não encontrada ou expirada.</p>
        <button type="button" className="principal" onClick={() => navegar('/online')}>
          Voltar
        </button>
      </section>
    )
  }

  if (visao === null) {
    return (
      <section className="tela">
        <p>{conexao === 'reconectando' ? 'Reconectando…' : 'Carregando…'}</p>
      </section>
    )
  }

  const jogo = visao.jogo
  const urlSala = `${window.location.origin}/sala/${visao.codigo}`
  const estouNaPartida = jogo?.jogadores.some((j) => j.id === visao.jogadorId) ?? false

  if (jogo === null || (!estouNaPartida && jogo.fase !== 'fim_jogo')) {
    return (
      <>
        {conexao === 'reconectando' && <p className="aviso">Reconectando…</p>}
        <TelaLobby
          visao={visao}
          urlSala={urlSala}
          aoIniciar={(modo) => void agir({ tipo: 'iniciar_partida', modo })}
          aoEntrarNaPartida={() => void agir({ tipo: 'entrar_na_partida' })}
        />
      </>
    )
  }

  const perspectiva: Perspectiva = { jogadorId: visao.jogadorId, podeAgir: jogo.podeAgir }
  const erroRodada = (erro?.detalhe ?? null) as ErroRodada | 'acao_invalida' | null

  return (
    <main>
      {conexao === 'reconectando' && <p className="aviso">Reconectando…</p>}
      {jogo.fase !== 'fim_jogo' && <Relogio estado={jogo} />}

      {jogo.fase === 'em_rodada' && (
        <TelaRodada
          estado={jogo}
          categorias={jogo.categoriasDisponiveis}
          erro={erroRodada}
          perspectiva={perspectiva}
          aoEscolherCategoria={(categoriaId) => void agir({ tipo: 'iniciar_rodada', categoriaId })}
          aoAgir={(acao) => void agir({ tipo: 'rodada', acao })}
        />
      )}

      {jogo.fase === 'revelacao' && (
        <TelaRevelacao estado={jogo} perspectiva={perspectiva} aoAvancar={() => void agir({ tipo: 'avancar' })} />
      )}

      {jogo.fase === 'decisao_tempo' && (
        <ModalTempo perspectiva={perspectiva} aoDecidir={(decisao) => void agir({ tipo: 'decidir_expiracao', decisao })} />
      )}

      {jogo.fase === 'fim_jogo' && (
        <TelaFimJogo estado={jogo} perspectiva={perspectiva} rotuloReiniciar="Voltar ao início" aoReiniciar={() => navegar('/online')} />
      )}
    </main>
  )
}
