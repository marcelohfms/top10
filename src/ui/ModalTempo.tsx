type Props = {
  aoDecidir: (decisao: 'encerrar' | 'terminar_categoria') => void
}

export function ModalTempo({ aoDecidir }: Props) {
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
