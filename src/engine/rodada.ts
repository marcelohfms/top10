import { casaComItem, encontrarItem } from './match'
import { normalizar } from './normalizar'
import type {
  AcaoRodada,
  Categoria,
  EstadoRodada,
  Jogador,
  ResultadoRodada,
} from './types'

export function iniciarRodada(categoria: Categoria, jogadores: Jogador[]): EstadoRodada {
  const ordem = jogadores.map((j) => j.id)
  return {
    categoria,
    fase: 'palpite',
    ordem,
    vivos: [...ordem],
    eliminados: [],
    vezDe: ordem[0],
    palpites: [],
    ultimoEvento: null,
    vencedorId: null,
    abortada: false,
  }
}

/** Proximo jogador vivo depois da posicao de `refId` na ordem original. */
function proximoVivoApos(estado: EstadoRodada, refId: string, vivos: string[]): string {
  const inicio = estado.ordem.indexOf(refId)
  for (let passo = 1; passo <= estado.ordem.length; passo++) {
    const candidato = estado.ordem[(inicio + passo) % estado.ordem.length]
    if (vivos.includes(candidato)) return candidato
  }
  return vivos[0]
}

function jaFoiDito(estado: EstadoRodada, texto: string): boolean {
  const alvo = normalizar(texto)
  return estado.palpites.some(
    (p) =>
      normalizar(p.texto) === alvo ||
      casaComItem(texto, { nome: p.texto, apelidos: [] }),
  )
}

export function aplicarAcaoRodada(estado: EstadoRodada, acao: AcaoRodada): ResultadoRodada {
  if (estado.fase === 'fim_rodada') {
    return { ok: false, erro: 'fase_invalida', estado }
  }

  if (acao.tipo === 'palpite') {
    if (estado.fase !== 'palpite') return { ok: false, erro: 'fase_invalida', estado }
    if (normalizar(acao.texto) === '') return { ok: false, erro: 'palpite_vazio', estado }
    if (jaFoiDito(estado, acao.texto)) return { ok: false, erro: 'palpite_duplicado', estado }

    return {
      ok: true,
      estado: {
        ...estado,
        fase: 'janela_duvida',
        palpites: [
          ...estado.palpites,
          { texto: acao.texto, autorId: estado.vezDe, resultado: 'pendente' },
        ],
        ultimoEvento: null,
      },
    }
  }

  if (acao.tipo === 'ninguem_duvidou') {
    if (estado.fase !== 'janela_duvida') return { ok: false, erro: 'fase_invalida', estado }
    return {
      ok: true,
      estado: {
        ...estado,
        fase: 'palpite',
        vezDe: proximoVivoApos(estado, estado.vezDe, estado.vivos),
        ultimoEvento: null,
      },
    }
  }

  // acao.tipo === 'duvidar'
  if (estado.fase !== 'janela_duvida') return { ok: false, erro: 'fase_invalida', estado }

  const ultimo = estado.palpites[estado.palpites.length - 1]
  const { duvidadorId } = acao
  if (duvidadorId === ultimo.autorId || !estado.vivos.includes(duvidadorId)) {
    return { ok: false, erro: 'duvidador_invalido', estado }
  }

  const existe = encontrarItem(ultimo.texto, estado.categoria.itens) !== null
  const eliminadoId = existe ? duvidadorId : ultimo.autorId
  const vivos = estado.vivos.filter((id) => id !== eliminadoId)

  const palpites = estado.palpites.map((p, i) =>
    i === estado.palpites.length - 1
      ? { ...p, resultado: existe ? ('confirmado' as const) : ('refutado' as const) }
      : p,
  )

  const ultimoEvento = existe
    ? {
        tipo: 'eliminado_por_duvida_errada' as const,
        eliminadoId,
        autorId: ultimo.autorId,
        palpite: ultimo.texto,
      }
    : {
        tipo: 'eliminado_por_duvida_certa' as const,
        eliminadoId,
        duvidadorId,
        palpite: ultimo.texto,
      }

  if (vivos.length === 1) {
    return {
      ok: true,
      estado: {
        ...estado,
        fase: 'fim_rodada',
        vivos,
        eliminados: [...estado.eliminados, eliminadoId],
        palpites,
        ultimoEvento,
        vencedorId: vivos[0],
      },
    }
  }

  return {
    ok: true,
    estado: {
      ...estado,
      fase: 'palpite',
      vivos,
      eliminados: [...estado.eliminados, eliminadoId],
      vezDe: proximoVivoApos(estado, ultimo.autorId, vivos),
      palpites,
      ultimoEvento,
    },
  }
}
