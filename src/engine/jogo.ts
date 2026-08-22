import { aplicarAcaoRodada, iniciarRodada } from './rodada'
import {
  criarRelogio,
  iniciarRelogio,
  pausarRelogio,
  retomarRelogio,
  verificarExpiracao,
} from './relogio'
import type { AcaoJogo, Categoria, EstadoJogo, ResultadoJogo } from './types'

export function criarJogo(catalogo: Categoria[]): EstadoJogo {
  return {
    fase: 'setup',
    catalogo,
    jogadores: [],
    placar: {},
    relogio: criarRelogio({ tipo: 'categorias', quantidade: 3 }),
    rodada: null,
    concluidas: [],
    encerrarAposRodada: false,
    faseAntesDaDecisao: null,
  }
}

function jaJogou(estado: EstadoJogo, categoriaId: string): boolean {
  return estado.concluidas.some((c) => c.categoria.id === categoriaId)
}

function atingiuLimiteDeCategorias(estado: EstadoJogo): boolean {
  return (
    estado.relogio.modo.tipo === 'categorias' &&
    estado.concluidas.length >= estado.relogio.modo.quantidade
  )
}

function restaCategoria(estado: EstadoJogo): boolean {
  return estado.catalogo.some((c) => !jaJogou(estado, c.id))
}

export function categoriasDisponiveis(estado: EstadoJogo): Categoria[] {
  return estado.catalogo.filter((c) => !jaJogou(estado, c.id))
}

export function aplicarAcaoJogo(
  estado: EstadoJogo,
  acao: AcaoJogo,
  agora: number,
): ResultadoJogo {
  switch (acao.tipo) {
    case 'configurar': {
      if (estado.fase !== 'setup') return { ok: false, erro: 'acao_invalida', estado }
      if (acao.jogadores.length < 2) return { ok: false, erro: 'acao_invalida', estado }
      return {
        ok: true,
        estado: {
          ...estado,
          fase: 'em_rodada',
          jogadores: acao.jogadores,
          placar: Object.fromEntries(acao.jogadores.map((j) => [j.id, 0])),
          relogio: criarRelogio(acao.modo),
        },
      }
    }

    case 'iniciar_rodada': {
      if (estado.fase !== 'em_rodada' || estado.rodada !== null) {
        return { ok: false, erro: 'acao_invalida', estado }
      }
      const categoria = estado.catalogo.find((c) => c.id === acao.categoriaId)
      if (!categoria || jaJogou(estado, categoria.id)) {
        return { ok: false, erro: 'acao_invalida', estado }
      }
      return { ok: true, estado: { ...estado, rodada: iniciarRodada(categoria, estado.jogadores) } }
    }

    case 'rodada': {
      if (estado.fase !== 'em_rodada' || estado.rodada === null) {
        return { ok: false, erro: 'acao_invalida', estado }
      }
      const r = aplicarAcaoRodada(estado.rodada, acao.acao)
      if (!r.ok) return { ok: false, erro: r.erro, estado }

      const relogio =
        acao.acao.tipo === 'palpite' ? iniciarRelogio(estado.relogio, agora) : estado.relogio

      if (r.estado.fase !== 'fim_rodada') {
        return { ok: true, estado: { ...estado, relogio, rodada: r.estado } }
      }

      const vencedorId = r.estado.vencedorId
      const placar = { ...estado.placar }
      if (vencedorId) placar[vencedorId] = (placar[vencedorId] ?? 0) + 1

      return {
        ok: true,
        estado: {
          ...estado,
          fase: 'revelacao',
          relogio,
          rodada: r.estado,
          placar,
          concluidas: [
            ...estado.concluidas,
            { categoria: r.estado.categoria, vencedorId, abortada: false },
          ],
        },
      }
    }

    case 'tick': {
      if (estado.fase === 'fim_jogo' || estado.fase === 'decisao_tempo') {
        return { ok: true, estado }
      }
      // A decisao de expiracao ja foi tomada: o relogio segue expirado, mas nao
      // deve reabrir o modal a cada tick.
      if (estado.encerrarAposRodada) return { ok: true, estado }
      const relogio = verificarExpiracao(estado.relogio, agora)
      if (!relogio.expirado) return { ok: true, estado: { ...estado, relogio } }

      // Fora de uma rodada em andamento nao ha o que decidir: encerra direto.
      if (estado.fase !== 'em_rodada' || estado.rodada === null) {
        return { ok: true, estado: { ...estado, relogio, fase: 'fim_jogo' } }
      }

      return {
        ok: true,
        estado: {
          ...estado,
          relogio: pausarRelogio(relogio, agora),
          fase: 'decisao_tempo',
          faseAntesDaDecisao: 'em_rodada',
        },
      }
    }

    case 'decidir_expiracao': {
      if (estado.fase !== 'decisao_tempo' || estado.rodada === null) {
        return { ok: false, erro: 'acao_invalida', estado }
      }

      if (acao.decisao === 'encerrar') {
        return {
          ok: true,
          estado: {
            ...estado,
            fase: 'fim_jogo',
            rodada: { ...estado.rodada, abortada: true },
            concluidas: [
              ...estado.concluidas,
              { categoria: estado.rodada.categoria, vencedorId: null, abortada: true },
            ],
          },
        }
      }

      return {
        ok: true,
        estado: {
          ...estado,
          fase: 'em_rodada',
          faseAntesDaDecisao: null,
          encerrarAposRodada: true,
          relogio: retomarRelogio(estado.relogio, agora),
        },
      }
    }

    case 'avancar': {
      if (estado.fase !== 'revelacao') return { ok: false, erro: 'acao_invalida', estado }
      const acabou =
        estado.encerrarAposRodada || atingiuLimiteDeCategorias(estado) || !restaCategoria(estado)
      return {
        ok: true,
        estado: {
          ...estado,
          fase: acabou ? 'fim_jogo' : 'em_rodada',
          rodada: acabou ? estado.rodada : null,
        },
      }
    }
  }
}
