import { describe, it, expect } from 'vitest'
import { iniciarRodada, aplicarAcaoRodada, proximoAPalpitar } from './rodada'
import type { Categoria, EstadoRodada, AcaoRodada, Jogador } from './types'

const categoria: Categoria = {
  id: 'teste',
  titulo: 'Categoria de teste',
  fonte: 'teste',
  itens: [
    { nome: 'Nitrogênio', apelidos: ['n2'] },
    { nome: 'Oxigênio', apelidos: ['o2'] },
    { nome: 'Argônio', apelidos: [] },
    { nome: 'Dióxido de carbono', apelidos: ['co2'] },
    { nome: 'Neônio', apelidos: [] },
    { nome: 'Hélio', apelidos: [] },
    { nome: 'Metano', apelidos: [] },
    { nome: 'Criptônio', apelidos: [] },
    { nome: 'Hidrogênio', apelidos: [] },
    { nome: 'Ozônio', apelidos: [] },
  ],
}

const jogadores: Jogador[] = [
  { id: 'a', nome: 'Ana' },
  { id: 'b', nome: 'Bruno' },
  { id: 'c', nome: 'Carla' },
]

function aplicar(estado: EstadoRodada, ...acoes: AcaoRodada[]): EstadoRodada {
  return acoes.reduce((atual, acao) => {
    const r = aplicarAcaoRodada(atual, acao)
    if (!r.ok) throw new Error(`acao rejeitada: ${r.erro}`)
    return r.estado
  }, estado)
}

describe('iniciarRodada', () => {
  it('comeca na fase de palpite com todos vivos', () => {
    const e = iniciarRodada(categoria, jogadores)
    expect(e.fase).toBe('palpite')
    expect(e.vivos).toEqual(['a', 'b', 'c'])
    expect(e.eliminados).toEqual([])
    expect(e.vezDe).toBe('a')
    expect(e.vencedorId).toBeNull()
  })
})

describe('palpite', () => {
  it('leva para a janela de duvida sem revelar o resultado', () => {
    const e = aplicar(iniciarRodada(categoria, jogadores), {
      tipo: 'palpite',
      texto: 'Nitrogenio',
      jogadorId: 'a',
    })
    expect(e.fase).toBe('janela_duvida')
    expect(e.palpites).toHaveLength(1)
    expect(e.palpites[0]).toEqual({ texto: 'Nitrogenio', autorId: 'a', resultado: 'pendente' })
  })

  it('rejeita palpite vazio sem consumir a vez', () => {
    const inicial = iniciarRodada(categoria, jogadores)
    const r = aplicarAcaoRodada(inicial, { tipo: 'palpite', texto: '   ', jogadorId: 'a' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('palpite_vazio')
    expect(r.estado).toEqual(inicial)
  })

  it('rejeita duplicata usando o matching de grafia, sem consumir a vez', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Nitrogênio', jogadorId: 'a' },
      { tipo: 'ninguem_duvidou' },
    )
    const r = aplicarAcaoRodada(e, { tipo: 'palpite', texto: 'nitorgenio', jogadorId: 'b' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('palpite_duplicado')
    expect(r.estado.vezDe).toBe('b')
    expect(r.estado.palpites).toHaveLength(1)
  })
})

describe('ninguem duvidou', () => {
  it('passa a vez e mantem o palpite pendente', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'ninguem_duvidou' },
    )
    expect(e.fase).toBe('palpite')
    expect(e.vezDe).toBe('b')
    expect(e.palpites[0].resultado).toBe('pendente')
    expect(e.vivos).toEqual(['a', 'b', 'c'])
  })

  it('da a volta na ordem', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Metano', jogadorId: 'a' },
      { tipo: 'ninguem_duvidou' },
      { tipo: 'palpite', texto: 'Helio', jogadorId: 'b' },
      { tipo: 'ninguem_duvidou' },
      { tipo: 'palpite', texto: 'Ozonio', jogadorId: 'c' },
      { tipo: 'ninguem_duvidou' },
    )
    expect(e.vezDe).toBe('a')
  })
})

describe('duvidar', () => {
  it('elimina o duvidador quando o palpite esta na lista', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Nitrogenio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'b' },
    )
    expect(e.eliminados).toEqual(['b'])
    expect(e.vivos).toEqual(['a', 'c'])
    // A vez passa para o proximo vivo depois do AUTOR ('a'), nao depois do
    // duvidador eliminado: 'a' acabou de jogar, entao o jogo segue adiante
    // dele. Vale nos dois desfechos da duvida.
    expect(e.vezDe).toBe('c')
    expect(e.palpites[0].resultado).toBe('confirmado')
    expect(e.ultimoEvento).toEqual({
      tipo: 'eliminado_por_duvida_errada',
      eliminadoId: 'b',
      autorId: 'a',
      palpite: 'Nitrogenio',
    })
  })

  it('elimina o autor quando o palpite nao esta na lista', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'b' },
    )
    expect(e.eliminados).toEqual(['a'])
    expect(e.vivos).toEqual(['b', 'c'])
    expect(e.palpites[0].resultado).toBe('refutado')
    expect(e.ultimoEvento).toEqual({
      tipo: 'eliminado_por_duvida_certa',
      eliminadoId: 'a',
      duvidadorId: 'b',
      palpite: 'Plutonio',
    })
  })

  it('passa a vez para o proximo vivo depois da posicao do autor', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'c' },
    )
    expect(e.eliminados).toEqual(['a'])
    expect(e.vezDe).toBe('b')
  })

  it('rejeita o autor duvidando do proprio palpite', () => {
    const e = aplicar(iniciarRodada(categoria, jogadores), {
      tipo: 'palpite',
      texto: 'Metano',
      jogadorId: 'a',
    })
    const r = aplicarAcaoRodada(e, { tipo: 'duvidar', duvidadorId: 'a' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('duvidador_invalido')
  })

  it('rejeita duvida de jogador ja eliminado', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'b' },
    )
    const e2 = aplicar(e, { tipo: 'palpite', texto: 'Radonio', jogadorId: e.vezDe })
    const r = aplicarAcaoRodada(e2, { tipo: 'duvidar', duvidadorId: 'a' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('duvidador_invalido')
  })

  it('encerra a rodada quando resta um vivo', () => {
    let e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'b' },
    )
    e = aplicar(
      e,
      { tipo: 'palpite', texto: 'Radonio', jogadorId: e.vezDe },
      { tipo: 'duvidar', duvidadorId: 'c' },
    )
    expect(e.fase).toBe('fim_rodada')
    expect(e.vencedorId).toBe('c')
  })
})

describe('lista esgotada', () => {
  it('trata palpite novo como falso depois de os 10 itens sairem', () => {
    let e = iniciarRodada(categoria, jogadores)
    for (const item of categoria.itens) {
      e = aplicar(
        e,
        { tipo: 'palpite', texto: item.nome, jogadorId: e.vezDe },
        { tipo: 'ninguem_duvidou' },
      )
    }
    // Depois de 10 ciclos com 3 jogadores a vez volta para 'b', entao quem
    // duvida tem de ser outro: 'b' duvidando seria duvida do proprio palpite.
    expect(e.vezDe).toBe('b')
    e = aplicar(
      e,
      { tipo: 'palpite', texto: 'Xenonio', jogadorId: e.vezDe },
      { tipo: 'duvidar', duvidadorId: 'a' },
    )
    expect(e.palpites.at(-1)!.resultado).toBe('refutado')
    expect(e.eliminados).toEqual(['b'])
  })
})

describe('jogadorId no palpite', () => {
  it('rejeita palpite de quem nao e a vez', () => {
    const r = aplicarAcaoRodada(iniciarRodada(categoria, jogadores), {
      tipo: 'palpite',
      texto: 'Metano',
      jogadorId: 'b',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('jogador_invalido')
  })

  it('na janela de duvida, o proximo vivo pode palpitar e isso fecha a janela', () => {
    const e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Metano', jogadorId: 'a' },
      { tipo: 'palpite', texto: 'Helio', jogadorId: 'b' },
    )
    expect(e.fase).toBe('janela_duvida')
    expect(e.palpites.map((p) => p.autorId)).toEqual(['a', 'b'])
    expect(e.palpites[0].resultado).toBe('pendente')
    expect(e.vezDe).toBe('b')
  })

  it('na janela de duvida, quem nao e o proximo nao pode palpitar', () => {
    const e = aplicar(iniciarRodada(categoria, jogadores), {
      tipo: 'palpite',
      texto: 'Metano',
      jogadorId: 'a',
    })
    for (const id of ['a', 'c']) {
      const r = aplicarAcaoRodada(e, { tipo: 'palpite', texto: 'Helio', jogadorId: id })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.erro).toBe('jogador_invalido')
    }
  })

  it('palpite implicito pula eliminados ao escolher o proximo', () => {
    let e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'b' },
    )
    // 'a' eliminado; vez de 'b'. 'b' palpita; na janela, o proximo e 'c'.
    e = aplicar(e, { tipo: 'palpite', texto: 'Metano', jogadorId: 'b' })
    expect(proximoAPalpitar(e)).toBe('c')
    e = aplicar(e, { tipo: 'palpite', texto: 'Helio', jogadorId: 'c' })
    expect(e.vezDe).toBe('c')
  })
})

describe('proximoAPalpitar', () => {
  it('e a vez em fase de palpite', () => {
    expect(proximoAPalpitar(iniciarRodada(categoria, jogadores))).toBe('a')
  })

  it('e o proximo vivo apos o autor em janela de duvida', () => {
    const e = aplicar(iniciarRodada(categoria, jogadores), {
      tipo: 'palpite',
      texto: 'Metano',
      jogadorId: 'a',
    })
    expect(proximoAPalpitar(e)).toBe('b')
  })

  it('e null quando a rodada acabou', () => {
    let e = aplicar(
      iniciarRodada(categoria, jogadores),
      { tipo: 'palpite', texto: 'Plutonio', jogadorId: 'a' },
      { tipo: 'duvidar', duvidadorId: 'b' },
    )
    e = aplicar(e, { tipo: 'palpite', texto: 'Radonio', jogadorId: 'b' }, { tipo: 'duvidar', duvidadorId: 'c' })
    expect(proximoAPalpitar(e)).toBeNull()
  })
})
