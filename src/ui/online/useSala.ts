import { useCallback, useEffect, useRef, useState } from 'react'
import type { AcaoSala, VisaoSala } from '../../servidor/tipos'
import { agirApi, entrarApi, lerApi } from './cliente-api'
import { lerCredenciais, limparCredenciais, salvarCredenciais, type Credenciais } from './credenciais'

export type EstadoConexao =
  | 'carregando'
  | 'ok'
  | 'reconectando'
  | 'sem_credenciais'
  | 'sala_inexistente'
  | 'token_invalido'

const INTERVALO_MS = 1000
const INTERVALO_MAXIMO_MS = 5000

export function useSala(codigo: string) {
  const [cred, setCred] = useState<Credenciais | null>(() => lerCredenciais(codigo))
  const [visao, setVisao] = useState<VisaoSala | null>(null)
  const [versao, setVersao] = useState<number | null>(null)
  const [conexao, setConexao] = useState<EstadoConexao>(cred ? 'carregando' : 'sem_credenciais')
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)

  const versaoRef = useRef<number | null>(null)
  versaoRef.current = versao

  const adotar = useCallback((v: number, vis: VisaoSala) => {
    setVersao(v)
    setVisao(vis)
  }, [])

  // Polling: um setTimeout encadeado (nao setInterval) para o intervalo poder
  // crescer no backoff e para nunca haver duas leituras em voo.
  useEffect(() => {
    if (!cred) return
    let ativo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let intervalo = INTERVALO_MS

    const agendar = (ms: number) => {
      if (!ativo) return
      timer = setTimeout(ler, ms)
    }

    const ler = async () => {
      timer = null
      if (!ativo) return
      if (typeof document !== 'undefined' && document.hidden) return
      const r = await lerApi(codigo, cred, versaoRef.current)
      if (!ativo) return
      if (r.ok) {
        intervalo = INTERVALO_MS
        setConexao('ok')
        if (r.corpo !== null) adotar(r.corpo.versao, r.corpo.visao)
        agendar(intervalo)
        return
      }
      if (r.erro === 'sala_inexistente') {
        setConexao('sala_inexistente')
        return
      }
      if (r.erro === 'token_invalido') {
        limparCredenciais(codigo)
        setCred(null)
        setConexao('token_invalido')
        return
      }
      setConexao('reconectando')
      intervalo = Math.min(intervalo * 2, INTERVALO_MAXIMO_MS)
      agendar(intervalo)
    }

    const aoMudarVisibilidade = () => {
      if (!document.hidden && timer === null) void ler()
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    void ler()

    return () => {
      ativo = false
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [codigo, cred, adotar])

  const entrar = useCallback(
    async (apelido: string) => {
      const r = await entrarApi(codigo, apelido)
      if (!r.ok) {
        setErro({ mensagem: r.mensagem, detalhe: 'erro' in r ? r.erro : undefined })
        return
      }
      const c = { jogadorId: r.corpo.jogadorId, token: r.corpo.token }
      salvarCredenciais(codigo, c)
      adotar(r.corpo.versao, r.corpo.visao)
      setErro(null)
      setCred(c)
      setConexao('ok')
    },
    [codigo, adotar],
  )

  const agir = useCallback(
    async (acao: AcaoSala) => {
      if (!cred || versaoRef.current === null) return
      const r = await agirApi(codigo, cred, versaoRef.current, acao)
      if (r.ok) {
        adotar(r.corpo.versao, r.corpo.visao)
        setErro(null)
        return
      }
      if (r.status === 409 && r.versao !== undefined && r.visao) {
        adotar(r.versao, r.visao)
        setErro(null)
        return
      }
      if (r.erro === 'token_invalido') {
        limparCredenciais(codigo)
        setCred(null)
        setConexao('token_invalido')
        return
      }
      setErro({ mensagem: r.mensagem, detalhe: 'detalhe' in r ? r.detalhe : undefined })
    },
    [codigo, cred, adotar],
  )

  return { visao, versao, conexao, erro, entrar, agir }
}
