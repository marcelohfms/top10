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
    setEstado((atual) => {
      const r = aplicarAcaoJogo(atual, acao, Date.now())
      setErro(r.ok ? null : r.erro)
      return r.estado
    })
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
