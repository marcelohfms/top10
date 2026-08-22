import { useEffect, useState } from 'react'
import { aplicarAcaoJogo, criarJogo } from '../engine/jogo'
import { carregarCategorias } from '../data/carregar'
import { carregarEstado, limparEstado, salvarEstado } from '../persistencia'
import type { AcaoJogo, AcaoRodada, ErroRodada, EstadoJogo, Jogador, ModoDuracao } from '../engine/types'
import { TelaSetup } from './TelaSetup'
import { TelaRodada } from './TelaRodada'
import { TelaRevelacao } from './TelaRevelacao'
import { TelaFimJogo } from './TelaFimJogo'
import { ModalTempo } from './ModalTempo'
import { Relogio } from './Relogio'
import './estilos.css'

const catalogo = carregarCategorias()

export function App() {
  const [estado, setEstado] = useState<EstadoJogo>(
    () => carregarEstado(catalogo) ?? criarJogo(catalogo),
  )
  const [erro, setErro] = useState<ErroRodada | 'acao_invalida' | null>(null)

  function despachar(acao: AcaoJogo) {
    // Le o relogio uma unica vez, fora de qualquer updater.
    const agora = Date.now()

    if (acao.tipo === 'tick') {
      // O tick automatico do relogio nao e uma acao do jogador: nunca deve
      // definir nem apagar o alerta de erro da ultima acao real, entao nem
      // toca em `erro`. Usa o updater funcional (em vez do `estado` do
      // closure) porque o efeito que dispara o tick so e recriado quando o
      // modo muda, entao seu `despachar` capturado pode estar preso a um
      // render antigo; o updater sempre recebe o estado mais recente.
      setEstado((atual) => aplicarAcaoJogo(atual, acao, agora).estado)
      return
    }

    // As demais acoes sempre chegam por um callback do render atual (clique
    // em botao), entao `estado` do closure ja e o mais recente: da para
    // calcular o resultado fora de qualquer updater e manter os dois
    // setState puros e independentes, sem depender de nenhum comportamento
    // interno do React para ler o resultado de volta.
    const resultado = aplicarAcaoJogo(estado, acao, agora)
    setEstado(resultado.estado)
    setErro(resultado.ok ? null : resultado.erro)
  }

  useEffect(() => {
    salvarEstado(estado)
  }, [estado])

  // O tick so importa no modo por tempo; nas demais fases ele e inofensivo.
  useEffect(() => {
    if (estado.relogio.modo.tipo !== 'tempo') return
    const id = setInterval(() => despachar({ tipo: 'tick' }), 500)
    return () => clearInterval(id)
  }, [estado.relogio.modo.tipo])

  if (estado.fase === 'setup') {
    return (
      <TelaSetup
        aoConfigurar={(jogadores: Jogador[], modo: ModoDuracao) =>
          despachar({ tipo: 'configurar', jogadores, modo })
        }
      />
    )
  }

  return (
    <main>
      {estado.fase !== 'fim_jogo' && <Relogio estado={estado} />}

      {estado.fase === 'em_rodada' && (
        <TelaRodada
          estado={estado}
          erro={erro}
          aoEscolherCategoria={(categoriaId) => despachar({ tipo: 'iniciar_rodada', categoriaId })}
          aoAgir={(acao: AcaoRodada) => despachar({ tipo: 'rodada', acao })}
        />
      )}

      {estado.fase === 'revelacao' && (
        <TelaRevelacao estado={estado} aoAvancar={() => despachar({ tipo: 'avancar' })} />
      )}

      {estado.fase === 'decisao_tempo' && (
        <ModalTempo aoDecidir={(decisao) => despachar({ tipo: 'decidir_expiracao', decisao })} />
      )}

      {estado.fase === 'fim_jogo' && (
        <TelaFimJogo
          estado={estado}
          aoReiniciar={() => {
            limparEstado()
            setEstado(criarJogo(catalogo))
            setErro(null)
          }}
        />
      )}
    </main>
  )
}
