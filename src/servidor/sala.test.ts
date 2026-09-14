import { describe, it, expect } from 'vitest'
import { criarSala, entrarNaSala, autenticar, lerSala, aplicarAcaoNaSala } from './sala'
import { ehHostEfetivo, podeExecutar } from './autorizacao'
import type { Geradores, Sala } from './tipos'
import type { Categoria } from '../engine/types'

const T0 = 1_000_000
function cat(id: string): Categoria {
  return {
    id,
    titulo: `Cat ${id}`,
    fonte: 'teste',
    itens: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((n) => ({ nome: `${n}${id}`, apelidos: [] })),
  }
}
const catalogo = [cat('c1'), cat('c2')]

function geradores(): Geradores {
  let n = 0
  return { novoId: () => `j${++n}`, novoToken: () => `t${n}`, novoCodigo: () => 'ABCDE' }
}

function salaComDois(): { sala: Sala; host: string; outro: string } {
  const g = geradores()
  const { sala: s1, jogador: host } = criarSala('Ana', T0, g)
  const r = entrarNaSala(s1, 'Bruno', T0, g)
  if (!r.ok) throw new Error(r.erro)
  return { sala: r.valor.sala, host: host.id, outro: r.valor.jogador.id }
}

function ok<T>(r: { ok: true; valor: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.valor
}

describe('criar e entrar', () => {
  it('cria sala com host e versao 1', () => {
    const { sala, jogador } = criarSala('Ana', T0, geradores())
    expect(sala.codigo).toBe('ABCDE')
    expect(sala.hostId).toBe(jogador.id)
    expect(sala.versao).toBe(1)
    expect(sala.jogo).toBeNull()
    expect(jogador.token).toBe('t1')
  })

  it('entrar adiciona jogador e gira a versao', () => {
    const { sala } = salaComDois()
    expect(sala.jogadores.map((j) => j.apelido)).toEqual(['Ana', 'Bruno'])
    expect(sala.versao).toBe(2)
  })

  it('rejeita apelido repetido ignorando caixa e acento', () => {
    const g = geradores()
    const { sala } = criarSala('Ana', T0, g)
    const r = entrarNaSala(sala, 'ANÁ', T0, g)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('apelido_em_uso')
  })

  it('rejeita apelido vazio', () => {
    const g = geradores()
    const { sala } = criarSala('Ana', T0, g)
    const r = entrarNaSala(sala, '   ', T0, g)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('corpo_invalido')
  })
})

describe('autenticar', () => {
  it('aceita token do jogador e recusa os demais', () => {
    const { sala, host } = salaComDois()
    expect(autenticar(sala, host, 't1')).toBe(true)
    expect(autenticar(sala, host, 't2')).toBe(false)
    expect(autenticar(sala, 'inexistente', 't1')).toBe(false)
  })
})

describe('host efetivo', () => {
  it('host e host', () => {
    const { sala, host, outro } = salaComDois()
    expect(ehHostEfetivo(sala, host, T0)).toBe(true)
    expect(ehHostEfetivo(sala, outro, T0)).toBe(false)
  })

  it('qualquer um vira host se o host esta ausente ha mais de 30 s', () => {
    const { sala, outro } = salaComDois()
    expect(ehHostEfetivo(sala, outro, T0 + 29_000)).toBe(false)
    expect(ehHostEfetivo(sala, outro, T0 + 30_001)).toBe(true)
  })

  it('poll do host renova a presenca', () => {
    const { sala, host, outro } = salaComDois()
    const { sala: s2 } = lerSala(sala, host, T0 + 25_000, catalogo)
    expect(ehHostEfetivo(s2, outro, T0 + 50_000)).toBe(false)
  })
})

describe('podeExecutar', () => {
  it('acoes de host so pelo host efetivo', () => {
    const { sala, host, outro } = salaComDois()
    const acao = { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } } as const
    expect(podeExecutar(sala, host, acao, T0)).toBe(true)
    expect(podeExecutar(sala, outro, acao, T0)).toBe(false)
  })

  it('palpite e duvida so pelo proprio jogador', () => {
    const { sala, host, outro } = salaComDois()
    expect(podeExecutar(sala, host, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'x', jogadorId: host } }, T0)).toBe(true)
    expect(podeExecutar(sala, host, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'x', jogadorId: outro } }, T0)).toBe(false)
    expect(podeExecutar(sala, outro, { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: outro } }, T0)).toBe(true)
    expect(podeExecutar(sala, outro, { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: host } }, T0)).toBe(false)
  })

  it('ninguem_duvidou nao existe online', () => {
    const { sala, host } = salaComDois()
    expect(podeExecutar(sala, host, { tipo: 'rodada', acao: { tipo: 'ninguem_duvidou' } }, T0)).toBe(false)
  })
})

describe('partida', () => {
  function partidaIniciada() {
    const { sala, host, outro } = salaComDois()
    const s2 = ok(aplicarAcaoNaSala(sala, host, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 2 } }, T0, catalogo)).sala
    return { sala: s2, host, outro }
  }

  it('iniciar_partida configura o jogo com os jogadores da sala', () => {
    const { sala, host, outro } = partidaIniciada()
    expect(sala.jogo?.fase).toBe('em_rodada')
    expect(sala.jogo?.jogadores.map((j) => j.id)).toEqual([host, outro])
    expect(sala.jogo && 'catalogo' in sala.jogo).toBe(false)
  })

  it('iniciar_partida exige dois jogadores', () => {
    const g = geradores()
    const { sala, jogador } = criarSala('Ana', T0, g)
    const r = aplicarAcaoNaSala(sala, jogador.id, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } }, T0, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('acao_rejeitada')
  })

  it('a visao de quem nao e host nao tem categorias e nunca tem itens', () => {
    const { sala, host, outro } = partidaIniciada()
    const s2 = ok(aplicarAcaoNaSala(sala, host, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, T0, catalogo)).sala
    const { visao } = lerSala(s2, outro, T0, catalogo)
    expect(visao.jogo?.categoriasDisponiveis).toEqual([])
    expect(JSON.stringify(visao)).not.toContain('Ac1')
    expect(visao.jogo?.rodada?.categoria.titulo).toBe('Cat c1')
  })

  it('palpite do jogador da vez avanca o jogo e gira a versao', () => {
    const { sala, host } = partidaIniciada()
    const s2 = ok(aplicarAcaoNaSala(sala, host, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, T0, catalogo)).sala
    const r = ok(aplicarAcaoNaSala(s2, host, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Ac1', jogadorId: host } }, T0, catalogo))
    expect(r.sala.versao).toBe(s2.versao + 1)
    expect(r.visao.jogo?.rodada?.fase).toBe('janela_duvida')
  })

  it('acao nao autorizada devolve nao_autorizado', () => {
    const { sala, outro } = partidaIniciada()
    const r = aplicarAcaoNaSala(sala, outro, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, T0, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('nao_autorizado')
  })

  it('acao recusada pela engine devolve acao_rejeitada com detalhe', () => {
    const { sala, host } = partidaIniciada()
    const s2 = ok(aplicarAcaoNaSala(sala, host, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, T0, catalogo)).sala
    const r = aplicarAcaoNaSala(s2, host, { tipo: 'rodada', acao: { tipo: 'palpite', texto: '', jogadorId: host } }, T0, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erro).toBe('acao_rejeitada')
      expect(r.detalhe).toBe('palpite_vazio')
    }
  })

  it('entrar_na_partida coloca quem chegou depois na proxima rodada', () => {
    const { sala, host } = partidaIniciada()
    const g = geradores()
    g.novoId = () => 'tarde'
    const s2 = ok(entrarNaSala(sala, 'Carla', T0, g)).sala
    const s3 = ok(aplicarAcaoNaSala(s2, 'tarde', { tipo: 'entrar_na_partida' }, T0, catalogo)).sala
    expect(s3.jogo?.jogadores.map((j) => j.id)).toContain('tarde')
    expect(s3.jogo?.placar.tarde).toBe(0)
    expect(s3.jogo?.jogadores.find((j) => j.id === 'tarde')?.nome).toBe('Carla')
    void host
  })
})

describe('lerSala e o tick', () => {
  it('poll nao gira a versao quando nada muda', () => {
    const { sala, host } = salaComDois()
    const { sala: s2 } = lerSala(sala, host, T0 + 1000, catalogo)
    expect(s2.versao).toBe(sala.versao)
    expect(s2.jogadores.find((j) => j.id === host)?.ultimoPollEm).toBe(T0 + 1000)
  })

  it('no modo por tempo, o poll aplica o tick e gira a versao ao expirar', () => {
    const { sala, host } = salaComDois()
    let s = ok(aplicarAcaoNaSala(sala, host, { tipo: 'iniciar_partida', modo: { tipo: 'tempo', minutos: 1 } }, T0, catalogo)).sala
    s = ok(aplicarAcaoNaSala(s, host, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, T0, catalogo)).sala
    s = ok(aplicarAcaoNaSala(s, host, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: host } }, T0, catalogo)).sala
    const antes = s.versao
    const { sala: s2, visao } = lerSala(s, host, T0 + 60_001, catalogo)
    expect(visao.jogo?.fase).toBe('decisao_tempo')
    expect(s2.versao).toBe(antes + 1)
  })
})
