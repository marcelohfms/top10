import { categoriasDisponiveis } from './jogo'
import { proximoAPalpitar } from './rodada'
import type {
  Categoria,
  CategoriaVisivel,
  EstadoJogo,
  PodeAgir,
  RodadaVisivel,
  VisaoJogo,
} from './types'

function resumo(c: Categoria): CategoriaVisivel {
  return { id: c.id, titulo: c.titulo, fonte: c.fonte }
}

function rodadaVisivel(estado: EstadoJogo): RodadaVisivel | null {
  if (estado.rodada === null) return null
  const revelada = estado.fase === 'revelacao' || estado.fase === 'fim_jogo'
  const { categoria, ...resto } = estado.rodada
  if (revelada) return { ...resto, categoria }
  // Enquanto a rodada nao e revelada, o texto de um palpite pode coincidir
  // com um item real da lista secreta (o jogador pode ter acertado, ou
  // blefado com o nome certo). Mostrar esse texto vazaria o item antes da
  // hora, entao so a autoria e o resultado ficam visiveis, nunca a palavra.
  return {
    ...resto,
    categoria: resumo(categoria),
    palpites: resto.palpites.map((p) => ({ ...p, texto: '' })),
    ultimoEvento: resto.ultimoEvento && { ...resto.ultimoEvento, palpite: '' },
  }
}

function podeAgir(estado: EstadoJogo, jogadorId: string, ehHost: boolean): PodeAgir {
  const rodada = estado.rodada
  const emCurso = estado.fase === 'em_rodada' && rodada !== null
  if (!emCurso || !estado.jogadores.some((j) => j.id === jogadorId)) {
    return { palpite: false, duvidar: false, host: ehHost }
  }
  const ultimo = rodada.palpites[rodada.palpites.length - 1]
  const duvidar =
    rodada.fase === 'janela_duvida' &&
    rodada.vivos.includes(jogadorId) &&
    ultimo !== undefined &&
    ultimo.autorId !== jogadorId
  return { palpite: proximoAPalpitar(rodada) === jogadorId, duvidar, host: ehHost }
}

/**
 * Projecao do estado que pode sair do servidor. Remove o catalogo e, enquanto
 * a rodada esta em curso, os itens da categoria. E a unica coisa que o
 * cliente online ve; se um item vazar por aqui, o jogo esta quebrado.
 */
export function visaoPublica(estado: EstadoJogo, jogadorId: string, ehHost: boolean): VisaoJogo {
  return {
    jogadorId,
    fase: estado.fase,
    jogadores: estado.jogadores,
    placar: estado.placar,
    relogio: estado.relogio,
    rodada: rodadaVisivel(estado),
    concluidas: estado.concluidas,
    encerrarAposRodada: estado.encerrarAposRodada,
    categoriasDisponiveis: ehHost
      ? categoriasDisponiveis(estado).map((c) => ({ id: c.id, titulo: c.titulo }))
      : [],
    podeAgir: podeAgir(estado, jogadorId, ehHost),
  }
}
