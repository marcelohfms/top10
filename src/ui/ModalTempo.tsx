import type { Perspectiva } from './TelaRodada'

type Props = {
  perspectiva: Perspectiva
  aoDecidir: (decisao: 'encerrar' | 'terminar_categoria') => void
}

export function ModalTempo({ perspectiva, aoDecidir }: Props) {
  const podeDecidir = perspectiva === 'mesa' || perspectiva.podeAgir.host

  if (!podeDecidir) {
    return (
      <div className="modal" role="dialog" aria-modal="true" aria-label="Tempo esgotado">
        <h2>O tempo acabou</h2>
        <p>O anfitrião está decidindo…</p>
      </div>
    )
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Tempo esgotado">
      <h2>O tempo acabou</h2>
      <p>
        A categoria em andamento ainda não terminou. O cronômetro está pausado enquanto vocês
        decidem.
      </p>
      <button type="button" onClick={() => aoDecidir('terminar_categoria')} className="principal">
        Terminar esta categoria
      </button>
      <button type="button" onClick={() => aoDecidir('encerrar')}>
        Encerrar agora
      </button>
    </div>
  )
}
