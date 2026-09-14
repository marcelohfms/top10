# Multiplayer Online — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada jogador entre numa partida de "Top 10 com Blefe" pelo próprio aparelho, via código de sala, com o próprio campo de palpite e o próprio botão "Duvido", com o servidor rodando a engine existente e a lista secreta nunca saindo dele.

**Architecture:** O front Vite + React ganha um roteador HTTP puro em `src/servidor/` e um `servidor.ts` de processo único que serve o `dist/` e monta `/api` — hospedado numa VPS com `pm2` e Caddy. O estado de cada sala vive num store com compare-and-set: memória com snapshot em arquivo em produção, memória pura em dev/testes. A engine em `src/engine/` recebe três acréscimos pequenos e puros: `jogadorId` no palpite, `adicionar_jogador`, e `visaoPublica` — a projeção sem itens que vai para o cliente. O cliente faz polling de 1 s e as telas existentes ganham uma `perspectiva` por jogador.

**Tech Stack:** Vite 7, React 19, TypeScript, Vitest 3, `qrcode`, `tsx`, Node `http` (handlers com assinatura Web `Request → Response`), `pm2` + Caddy na VPS.

**Spec:** `docs/superpowers/specs/2026-09-14-multiplayer-online-design.md` — leia antes de qualquer task. O spec anterior, `docs/superpowers/specs/2026-08-21-top10-blefe-design.md`, descreve o jogo já implementado.

## Global Constraints

- Todo o texto visível ao usuário em português do Brasil, com acentuação correta. Identificadores TypeScript sem acentos; nomes de arquivos em kebab-case ASCII.
- `src/engine/` continua sem `react`, `react-dom`, `src/ui/`, `window`, `document`, `localStorage` e `Date.now()`. O instante atual é sempre `agora: number`.
- `src/servidor/` é puro: sem I/O, sem `Date.now()`, sem `crypto` direto. Recebe `agora` e um gerador de ids injetado. Só `servidor.ts`, `src/servidor/store-arquivo.ts`, `src/servidor/node-web.ts` e `src/servidor/vite-plugin-api.ts` tocam o mundo externo (`dependenciasPadrao` em `http.ts` é a única outra exceção: injeta `Date.now` e `crypto`).
- **A lista de itens da categoria em curso nunca sai do servidor.** Nenhuma resposta HTTP durante `em_rodada` ou `decisao_tempo` contém `itens`. Há um teste de serialização que garante isso; ele nunca pode ser enfraquecido.
- O cliente online nunca importa `src/data/`.
- TDD obrigatório: o teste falhando vem antes da implementação.
- Commits em português, Conventional Commits, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Branch: `feat/multiplayer-online` (já criada, ramificada de `feat/jogo-top10-blefe`).
- O jogo de um dispositivo (`/`) tem de continuar funcionando e com a suíte verde em toda task.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/engine/types.ts` | + `EstadoVisivel`, `CategoriaVisivel`, `RodadaVisivel`, `PodeAgir`, `VisaoJogo`; `palpite.jogadorId`; `adicionar_jogador`; `ErroRodada` + `'jogador_invalido'` |
| `src/engine/rodada.ts` | valida `jogadorId`; "ninguém duvidou" implícito; exporta `proximoVivoApos` |
| `src/engine/jogo.ts` | `adicionar_jogador` |
| `src/engine/visao.ts` | `visaoPublica(estado, jogadorId, ehHost)` |
| `src/servidor/tipos.ts` | `Sala`, `JogadorSala`, `AcaoSala`, `VisaoSala`, `ErroServidor`, `Geradores` |
| `src/servidor/codigo.ts` | código de sala de 5 letras |
| `src/servidor/store.ts` | interface `StoreSala` + `storeMemoria()` |
| `src/servidor/store-arquivo.ts` | memória + snapshot em disco após cada gravação |
| `src/servidor/node-web.ts` | adaptador `IncomingMessage`/`ServerResponse` ↔ `Request`/`Response` |
| `src/servidor/autorizacao.ts` | `ehHostEfetivo`, `podeExecutar` |
| `src/servidor/sala.ts` | `criarSala`, `entrarNaSala`, `lerSala`, `aplicarAcaoNaSala` (puras) |
| `src/servidor/http.ts` | `roteador(request, deps)`: parse, auth, store, resposta JSON |
| `src/servidor/vite-plugin-api.ts` | monta `/api` no dev server do Vite com `storeMemoria` |
| `servidor.ts` | processo de produção: estático com fallback SPA + `/api` |
| `src/ui/online/credenciais.ts` | `localStorage` de `{ jogadorId, token }` por sala |
| `src/ui/online/cliente-api.ts` | `fetch` tipado das 4 rotas |
| `src/ui/online/useSala.ts` | polling, `agir`, erros, backoff, aba oculta |
| `src/ui/online/TelaEntrada.tsx` | criar sala / entrar com código |
| `src/ui/online/TelaLobby.tsx` | código, QR, jogadores, modo, iniciar |
| `src/ui/online/TelaSala.tsx` | compõe lobby + telas do jogo por `perspectiva` |
| `src/ui/rota.ts` | `useRota`, `navegar` |
| `src/ui/Raiz.tsx` | roteia `/`, `/online`, `/sala/:codigo` |
| `src/ui/TelaRodada.tsx`, `TelaRevelacao.tsx`, `TelaFimJogo.tsx`, `ModalTempo.tsx`, `Relogio.tsx` | aceitam `EstadoVisivel` + `perspectiva` |

---

### Task 1: `palpite` ganha `jogadorId` e tipos visíveis

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/rodada.ts`
- Modify: `src/engine/rodada.test.ts`, `src/engine/jogo.test.ts`, `src/ui/TelaRodada.tsx`, `src/ui/TelaRodada.test.tsx`, `src/ui/App.test.tsx`
- Test: `src/engine/rodada.test.ts`

**Interfaces:**
- Consumes: engine atual.
- Produces:
  - `AcaoRodada.palpite = { tipo: 'palpite'; texto: string; jogadorId: string }`
  - `ErroRodada` inclui `'jogador_invalido'`
  - `export function proximoVivoApos(estado: EstadoRodada, refId: string, vivos: string[]): string`
  - `export function proximoAPalpitar(rodada: EstadoRodada): string | null` — quem pode dar o próximo palpite agora (`vezDe` em `palpite`; próximo vivo após o autor em `janela_duvida`; `null` em `fim_rodada`)
  - Tipos: `CategoriaVisivel`, `RodadaVisivel`, `EstadoVisivel`, `PodeAgir`, `VisaoJogo`

- [ ] **Step 1: Adicionar os tipos**

Em `src/engine/types.ts`, trocar a variante `palpite` de `AcaoRodada` e acrescentar `'jogador_invalido'`:

```ts
export type AcaoRodada =
  | { tipo: 'palpite'; texto: string; jogadorId: string }
  | { tipo: 'ninguem_duvidou' }
  | { tipo: 'duvidar'; duvidadorId: string }

export type ErroRodada =
  | 'palpite_vazio'
  | 'palpite_duplicado'
  | 'fase_invalida'
  | 'duvidador_invalido'
  | 'jogador_invalido'
```

Acrescentar ao fim do arquivo:

```ts
/** Categoria como o cliente pode ve-la: `itens` so existe depois da revelacao. */
export type CategoriaVisivel = {
  id: string
  titulo: string
  fonte: string
  itens?: ItemCategoria[]
}

export type RodadaVisivel = Omit<EstadoRodada, 'categoria'> & { categoria: CategoriaVisivel }

/**
 * Subconjunto de EstadoJogo que as telas leem. EstadoJogo e atribuivel a
 * EstadoVisivel; a visao publica online tambem. Assim as mesmas telas servem
 * o modo de um dispositivo e o modo online.
 */
export type EstadoVisivel = {
  fase: FaseJogo
  jogadores: Jogador[]
  placar: Record<string, number>
  relogio: EstadoRelogio
  rodada: RodadaVisivel | null
  concluidas: RodadaConcluida[]
  encerrarAposRodada: boolean
}

export type PodeAgir = { palpite: boolean; duvidar: boolean; host: boolean }

export type VisaoJogo = EstadoVisivel & {
  jogadorId: string
  categoriasDisponiveis: { id: string; titulo: string }[]
  podeAgir: PodeAgir
}
```

- [ ] **Step 2: Escrever os testes falhando**

Em `src/engine/rodada.test.ts`, **toda** ação `{ tipo: 'palpite', texto }` existente passa a levar `jogadorId`. Atualize cada uma para o jogador correto: na sequência padrão a→b→c, o primeiro palpite é de `'a'`, depois de `ninguem_duvidou` o próximo é de `'b'`, e assim por diante. Exemplo do teste `da a volta na ordem`:

```ts
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
```

No teste `lista esgotada`, o loop passa a usar `jogadorId: e.vezDe`:

```ts
    for (const item of categoria.itens) {
      e = aplicar(
        e,
        { tipo: 'palpite', texto: item.nome, jogadorId: e.vezDe },
        { tipo: 'ninguem_duvidou' },
      )
    }
```

Acrescentar um novo `describe` ao fim do arquivo:

```ts
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
```

Atualizar o import do topo do arquivo: `import { iniciarRodada, aplicarAcaoRodada, proximoAPalpitar } from './rodada'`.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- rodada`
Expected: FAIL — erros de tipo em `jogadorId`, `proximoAPalpitar` não exportado.

- [ ] **Step 4: Implementar em `src/engine/rodada.ts`**

Exportar `proximoVivoApos` (trocar `function` por `export function`), acrescentar `proximoAPalpitar` logo abaixo dela, e reescrever o ramo `palpite`:

```ts
/** Quem pode dar o proximo palpite agora, ou null se a rodada acabou. */
export function proximoAPalpitar(rodada: EstadoRodada): string | null {
  if (rodada.fase === 'palpite') return rodada.vezDe
  if (rodada.fase === 'janela_duvida') {
    const ultimo = rodada.palpites[rodada.palpites.length - 1]
    return proximoVivoApos(rodada, ultimo.autorId, rodada.vivos)
  }
  return null
}
```

```ts
  if (acao.tipo === 'palpite') {
    const esperado = proximoAPalpitar(estado)
    if (esperado === null) return { ok: false, erro: 'fase_invalida', estado }
    if (acao.jogadorId !== esperado) return { ok: false, erro: 'jogador_invalido', estado }
    if (normalizar(acao.texto) === '') return { ok: false, erro: 'palpite_vazio', estado }
    if (jaFoiDito(estado, acao.texto)) return { ok: false, erro: 'palpite_duplicado', estado }

    // Na janela de duvida, o palpite do proximo jogador e o "ninguem duvidou":
    // fecha a janela do palpite anterior e abre a sua.
    const base =
      estado.fase === 'janela_duvida'
        ? { ...estado, fase: 'palpite' as const, vezDe: esperado, ultimoEvento: null }
        : estado

    return {
      ok: true,
      estado: {
        ...base,
        fase: 'janela_duvida',
        palpites: [
          ...base.palpites,
          { texto: acao.texto, autorId: base.vezDe, resultado: 'pendente' },
        ],
        ultimoEvento: null,
      },
    }
  }
```

- [ ] **Step 5: Atualizar os demais chamadores**

- `src/engine/jogo.test.ts`: toda ação `{ tipo: 'palpite', texto }` ganha `jogadorId: 'a'` (nos testes, `a` é sempre quem começa e nunca há segundo palpite antes de uma dúvida).
- `src/ui/TelaRodada.tsx`, em `enviarPalpite`: `aoAgir({ tipo: 'palpite', texto, jogadorId: rodada.vezDe })`.
- `src/ui/TelaRodada.test.tsx`: as asserções `toHaveBeenCalledWith({ tipo: 'palpite', texto: ... })` ganham `jogadorId: 'a'`.
- `src/ui/App.test.tsx`: não afirma o formato da ação, mas a fábrica de estado da Task 10 do plano anterior não existe aqui; rode a suíte e ajuste apenas o que quebrar por tipo.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test && npm run build`
Expected: tudo PASS, build limpo.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): palpite identifica o jogador e fecha a janela de duvida

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `adicionar_jogador`

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/jogo.ts`
- Test: `src/engine/jogo.test.ts`

**Interfaces:**
- Produces: `AcaoJogo` inclui `{ tipo: 'adicionar_jogador'; jogador: Jogador }`

- [ ] **Step 1: Tipo**

Em `AcaoJogo`, acrescentar a variante `| { tipo: 'adicionar_jogador'; jogador: Jogador }`.

- [ ] **Step 2: Teste falhando**

Acrescentar em `src/engine/jogo.test.ts`:

```ts
describe('adicionar_jogador', () => {
  const base = () =>
    aplicar(criarJogo(catalogo), T0, {
      tipo: 'configurar',
      jogadores,
      modo: { tipo: 'categorias', quantidade: 3 },
    })

  it('entra entre rodadas com zero pontos', () => {
    const e = aplicar(base(), T0, { tipo: 'adicionar_jogador', jogador: { id: 'c', nome: 'Carla' } })
    expect(e.jogadores.map((j) => j.id)).toEqual(['a', 'b', 'c'])
    expect(e.placar.c).toBe(0)
  })

  it('entra na revelacao e participa da proxima rodada', () => {
    let e = rodadaCompleta(base(), T0, 'c1')
    e = aplicar(e, T0, { tipo: 'adicionar_jogador', jogador: { id: 'c', nome: 'Carla' } })
    e = aplicar(e, T0, { tipo: 'avancar' }, { tipo: 'iniciar_rodada', categoriaId: 'c2' })
    expect(e.rodada?.ordem).toEqual(['a', 'b', 'c'])
  })

  it('e rejeitado no meio de uma rodada', () => {
    const e = aplicar(base(), T0, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    const r = aplicarAcaoJogo(e, { tipo: 'adicionar_jogador', jogador: { id: 'c', nome: 'Carla' } }, T0)
    expect(r.ok).toBe(false)
  })

  it('rejeita id repetido', () => {
    const r = aplicarAcaoJogo(base(), { tipo: 'adicionar_jogador', jogador: { id: 'a', nome: 'Outra' } }, T0)
    expect(r.ok).toBe(false)
  })

  it('rejeita antes de configurar e depois do fim', () => {
    const r1 = aplicarAcaoJogo(criarJogo(catalogo), { tipo: 'adicionar_jogador', jogador: { id: 'c', nome: 'C' } }, T0)
    expect(r1.ok).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- jogo`
Expected: FAIL.

- [ ] **Step 4: Implementar** — novo `case` em `aplicarAcaoJogo`:

```ts
    case 'adicionar_jogador': {
      const entreRodadas =
        (estado.fase === 'em_rodada' && estado.rodada === null) || estado.fase === 'revelacao'
      if (!entreRodadas) return { ok: false, erro: 'acao_invalida', estado }
      if (estado.jogadores.some((j) => j.id === acao.jogador.id)) {
        return { ok: false, erro: 'acao_invalida', estado }
      }
      return {
        ok: true,
        estado: {
          ...estado,
          jogadores: [...estado.jogadores, acao.jogador],
          placar: { ...estado.placar, [acao.jogador.id]: 0 },
        },
      }
    }
```

- [ ] **Step 5: Rodar e confirmar que passa; suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine
git commit -m "feat(engine): adicionar jogador entre rodadas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `visaoPublica` — a projeção sem a lista

**Files:**
- Create: `src/engine/visao.ts`
- Test: `src/engine/visao.test.ts`

**Interfaces:**
- Consumes: `proximoAPalpitar`, `categoriasDisponiveis`, tipos da Task 1.
- Produces: `visaoPublica(estado: EstadoJogo, jogadorId: string, ehHost: boolean): VisaoJogo`

- [ ] **Step 1: Teste falhando**

```ts
import { describe, it, expect } from 'vitest'
import { visaoPublica } from './visao'
import { criarJogo, aplicarAcaoJogo } from './jogo'
import type { AcaoJogo, Categoria, EstadoJogo } from './types'

const T0 = 1_000_000

function cat(id: string, nomes: string[]): Categoria {
  return { id, titulo: `Cat ${id}`, fonte: 'teste', itens: nomes.map((nome) => ({ nome, apelidos: [`ap-${nome}`] })) }
}
const catalogo = [
  cat('c1', ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett']),
  cat('c2', ['Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango']),
]
const jogadores = [
  { id: 'a', nome: 'Ana' },
  { id: 'b', nome: 'Bruno' },
  { id: 'c', nome: 'Carla' },
]

function aplicar(estado: EstadoJogo, ...acoes: AcaoJogo[]): EstadoJogo {
  return acoes.reduce((atual, acao) => {
    const r = aplicarAcaoJogo(atual, acao, T0)
    if (!r.ok) throw new Error(r.erro)
    return r.estado
  }, estado)
}

const configurado = () =>
  aplicar(criarJogo(catalogo), { tipo: 'configurar', jogadores, modo: { tipo: 'categorias', quantidade: 2 } })

const emRodada = () => aplicar(configurado(), { tipo: 'iniciar_rodada', categoriaId: 'c1' })

describe('sigilo', () => {
  it('nao serializa nenhum item nem apelido durante a rodada', () => {
    const e = aplicar(emRodada(), { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa', jogadorId: 'a' } })
    const texto = JSON.stringify(visaoPublica(e, 'b', false))
    for (const item of catalogo[0].itens) {
      expect(texto).not.toContain(item.nome)
      for (const ap of item.apelidos) expect(texto).not.toContain(ap)
    }
    expect(texto).not.toContain('catalogo')
  })

  it('nao serializa itens de categorias nao jogadas mesmo para o host', () => {
    const texto = JSON.stringify(visaoPublica(configurado(), 'a', true))
    for (const c of catalogo) for (const item of c.itens) expect(texto).not.toContain(item.nome)
    expect(texto).toContain('Cat c1')
  })

  it('nao serializa itens durante decisao_tempo', () => {
    let e = aplicar(criarJogo(catalogo), { tipo: 'configurar', jogadores, modo: { tipo: 'tempo', minutos: 1 } })
    e = aplicar(e, { tipo: 'iniciar_rodada', categoriaId: 'c1' }, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } })
    const r = aplicarAcaoJogo(e, { tipo: 'tick' }, T0 + 60_001)
    expect(r.estado.fase).toBe('decisao_tempo')
    const texto = JSON.stringify(visaoPublica(r.estado, 'a', true))
    for (const item of catalogo[0].itens) expect(texto).not.toContain(item.nome)
  })

  it('revela os itens da rodada em revelacao e fim_jogo', () => {
    const e = aplicar(
      emRodada(),
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Yankee', jogadorId: 'b' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'c' } },
    )
    expect(e.fase).toBe('revelacao')
    const v = visaoPublica(e, 'a', false)
    expect(v.rodada?.categoria.itens?.map((i) => i.nome)).toEqual(catalogo[0].itens.map((i) => i.nome))
    expect(v.concluidas[0].categoria.itens).toHaveLength(10)
  })
})

describe('podeAgir', () => {
  it('so a vez pode palpitar em fase de palpite', () => {
    const e = emRodada()
    expect(visaoPublica(e, 'a', false).podeAgir).toEqual({ palpite: true, duvidar: false, host: false })
    expect(visaoPublica(e, 'b', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
  })

  it('na janela de duvida, o proximo pode palpitar e os outros vivos podem duvidar', () => {
    const e = aplicar(emRodada(), { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa', jogadorId: 'a' } })
    expect(visaoPublica(e, 'a', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
    expect(visaoPublica(e, 'b', false).podeAgir).toEqual({ palpite: true, duvidar: true, host: false })
    expect(visaoPublica(e, 'c', false).podeAgir).toEqual({ palpite: false, duvidar: true, host: false })
  })

  it('eliminado nao faz nada', () => {
    const e = aplicar(
      emRodada(),
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Zulu', jogadorId: 'a' } },
      { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: 'b' } },
      { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'Alfa', jogadorId: 'b' } },
    )
    expect(visaoPublica(e, 'a', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
  })

  it('host ve categorias disponiveis; nao host ve lista vazia', () => {
    const e = configurado()
    expect(visaoPublica(e, 'a', true).categoriasDisponiveis).toEqual([
      { id: 'c1', titulo: 'Cat c1' },
      { id: 'c2', titulo: 'Cat c2' },
    ])
    expect(visaoPublica(e, 'a', true).podeAgir.host).toBe(true)
    expect(visaoPublica(e, 'b', false).categoriasDisponiveis).toEqual([])
  })

  it('jogador que nao esta no jogo nao pode nada', () => {
    const e = emRodada()
    expect(visaoPublica(e, 'zzz', false).podeAgir).toEqual({ palpite: false, duvidar: false, host: false })
  })
})

describe('forma', () => {
  it('carrega jogadorId, fase, placar, relogio e encerrarAposRodada', () => {
    const v = visaoPublica(emRodada(), 'b', false)
    expect(v.jogadorId).toBe('b')
    expect(v.fase).toBe('em_rodada')
    expect(v.placar).toEqual({ a: 0, b: 0, c: 0 })
    expect(v.relogio.modo).toEqual({ tipo: 'categorias', quantidade: 2 })
    expect(v.rodada?.categoria).toEqual({ id: 'c1', titulo: 'Cat c1', fonte: 'teste' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- visao`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/engine/visao.ts`**

```ts
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
  return { ...resto, categoria: revelada ? categoria : resumo(categoria) }
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
```

- [ ] **Step 4: Rodar e confirmar que passa; suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/visao.ts src/engine/visao.test.ts
git commit -m "feat(engine): visao publica sem a lista secreta

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Tipos do servidor, código de sala e store em memória

**Files:**
- Create: `src/servidor/tipos.ts`, `src/servidor/codigo.ts`, `src/servidor/store.ts`
- Test: `src/servidor/codigo.test.ts`, `src/servidor/store.test.ts`

**Interfaces:**
- Produces:

```ts
// tipos.ts
export type JogadorSala = { id: string; apelido: string; token: string; ultimoPollEm: number }
export type Sala = {
  codigo: string; hostId: string; jogadores: JogadorSala[]
  jogo: Omit<EstadoJogo, 'catalogo'> | null
  versao: number; criadaEm: number; atualizadaEm: number
}
export type AcaoSala =
  | { tipo: 'iniciar_partida'; modo: ModoDuracao }
  | { tipo: 'entrar_na_partida' }
  | Exclude<AcaoJogo, { tipo: 'configurar' } | { tipo: 'adicionar_jogador' } | { tipo: 'tick' }>
export type VisaoSala = {
  codigo: string; hostId: string; jogadorId: string; ehHost: boolean
  jogadores: { id: string; apelido: string }[]
  jogo: VisaoJogo | null
}
export type ErroServidor =
  | 'corpo_invalido' | 'token_invalido' | 'nao_autorizado' | 'sala_inexistente'
  | 'versao_desatualizada' | 'apelido_em_uso' | 'acao_rejeitada' | 'store_indisponivel'
export type Geradores = { novoId(): string; novoToken(): string; novoCodigo(): string }
export const TTL_SALA_MS = 6 * 60 * 60 * 1000
export const HOST_AUSENTE_MS = 30_000
// codigo.ts
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // sem I e O
export function gerarCodigo(aleatorio: () => number): string   // 5 letras
export function codigoValido(s: string): boolean
// store.ts
export interface StoreSala {
  obter(codigo: string): Promise<Sala | null>
  gravarSe(sala: Sala, versaoEsperada: number): Promise<boolean>
}
export function storeMemoria(): StoreSala & { limpar(): void }
```

- [ ] **Step 1: Escrever `src/servidor/tipos.ts`** com o conteúdo acima (imports de `../engine/types`).

- [ ] **Step 2: Testes falhando**

`src/servidor/codigo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gerarCodigo, codigoValido, ALFABETO_CODIGO } from './codigo'

describe('gerarCodigo', () => {
  it('tem 5 letras do alfabeto sem I e O', () => {
    const c = gerarCodigo(Math.random)
    expect(c).toHaveLength(5)
    for (const l of c) expect(ALFABETO_CODIGO).toContain(l)
    expect(ALFABETO_CODIGO).not.toContain('I')
    expect(ALFABETO_CODIGO).not.toContain('O')
  })

  it('e deterministico dado o aleatorio', () => {
    let i = 0
    const seq = [0, 0.5, 0.999, 0.25, 0.75]
    const fake = () => seq[i++ % seq.length]
    expect(gerarCodigo(fake)).toBe(gerarCodigo((i = 0, fake)))
  })
})

describe('codigoValido', () => {
  it.each(['ABCDE', 'KJQTM'])('%s e valido', (c) => expect(codigoValido(c)).toBe(true))
  it.each(['abcde', 'ABCD', 'ABCDEF', 'ABCDI', 'ABC-E', ''])('%s e invalido', (c) =>
    expect(codigoValido(c)).toBe(false),
  )
})
```

`src/servidor/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { storeMemoria } from './store'
import type { Sala } from './tipos'

const sala = (versao: number): Sala => ({
  codigo: 'ABCDE',
  hostId: 'h',
  jogadores: [],
  jogo: null,
  versao,
  criadaEm: 0,
  atualizadaEm: 0,
})

describe('storeMemoria', () => {
  it('devolve null para codigo desconhecido', async () => {
    expect(await storeMemoria().obter('ZZZZZ')).toBeNull()
  })

  it('cria quando a versao esperada e 0 e nao existe', async () => {
    const s = storeMemoria()
    expect(await s.gravarSe(sala(1), 0)).toBe(true)
    expect((await s.obter('ABCDE'))?.versao).toBe(1)
  })

  it('recusa criar se ja existe', async () => {
    const s = storeMemoria()
    await s.gravarSe(sala(1), 0)
    expect(await s.gravarSe(sala(1), 0)).toBe(false)
  })

  it('grava quando a versao bate e recusa quando nao bate', async () => {
    const s = storeMemoria()
    await s.gravarSe(sala(1), 0)
    expect(await s.gravarSe(sala(2), 1)).toBe(true)
    expect(await s.gravarSe(sala(3), 1)).toBe(false)
    expect((await s.obter('ABCDE'))?.versao).toBe(2)
  })

  it('devolve uma copia, nao a referencia guardada', async () => {
    const s = storeMemoria()
    await s.gravarSe(sala(1), 0)
    const a = await s.obter('ABCDE')
    a!.hostId = 'mutado'
    expect((await s.obter('ABCDE'))?.hostId).toBe('h')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- servidor`
Expected: FAIL.

- [ ] **Step 4: Implementar**

`src/servidor/codigo.ts`:

```ts
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const TAMANHO = 5

export function gerarCodigo(aleatorio: () => number): string {
  let s = ''
  for (let i = 0; i < TAMANHO; i++) {
    s += ALFABETO_CODIGO[Math.floor(aleatorio() * ALFABETO_CODIGO.length)]
  }
  return s
}

export function codigoValido(s: string): boolean {
  return s.length === TAMANHO && [...s].every((l) => ALFABETO_CODIGO.includes(l))
}
```

`src/servidor/store.ts`:

```ts
import type { Sala } from './tipos'

/**
 * Compare-and-set: `gravarSe` so grava se a versao atual no store for
 * exatamente `versaoEsperada` (0 = ainda nao existe). E o que resolve dois
 * "Duvido" chegando ao mesmo tempo sem lock.
 */
export interface StoreSala {
  obter(codigo: string): Promise<Sala | null>
  gravarSe(sala: Sala, versaoEsperada: number): Promise<boolean>
}

export function storeMemoria(): StoreSala & { limpar(): void } {
  const salas = new Map<string, string>()
  return {
    async obter(codigo) {
      const bruto = salas.get(codigo)
      return bruto === undefined ? null : (JSON.parse(bruto) as Sala)
    },
    async gravarSe(sala, versaoEsperada) {
      const atual = salas.get(sala.codigo)
      const versaoAtual = atual === undefined ? 0 : (JSON.parse(atual) as Sala).versao
      if (versaoAtual !== versaoEsperada) return false
      salas.set(sala.codigo, JSON.stringify(sala))
      return true
    },
    limpar() {
      salas.clear()
    },
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa; suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/servidor
git commit -m "feat(servidor): tipos da sala, codigo e store em memoria com CAS

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Lógica pura da sala e autorização

**Files:**
- Create: `src/servidor/autorizacao.ts`, `src/servidor/sala.ts`
- Test: `src/servidor/sala.test.ts`

**Interfaces:**
- Consumes: Task 4, `visaoPublica`, `aplicarAcaoJogo`, `criarJogo`.
- Produces:

```ts
// autorizacao.ts
export function ehHostEfetivo(sala: Sala, jogadorId: string, agora: number): boolean
export function podeExecutar(sala: Sala, jogadorId: string, acao: AcaoSala, agora: number): boolean
// sala.ts
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroServidor; detalhe?: string }
export function criarSala(apelido: string, agora: number, g: Geradores): { sala: Sala; jogador: JogadorSala }
export function entrarNaSala(sala: Sala, apelido: string, agora: number, g: Geradores): Resultado<{ sala: Sala; jogador: JogadorSala }>
export function autenticar(sala: Sala, jogadorId: string, token: string): boolean
export function lerSala(sala: Sala, jogadorId: string, agora: number, catalogo: Categoria[]): { sala: Sala; visao: VisaoSala }
export function aplicarAcaoNaSala(sala: Sala, jogadorId: string, acao: AcaoSala, agora: number, catalogo: Categoria[]): Resultado<{ sala: Sala; visao: VisaoSala }>
export function montarVisao(sala: Sala, jogadorId: string, agora: number, catalogo: Categoria[]): VisaoSala
```

Regras: `criarSala` e `entrarNaSala` não incrementam `versao` além de setar `1` na criação e `+1` na entrada. `lerSala` registra `ultimoPollEm` do jogador e, se `jogo` está em modo por tempo, aplica `tick`; devolve `sala` com `versao + 1` **apenas** se algo mudou além de `ultimoPollEm` (o poll não gira a versão — senão todo cliente veria mudança a cada segundo). `ultimoPollEm` é gravado sem girar versão; o CAS continua usando a versão anterior.

- [ ] **Step 1: Teste falhando** — `src/servidor/sala.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- servidor/sala`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/servidor/autorizacao.ts`**

```ts
import { HOST_AUSENTE_MS, type AcaoSala, type Sala } from './tipos'

export function ehHostEfetivo(sala: Sala, jogadorId: string, agora: number): boolean {
  if (sala.hostId === jogadorId) return true
  const host = sala.jogadores.find((j) => j.id === sala.hostId)
  if (!host) return true
  return agora - host.ultimoPollEm > HOST_AUSENTE_MS
}

export function podeExecutar(sala: Sala, jogadorId: string, acao: AcaoSala, agora: number): boolean {
  switch (acao.tipo) {
    case 'iniciar_partida':
    case 'iniciar_rodada':
    case 'avancar':
    case 'decidir_expiracao':
      return ehHostEfetivo(sala, jogadorId, agora)
    case 'entrar_na_partida':
      return true
    case 'rodada':
      if (acao.acao.tipo === 'palpite') return acao.acao.jogadorId === jogadorId
      if (acao.acao.tipo === 'duvidar') return acao.acao.duvidadorId === jogadorId
      return false // ninguem_duvidou nao existe online: o proximo palpite fecha a janela
  }
}
```

- [ ] **Step 4: Implementar `src/servidor/sala.ts`**

```ts
import { aplicarAcaoJogo, criarJogo } from '../engine/jogo'
import { normalizar } from '../engine/normalizar'
import { visaoPublica } from '../engine/visao'
import type { AcaoJogo, Categoria, EstadoJogo } from '../engine/types'
import { ehHostEfetivo, podeExecutar } from './autorizacao'
import type { AcaoSala, ErroServidor, Geradores, JogadorSala, Sala, VisaoSala } from './tipos'

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: ErroServidor; detalhe?: string }

export function criarSala(apelido: string, agora: number, g: Geradores): { sala: Sala; jogador: JogadorSala } {
  const jogador: JogadorSala = { id: g.novoId(), apelido: apelido.trim(), token: g.novoToken(), ultimoPollEm: agora }
  const sala: Sala = {
    codigo: g.novoCodigo(),
    hostId: jogador.id,
    jogadores: [jogador],
    jogo: null,
    versao: 1,
    criadaEm: agora,
    atualizadaEm: agora,
  }
  return { sala, jogador }
}

export function entrarNaSala(sala: Sala, apelido: string, agora: number, g: Geradores): Resultado<{ sala: Sala; jogador: JogadorSala }> {
  const limpo = apelido.trim()
  if (limpo === '') return { ok: false, erro: 'corpo_invalido', detalhe: 'apelido vazio' }
  const alvo = normalizar(limpo)
  if (sala.jogadores.some((j) => normalizar(j.apelido) === alvo)) {
    return { ok: false, erro: 'apelido_em_uso' }
  }
  const jogador: JogadorSala = { id: g.novoId(), apelido: limpo, token: g.novoToken(), ultimoPollEm: agora }
  return {
    ok: true,
    valor: {
      sala: { ...sala, jogadores: [...sala.jogadores, jogador], versao: sala.versao + 1, atualizadaEm: agora },
      jogador,
    },
  }
}

export function autenticar(sala: Sala, jogadorId: string, token: string): boolean {
  const j = sala.jogadores.find((x) => x.id === jogadorId)
  return j !== undefined && j.token === token
}

function hidratar(sala: Sala, catalogo: Categoria[]): EstadoJogo | null {
  return sala.jogo === null ? null : { ...sala.jogo, catalogo }
}

function desidratar(jogo: EstadoJogo): Omit<EstadoJogo, 'catalogo'> {
  const { catalogo: _c, ...resto } = jogo
  return resto
}

export function montarVisao(sala: Sala, jogadorId: string, agora: number, catalogo: Categoria[]): VisaoSala {
  const ehHost = ehHostEfetivo(sala, jogadorId, agora)
  const jogo = hidratar(sala, catalogo)
  return {
    codigo: sala.codigo,
    hostId: sala.hostId,
    jogadorId,
    ehHost,
    jogadores: sala.jogadores.map((j) => ({ id: j.id, apelido: j.apelido })),
    jogo: jogo === null ? null : visaoPublica(jogo, jogadorId, ehHost),
  }
}

function registrarPoll(sala: Sala, jogadorId: string, agora: number): Sala {
  return {
    ...sala,
    jogadores: sala.jogadores.map((j) => (j.id === jogadorId ? { ...j, ultimoPollEm: agora } : j)),
  }
}

/** Le a sala para um jogador. Registra presenca e, no modo por tempo, aplica o tick. */
export function lerSala(sala: Sala, jogadorId: string, agora: number, catalogo: Categoria[]): { sala: Sala; visao: VisaoSala } {
  let atual = registrarPoll(sala, jogadorId, agora)
  const jogo = hidratar(atual, catalogo)
  if (jogo !== null && jogo.relogio.modo.tipo === 'tempo') {
    const r = aplicarAcaoJogo(jogo, { tipo: 'tick' }, agora)
    if (r.ok && r.estado !== jogo) {
      atual = { ...atual, jogo: desidratar(r.estado), versao: atual.versao + 1, atualizadaEm: agora }
    }
  }
  return { sala: atual, visao: montarVisao(atual, jogadorId, agora, catalogo) }
}

function traduzir(sala: Sala, acao: AcaoSala, jogadorId: string): AcaoJogo {
  if (acao.tipo === 'iniciar_partida') {
    return {
      tipo: 'configurar',
      jogadores: sala.jogadores.map((j) => ({ id: j.id, nome: j.apelido })),
      modo: acao.modo,
    }
  }
  if (acao.tipo === 'entrar_na_partida') {
    const j = sala.jogadores.find((x) => x.id === jogadorId)!
    return { tipo: 'adicionar_jogador', jogador: { id: j.id, nome: j.apelido } }
  }
  return acao
}

export function aplicarAcaoNaSala(
  sala: Sala,
  jogadorId: string,
  acao: AcaoSala,
  agora: number,
  catalogo: Categoria[],
): Resultado<{ sala: Sala; visao: VisaoSala }> {
  if (!podeExecutar(sala, jogadorId, acao, agora)) return { ok: false, erro: 'nao_autorizado' }

  const jogo = hidratar(sala, catalogo) ?? criarJogo(catalogo)
  const r = aplicarAcaoJogo(jogo, traduzir(sala, acao, jogadorId), agora)
  if (!r.ok) return { ok: false, erro: 'acao_rejeitada', detalhe: r.erro }

  const nova: Sala = {
    ...registrarPoll(sala, jogadorId, agora),
    jogo: desidratar(r.estado),
    versao: sala.versao + 1,
    atualizadaEm: agora,
  }
  return { ok: true, valor: { sala: nova, visao: montarVisao(nova, jogadorId, agora, catalogo) } }
}
```

- [ ] **Step 5: Rodar e confirmar que passa; suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/servidor
git commit -m "feat(servidor): logica pura da sala e autorizacao

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Roteador HTTP, servidor Node, plugin de dev e store em arquivo

**Files:**
- Create: `src/servidor/http.ts`, `src/servidor/node-web.ts`, `src/servidor/store-arquivo.ts`, `src/servidor/vite-plugin-api.ts`, `servidor.ts`
- Modify: `vite.config.ts`, `package.json`, `tsconfig.json` (incluir `servidor.ts`), `.gitignore` (`dados/`)
- Test: `src/servidor/http.test.ts`, `src/servidor/store-arquivo.test.ts`

**Interfaces:**
- Produces:

```ts
// http.ts
export type DependenciasHttp = { store: StoreSala; catalogo: Categoria[]; agora: () => number; geradores: Geradores }
export function roteador(request: Request, deps: DependenciasHttp): Promise<Response>
export function dependenciasPadrao(store: StoreSala): DependenciasHttp   // Date.now + crypto + carregarCategorias
// node-web.ts
export function paraRequest(req: IncomingMessage): Promise<Request>
export function escreverResponse(res: ServerResponse, resp: Response): Promise<void>
// store-arquivo.ts
export function storeArquivo(caminho: string): Promise<StoreSala>   // carrega o JSON se existir; grava apos cada gravarSe bem-sucedido
```

Rotas (prefixo `/api`):
- `POST /api/salas` `{ apelido }` → `201 { codigo, jogadorId, token, versao, visao }`
- `POST /api/salas/:codigo/entrar` `{ apelido }` → `200 { jogadorId, token, versao, visao }`
- `GET /api/salas/:codigo?versao=N` + headers `X-Jogador-Id`, `X-Jogador-Token` → `200 { versao, visao }` | `204`
- `POST /api/salas/:codigo/acoes` `{ versao, acao }` + headers → `200 { versao, visao }` | `409 { erro, versao, visao }`
- Erros: `{ erro, mensagem, detalhe? }` com os HTTP da seção 5 do spec.
- **TTL:** `carregarSala` trata como inexistente (404) uma sala com `atualizadaEm` há mais de `TTL_SALA_MS`. É no roteador, não no store, para valer igual em memória e em arquivo.

`gerarCodigo` colide? `POST /api/salas` tenta até 5 códigos; se todos existirem, 503.

O servidor de produção é **um único processo Node** (`servidor.ts`): serve `dist/` como estático com fallback SPA para `index.html`, e monta `/api` no `roteador`. O store é `storeArquivo('dados/salas.json')`: memória como fonte da verdade, com snapshot em disco a cada gravação para sobreviver a um restart do `pm2`.

- [ ] **Step 1: Instalar dependência de runtime**

```bash
npm install tsx
```

`tsx` roda `servidor.ts` direto, sem etapa de compilação do servidor, em qualquer Node ≥ 18.

- [ ] **Step 2: Teste falhando do roteador** — `src/servidor/http.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { roteador, type DependenciasHttp } from './http'
import { storeMemoria } from './store'
import { TTL_SALA_MS } from './tipos'
import type { Categoria } from '../engine/types'

function cat(id: string): Categoria {
  return { id, titulo: `Cat ${id}`, fonte: 'teste', itens: 'ABCDEFGHIJ'.split('').map((n) => ({ nome: `${n}${id}`, apelidos: [] })) }
}

let deps: DependenciasHttp
let relogio: number

beforeEach(() => {
  let n = 0
  relogio = 1_000_000
  deps = {
    store: storeMemoria(),
    catalogo: [cat('c1'), cat('c2')],
    agora: () => relogio,
    geradores: { novoId: () => `j${++n}`, novoToken: () => `t${n}`, novoCodigo: () => 'ABCDE' },
  }
})

const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const req = (metodo: string, caminho: string, init: RequestInit = {}) =>
  roteador(new Request(`http://x${caminho}`, { method: metodo, ...init }), deps)
const auth = (id: string, token: string) => ({ 'X-Jogador-Id': id, 'X-Jogador-Token': token })

async function salaComDois() {
  const c = await (await req('POST', '/api/salas', json({ apelido: 'Ana' }))).json()
  const e = await (await req('POST', '/api/salas/ABCDE/entrar', json({ apelido: 'Bruno' }))).json()
  return { host: { id: c.jogadorId, token: c.token }, outro: { id: e.jogadorId, token: e.token }, versao: e.versao }
}

describe('criar e entrar', () => {
  it('cria sala', async () => {
    const r = await req('POST', '/api/salas', json({ apelido: 'Ana' }))
    expect(r.status).toBe(201)
    const b = await r.json()
    expect(b.codigo).toBe('ABCDE')
    expect(b.token).toBe('t1')
    expect(b.visao.ehHost).toBe(true)
  })

  it('rejeita corpo invalido', async () => {
    const r = await req('POST', '/api/salas', { body: '{nao json', headers: { 'content-type': 'application/json' } })
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toBe('corpo_invalido')
  })

  it('entrar em sala inexistente', async () => {
    const r = await req('POST', '/api/salas/ZZZZZ/entrar', json({ apelido: 'B' }))
    expect(r.status).toBe(404)
  })

  it('codigo malformado e 404', async () => {
    const r = await req('POST', '/api/salas/abc/entrar', json({ apelido: 'B' }))
    expect(r.status).toBe(404)
  })

  it('apelido repetido e 409', async () => {
    await req('POST', '/api/salas', json({ apelido: 'Ana' }))
    const r = await req('POST', '/api/salas/ABCDE/entrar', json({ apelido: 'ana' }))
    expect(r.status).toBe(409)
    expect((await r.json()).erro).toBe('apelido_em_uso')
  })
})

describe('ler', () => {
  it('exige token valido', async () => {
    const { host } = await salaComDois()
    expect((await req('GET', '/api/salas/ABCDE', { headers: auth(host.id, 'errado') })).status).toBe(403)
    expect((await req('GET', '/api/salas/ABCDE')).status).toBe(403)
  })

  it('204 quando a versao nao mudou', async () => {
    const { host, versao } = await salaComDois()
    const r = await req('GET', `/api/salas/ABCDE?versao=${versao}`, { headers: auth(host.id, host.token) })
    expect(r.status).toBe(204)
  })

  it('200 com visao quando mudou', async () => {
    const { outro, versao } = await salaComDois()
    const r = await req('GET', `/api/salas/ABCDE?versao=${versao - 1}`, { headers: auth(outro.id, outro.token) })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.versao).toBe(versao)
    expect(b.visao.jogadorId).toBe(outro.id)
    expect(b.visao.jogadores).toHaveLength(2)
  })

  it('sala parada ha mais de 6 h e 404', async () => {
    const { host } = await salaComDois()
    relogio += TTL_SALA_MS + 1
    const r = await req('GET', '/api/salas/ABCDE', { headers: auth(host.id, host.token) })
    expect(r.status).toBe(404)
  })
})

describe('acoes', () => {
  const acao = (c: { id: string; token: string }, versao: number, acao: unknown) =>
    req('POST', '/api/salas/ABCDE/acoes', {
      ...json({ versao, acao }),
      headers: { ...auth(c.id, c.token), 'content-type': 'application/json' },
    })

  it('host inicia a partida e a rodada; nao host recebe 403', async () => {
    const { host, outro, versao } = await salaComDois()
    const r1 = await acao(host, versao, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })
    expect(r1.status).toBe(200)
    const b1 = await r1.json()
    const r2 = await acao(outro, b1.versao, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    expect(r2.status).toBe(403)
  })

  it('versao desatualizada e 409 com a visao atual', async () => {
    const { host, versao } = await salaComDois()
    const r = await acao(host, versao - 1, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })
    expect(r.status).toBe(409)
    const b = await r.json()
    expect(b.erro).toBe('versao_desatualizada')
    expect(b.versao).toBe(versao)
    expect(b.visao.codigo).toBe('ABCDE')
  })

  it('acao recusada pela engine e 422 com detalhe', async () => {
    const { host, versao } = await salaComDois()
    const r = await acao(host, versao, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    expect(r.status).toBe(422)
    expect((await r.json()).detalhe).toBe('acao_invalida')
  })

  it('a resposta de uma rodada em curso nunca contem itens', async () => {
    const { host, versao } = await salaComDois()
    const b1 = await (await acao(host, versao, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })).json()
    const r2 = await acao(host, b1.versao, { tipo: 'iniciar_rodada', categoriaId: 'c1' })
    const texto = await r2.text()
    expect(texto).toContain('Cat c1')
    for (const n of 'ABCDEFGHIJ') expect(texto).not.toContain(`${n}c1`)
  })
})

describe('store indisponivel', () => {
  it('devolve 503 sem aplicar nada', async () => {
    deps.store = { obter: async () => { throw new Error('boom') }, gravarSe: async () => { throw new Error('boom') } }
    const r = await req('POST', '/api/salas', json({ apelido: 'Ana' }))
    expect(r.status).toBe(503)
    expect((await r.json()).erro).toBe('store_indisponivel')
  })
})

describe('rotas desconhecidas', () => {
  it('404', async () => {
    expect((await req('GET', '/api/nada')).status).toBe(404)
    expect((await req('DELETE', '/api/salas')).status).toBe(404)
  })
})
```

- [ ] **Step 3: Teste falhando do store em arquivo** — `src/servidor/store-arquivo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storeArquivo } from './store-arquivo'
import type { Sala } from './tipos'

const sala = (versao: number): Sala => ({
  codigo: 'ABCDE', hostId: 'h', jogadores: [], jogo: null, versao, criadaEm: 0, atualizadaEm: 0,
})

async function caminhoTemp() {
  return join(await mkdtemp(join(tmpdir(), 'top10-')), 'salas.json')
}

describe('storeArquivo', () => {
  it('comeca vazio quando o arquivo nao existe', async () => {
    const s = await storeArquivo(await caminhoTemp())
    expect(await s.obter('ABCDE')).toBeNull()
  })

  it('faz CAS como o store em memoria', async () => {
    const s = await storeArquivo(await caminhoTemp())
    expect(await s.gravarSe(sala(1), 0)).toBe(true)
    expect(await s.gravarSe(sala(1), 0)).toBe(false)
    expect(await s.gravarSe(sala(2), 1)).toBe(true)
    expect(await s.gravarSe(sala(3), 1)).toBe(false)
    expect((await s.obter('ABCDE'))?.versao).toBe(2)
  })

  it('persiste no disco e recarrega numa nova instancia', async () => {
    const caminho = await caminhoTemp()
    const s1 = await storeArquivo(caminho)
    await s1.gravarSe(sala(1), 0)
    await s1.gravarSe(sala(2), 1)
    await s1.aguardarGravacao()
    expect(JSON.parse(await readFile(caminho, 'utf8')).ABCDE.versao).toBe(2)
    const s2 = await storeArquivo(caminho)
    expect((await s2.obter('ABCDE'))?.versao).toBe(2)
  })

  it('arquivo corrompido nao derruba o servidor: comeca vazio', async () => {
    const caminho = await caminhoTemp()
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(join(caminho, '..'), { recursive: true })
    await writeFile(caminho, '{nao json')
    const s = await storeArquivo(caminho)
    expect(await s.obter('ABCDE')).toBeNull()
  })
})
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `npm test -- servidor`
Expected: FAIL.

- [ ] **Step 5: Implementar `src/servidor/http.ts`**

```ts
import { carregarCategorias } from '../data/carregar'
import type { Categoria, ModoDuracao } from '../engine/types'
import { codigoValido, gerarCodigo } from './codigo'
import { aplicarAcaoNaSala, autenticar, criarSala, entrarNaSala, lerSala, montarVisao } from './sala'
import type { StoreSala } from './store'
import { TTL_SALA_MS, type AcaoSala, type ErroServidor, type Geradores, type Sala } from './tipos'

export type DependenciasHttp = {
  store: StoreSala
  catalogo: Categoria[]
  agora: () => number
  geradores: Geradores
}

export function dependenciasPadrao(store: StoreSala): DependenciasHttp {
  return {
    store,
    catalogo: carregarCategorias(),
    agora: () => Date.now(),
    geradores: {
      novoId: () => crypto.randomUUID(),
      novoToken: () => crypto.randomUUID() + crypto.randomUUID(),
      novoCodigo: () => gerarCodigo(Math.random),
    },
  }
}

const MENSAGENS: Record<ErroServidor, string> = {
  corpo_invalido: 'Requisição inválida.',
  token_invalido: 'Suas credenciais não valem para esta sala.',
  nao_autorizado: 'Você não pode fazer isso agora.',
  sala_inexistente: 'Sala não encontrada ou expirada.',
  versao_desatualizada: 'A sala mudou; veja o estado atual.',
  apelido_em_uso: 'Já tem alguém com esse apelido na sala.',
  acao_rejeitada: 'A ação não vale neste momento do jogo.',
  store_indisponivel: 'Não foi possível acessar a sala. Tente de novo.',
}

const HTTP: Record<ErroServidor, number> = {
  corpo_invalido: 400,
  token_invalido: 403,
  nao_autorizado: 403,
  sala_inexistente: 404,
  versao_desatualizada: 409,
  apelido_em_uso: 409,
  acao_rejeitada: 422,
  store_indisponivel: 503,
}

function jsonResp(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

function erro(e: ErroServidor, extra: Record<string, unknown> = {}): Response {
  return jsonResp(HTTP[e], { erro: e, mensagem: MENSAGENS[e], ...extra })
}

async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json()
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function modoValido(m: unknown): m is ModoDuracao {
  if (typeof m !== 'object' || m === null) return false
  const o = m as Record<string, unknown>
  if (o.tipo === 'categorias') return Number.isInteger(o.quantidade) && (o.quantidade as number) >= 1
  if (o.tipo === 'tempo') return Number.isInteger(o.minutos) && (o.minutos as number) >= 1
  return false
}

/** Valida a forma minima da acao vinda do cliente; a engine valida o resto. */
function acaoValida(a: unknown): a is AcaoSala {
  if (typeof a !== 'object' || a === null) return false
  const o = a as Record<string, unknown>
  switch (o.tipo) {
    case 'iniciar_partida':
      return modoValido(o.modo)
    case 'entrar_na_partida':
    case 'avancar':
      return true
    case 'iniciar_rodada':
      return typeof o.categoriaId === 'string'
    case 'decidir_expiracao':
      return o.decisao === 'encerrar' || o.decisao === 'terminar_categoria'
    case 'rodada': {
      const r = o.acao as Record<string, unknown> | undefined
      if (!r) return false
      if (r.tipo === 'palpite') return typeof r.texto === 'string' && typeof r.jogadorId === 'string'
      if (r.tipo === 'duvidar') return typeof r.duvidadorId === 'string'
      return r.tipo === 'ninguem_duvidou'
    }
    default:
      return false
  }
}

async function comStore<T>(fn: () => Promise<T>): Promise<T | Response> {
  try {
    return await fn()
  } catch {
    return erro('store_indisponivel')
  }
}

async function carregarSala(deps: DependenciasHttp, codigo: string): Promise<Sala | Response> {
  if (!codigoValido(codigo)) return erro('sala_inexistente')
  const r = await comStore(() => deps.store.obter(codigo))
  if (r instanceof Response) return r
  if (r === null) return erro('sala_inexistente')
  // TTL: sala parada ha mais de 6 h e tratada como inexistente. Fica no roteador
  // para valer igual em qualquer store.
  if (deps.agora() - r.atualizadaEm > TTL_SALA_MS) return erro('sala_inexistente')
  return r
}

function credenciais(request: Request): { id: string; token: string } | null {
  const id = request.headers.get('x-jogador-id')
  const token = request.headers.get('x-jogador-token')
  return id && token ? { id, token } : null
}

async function postSalas(request: Request, deps: DependenciasHttp): Promise<Response> {
  const corpo = await lerCorpo(request)
  if (!corpo || typeof corpo.apelido !== 'string' || corpo.apelido.trim() === '') return erro('corpo_invalido')
  const agora = deps.agora()
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { sala, jogador } = criarSala(corpo.apelido, agora, deps.geradores)
    const gravou = await comStore(() => deps.store.gravarSe(sala, 0))
    if (gravou instanceof Response) return gravou
    if (gravou) {
      return jsonResp(201, {
        codigo: sala.codigo,
        jogadorId: jogador.id,
        token: jogador.token,
        versao: sala.versao,
        visao: montarVisao(sala, jogador.id, agora, deps.catalogo),
      })
    }
  }
  return erro('store_indisponivel')
}

async function postEntrar(request: Request, deps: DependenciasHttp, codigo: string): Promise<Response> {
  const corpo = await lerCorpo(request)
  if (!corpo || typeof corpo.apelido !== 'string') return erro('corpo_invalido')
  const sala = await carregarSala(deps, codigo)
  if (sala instanceof Response) return sala
  const agora = deps.agora()
  const r = entrarNaSala(sala, corpo.apelido, agora, deps.geradores)
  if (!r.ok) return erro(r.erro, r.detalhe ? { detalhe: r.detalhe } : {})
  const gravou = await comStore(() => deps.store.gravarSe(r.valor.sala, sala.versao))
  if (gravou instanceof Response) return gravou
  if (!gravou) return erro('versao_desatualizada', { versao: sala.versao, visao: null })
  return jsonResp(200, {
    jogadorId: r.valor.jogador.id,
    token: r.valor.jogador.token,
    versao: r.valor.sala.versao,
    visao: montarVisao(r.valor.sala, r.valor.jogador.id, agora, deps.catalogo),
  })
}

async function getSala(request: Request, deps: DependenciasHttp, codigo: string): Promise<Response> {
  const cred = credenciais(request)
  if (!cred) return erro('token_invalido')
  const sala = await carregarSala(deps, codigo)
  if (sala instanceof Response) return sala
  if (!autenticar(sala, cred.id, cred.token)) return erro('token_invalido')

  const agora = deps.agora()
  const { sala: nova, visao } = lerSala(sala, cred.id, agora, deps.catalogo)
  // Grava sempre (registra presenca), com CAS na versao lida. Se perder a
  // corrida, nao importa: a leitura e informativa.
  await comStore(() => deps.store.gravarSe(nova, sala.versao))

  const vista = Number(new URL(request.url).searchParams.get('versao'))
  if (Number.isInteger(vista) && vista === nova.versao) return new Response(null, { status: 204 })
  return jsonResp(200, { versao: nova.versao, visao })
}

async function postAcoes(request: Request, deps: DependenciasHttp, codigo: string): Promise<Response> {
  const cred = credenciais(request)
  if (!cred) return erro('token_invalido')
  const corpo = await lerCorpo(request)
  if (!corpo || !Number.isInteger(corpo.versao) || !acaoValida(corpo.acao)) return erro('corpo_invalido')
  const sala = await carregarSala(deps, codigo)
  if (sala instanceof Response) return sala
  if (!autenticar(sala, cred.id, cred.token)) return erro('token_invalido')

  const agora = deps.agora()
  if (corpo.versao !== sala.versao) {
    return erro('versao_desatualizada', { versao: sala.versao, visao: montarVisao(sala, cred.id, agora, deps.catalogo) })
  }
  const r = aplicarAcaoNaSala(sala, cred.id, corpo.acao, agora, deps.catalogo)
  if (!r.ok) return erro(r.erro, r.detalhe ? { detalhe: r.detalhe } : {})
  const gravou = await comStore(() => deps.store.gravarSe(r.valor.sala, sala.versao))
  if (gravou instanceof Response) return gravou
  if (!gravou) {
    const atual = await comStore(() => deps.store.obter(codigo))
    if (atual instanceof Response) return atual
    const s = atual ?? sala
    return erro('versao_desatualizada', { versao: s.versao, visao: montarVisao(s, cred.id, agora, deps.catalogo) })
  }
  return jsonResp(200, { versao: r.valor.sala.versao, visao: r.valor.visao })
}

export async function roteador(request: Request, deps: DependenciasHttp): Promise<Response> {
  const { pathname } = new URL(request.url)
  const partes = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

  if (partes[0] !== 'salas') return erro('sala_inexistente')
  if (partes.length === 1) return request.method === 'POST' ? postSalas(request, deps) : erro('sala_inexistente')

  const codigo = partes[1].toUpperCase()
  if (partes.length === 2 && request.method === 'GET') return getSala(request, deps, codigo)
  if (partes.length === 3 && request.method === 'POST') {
    if (partes[2] === 'entrar') return postEntrar(request, deps, codigo)
    if (partes[2] === 'acoes') return postAcoes(request, deps, codigo)
  }
  return erro('sala_inexistente')
}
```

- [ ] **Step 6: Implementar `src/servidor/store-arquivo.ts`**

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StoreSala } from './store'
import type { Sala } from './tipos'

/**
 * Memoria como fonte da verdade, com snapshot em disco depois de cada
 * gravacao bem-sucedida — para uma partida sobreviver a um restart do
 * processo. A escrita e atomica (arquivo temporario + rename) e serializada:
 * nunca ha duas escritas em voo, e uma gravacao que chega durante outra so
 * agenda mais uma no fim.
 */
export async function storeArquivo(caminho: string): Promise<StoreSala & { aguardarGravacao(): Promise<void> }> {
  const salas = new Map<string, Sala>()
  try {
    const bruto = JSON.parse(await readFile(caminho, 'utf8')) as Record<string, Sala>
    for (const [codigo, sala] of Object.entries(bruto)) salas.set(codigo, sala)
  } catch {
    // arquivo inexistente ou corrompido: comeca vazio
  }

  let escrevendo: Promise<void> = Promise.resolve()
  let pendente = false

  const escrever = async () => {
    await mkdir(dirname(caminho), { recursive: true })
    const temp = `${caminho}.tmp`
    await writeFile(temp, JSON.stringify(Object.fromEntries(salas)))
    await rename(temp, caminho)
  }

  const agendarEscrita = () => {
    if (pendente) return
    pendente = true
    escrevendo = escrevendo.then(async () => {
      pendente = false
      try {
        await escrever()
      } catch (e) {
        console.error('[store-arquivo] falha ao gravar snapshot:', e)
      }
    })
  }

  return {
    async obter(codigo) {
      const s = salas.get(codigo)
      return s === undefined ? null : structuredClone(s)
    },
    async gravarSe(sala, versaoEsperada) {
      const atual = salas.get(sala.codigo)
      const versaoAtual = atual === undefined ? 0 : atual.versao
      if (versaoAtual !== versaoEsperada) return false
      salas.set(sala.codigo, structuredClone(sala))
      agendarEscrita()
      return true
    },
    aguardarGravacao: () => escrevendo,
  }
}
```

- [ ] **Step 7: `src/servidor/node-web.ts` e `src/servidor/vite-plugin-api.ts`**

`node-web.ts` — o adaptador Node ↔ Web usado tanto pelo Vite quanto pelo servidor de produção:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'

export async function paraRequest(req: IncomingMessage, origem = 'http://localhost'): Promise<Request> {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const pedacos: Buffer[] = []
  for await (const p of req) pedacos.push(p as Buffer)
  const body = pedacos.length > 0 ? Buffer.concat(pedacos) : undefined
  return new Request(origem + (req.url ?? '/'), {
    method: req.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  })
}

export async function escreverResponse(res: ServerResponse, resp: Response): Promise<void> {
  res.statusCode = resp.status
  resp.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(resp.status === 204 ? undefined : await resp.text())
}
```

`vite-plugin-api.ts`:

```ts
import type { Plugin } from 'vite'
import { dependenciasPadrao, roteador } from './http'
import { escreverResponse, paraRequest } from './node-web'
import { storeMemoria } from './store'

/** Monta as rotas /api no servidor de desenvolvimento do Vite, com store em memoria. */
export function pluginApi(): Plugin {
  const deps = dependenciasPadrao(storeMemoria())
  return {
    name: 'top10-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        req.url = '/api' + (req.url ?? '')
        await escreverResponse(res, await roteador(await paraRequest(req), deps))
      })
    },
  }
}
```

Em `vite.config.ts`: `import { pluginApi } from './src/servidor/vite-plugin-api'` e `plugins: [react(), pluginApi()]`. Como `vite.config.ts` é compilado pelo `tsconfig.node.json`, acrescente `"src/servidor/**/*.ts"` ao `include` dele se o build reclamar.

- [ ] **Step 8: `servidor.ts` na raiz do repositório — o processo de produção**

```ts
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { dependenciasPadrao, roteador } from './src/servidor/http'
import { escreverResponse, paraRequest } from './src/servidor/node-web'
import { storeArquivo } from './src/servidor/store-arquivo'

const PORTA = Number(process.env.PORTA ?? 3000)
const DIST = resolve(process.env.DIST ?? 'dist')
const DADOS = resolve(process.env.DADOS ?? 'dados/salas.json')

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

const store = await storeArquivo(DADOS)
const deps = dependenciasPadrao(store)

const servidor = createServer(async (req, res) => {
  const url = req.url ?? '/'
  if (url.startsWith('/api/')) {
    await escreverResponse(res, await roteador(await paraRequest(req), deps))
    return
  }

  // Estatico com fallback SPA: qualquer caminho sem arquivo cai no index.html.
  const caminho = normalize(join(DIST, url.split('?')[0]))
  const arquivo = caminho.startsWith(DIST) && existsSync(caminho) && statSync(caminho).isFile() ? caminho : join(DIST, 'index.html')
  res.setHeader('content-type', TIPOS[extname(arquivo)] ?? 'application/octet-stream')
  if (arquivo !== join(DIST, 'index.html')) res.setHeader('cache-control', 'public, max-age=31536000, immutable')
  createReadStream(arquivo).pipe(res)
})

servidor.listen(PORTA, () => {
  console.log(`Top 10 com Blefe em http://localhost:${PORTA} (salas em ${DADOS})`)
})
```

`package.json`: `"start": "tsx servidor.ts"`. `tsconfig.json`: acrescentar `"servidor.ts"` ao `include`. `.gitignore`: `dados/`.

- [ ] **Step 9: Rodar e confirmar que passa; suíte inteira; build; smoke do servidor**

Run: `npm test && npm run build`
Expected: PASS, build limpo.

Run: `npm start` e, noutro terminal:
```bash
curl -s -X POST localhost:3000/api/salas -H 'content-type: application/json' -d '{"apelido":"Ana"}'
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/sala/ABCDE
```
Expected: JSON com `codigo`/`token`/`visao`; depois `200` (o index.html do SPA). Confira que `dados/salas.json` foi criado. Encerre o servidor.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(servidor): roteador http, servidor node com estatico, plugin de dev e store em arquivo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Cliente — credenciais, API tipada, rota e `useSala`

**Files:**
- Create: `src/ui/online/credenciais.ts`, `src/ui/online/cliente-api.ts`, `src/ui/online/useSala.ts`, `src/ui/rota.ts`
- Test: `src/ui/online/useSala.test.tsx`, `src/ui/rota.test.tsx`

**Interfaces:**
- Produces:

```ts
// credenciais.ts
export type Credenciais = { jogadorId: string; token: string }
export function lerCredenciais(codigo: string): Credenciais | null
export function salvarCredenciais(codigo: string, c: Credenciais): void
export function limparCredenciais(codigo: string): void
// cliente-api.ts
export type RespostaApi<T> = { ok: true; status: number; corpo: T } | { ok: false; status: number; erro: ErroServidor; mensagem: string; detalhe?: string; versao?: number; visao?: VisaoSala } | { ok: false; status: 0; erro: 'rede'; mensagem: string }
export function criarSalaApi(apelido: string): Promise<RespostaApi<{ codigo: string; jogadorId: string; token: string; versao: number; visao: VisaoSala }>>
export function entrarApi(codigo: string, apelido: string): Promise<RespostaApi<{ jogadorId: string; token: string; versao: number; visao: VisaoSala }>>
export function lerApi(codigo: string, c: Credenciais, versao: number | null): Promise<RespostaApi<{ versao: number; visao: VisaoSala } | null>>   // null = 204
export function agirApi(codigo: string, c: Credenciais, versao: number, acao: AcaoSala): Promise<RespostaApi<{ versao: number; visao: VisaoSala }>>
// useSala.ts
export type EstadoConexao = 'carregando' | 'ok' | 'reconectando' | 'sem_credenciais' | 'sala_inexistente' | 'token_invalido'
export function useSala(codigo: string): {
  visao: VisaoSala | null; versao: number | null; conexao: EstadoConexao
  erro: { mensagem: string; detalhe?: string } | null
  entrar(apelido: string): Promise<void>
  agir(acao: AcaoSala): Promise<void>
}
// rota.ts
export type Rota = { nome: 'mesa' } | { nome: 'online' } | { nome: 'sala'; codigo: string }
export function rotaDe(pathname: string): Rota
export function useRota(): Rota
export function navegar(caminho: string): void
```

Comportamento de `useSala`: ao montar, lê credenciais; sem elas → `sem_credenciais` e não faz poll. Com elas → `GET` imediato, depois a cada 1000 ms; em falha de rede/503, `reconectando` e intervalo dobra até 5000 ms; volta a 1000 ms no sucesso. Pausa quando `document.hidden`, retoma no `visibilitychange`. `agir` faz `POST`; em 409 adota a `visao` devolvida; em 422 define `erro` com `mensagem`/`detalhe`; sucesso limpa `erro`. 404 → `sala_inexistente` e para o poll. 403 `token_invalido` → limpa credenciais, `token_invalido`, para o poll.

- [ ] **Step 1: Testes falhando**

`src/ui/rota.test.tsx`:

```ts
import { describe, it, expect } from 'vitest'
import { rotaDe } from './rota'

describe('rotaDe', () => {
  it.each([
    ['/', { nome: 'mesa' }],
    ['/online', { nome: 'online' }],
    ['/online/', { nome: 'online' }],
    ['/sala/ABCDE', { nome: 'sala', codigo: 'ABCDE' }],
    ['/sala/abcde', { nome: 'sala', codigo: 'ABCDE' }],
    ['/qualquer', { nome: 'mesa' }],
  ])('%s → %o', (p, r) => expect(rotaDe(p)).toEqual(r))
})
```

`src/ui/online/useSala.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSala } from './useSala'
import { salvarCredenciais, lerCredenciais } from './credenciais'
import type { VisaoSala } from '../../servidor/tipos'

const visao = (versao: number): VisaoSala => ({
  codigo: 'ABCDE', hostId: 'h', jogadorId: 'h', ehHost: true,
  jogadores: [{ id: 'h', apelido: 'Ana' }], jogo: null, ...({ versao } as object),
})

function resposta(status: number, corpo?: unknown) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useSala', () => {
  it('sem credenciais nao faz poll', () => {
    const { result } = renderHook(() => useSala('ABCDE'))
    expect(result.current.conexao).toBe('sem_credenciais')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('entrar salva credenciais e comeca a fazer poll', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { jogadorId: 'j', token: 't', versao: 2, visao: visao(2) }))
      .mockResolvedValue(resposta(204))
    const { result } = renderHook(() => useSala('ABCDE'))
    await act(() => result.current.entrar('Bruno'))
    expect(lerCredenciais('ABCDE')).toEqual({ jogadorId: 'j', token: 't' })
    expect(result.current.versao).toBe(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(String(url)).toContain('/api/salas/ABCDE?versao=2')
    expect((init as RequestInit).headers).toMatchObject({ 'X-Jogador-Id': 'j', 'X-Jogador-Token': 't' })
  })

  it('204 mantem a visao; 200 substitui', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockResolvedValueOnce(resposta(200, { versao: 1, visao: visao(1) }))
      .mockResolvedValueOnce(resposta(204))
      .mockResolvedValueOnce(resposta(200, { versao: 3, visao: visao(3) }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.versao).toBe(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.versao).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.versao).toBe(3)
    expect(result.current.conexao).toBe('ok')
  })

  it('falha de rede vira reconectando com backoff, e volta ao normal', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockRejectedValueOnce(new Error('rede'))
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(resposta(200, { versao: 1, visao: visao(1) }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.conexao).toBe('reconectando'))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(result.current.conexao).toBe('ok')
  })

  it('404 para o poll e marca sala inexistente', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock.mockResolvedValue(resposta(404, { erro: 'sala_inexistente', mensagem: 'x' }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.conexao).toBe('sala_inexistente'))
    const n = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(fetchMock.mock.calls.length).toBe(n)
  })

  it('403 limpa credenciais', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock.mockResolvedValue(resposta(403, { erro: 'token_invalido', mensagem: 'x' }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.conexao).toBe('token_invalido'))
    expect(lerCredenciais('ABCDE')).toBeNull()
  })

  it('agir com 409 adota a visao devolvida; 422 expoe o erro; sucesso limpa', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock
      .mockResolvedValueOnce(resposta(200, { versao: 1, visao: visao(1) }))
      .mockResolvedValueOnce(resposta(409, { erro: 'versao_desatualizada', mensagem: 'x', versao: 2, visao: visao(2) }))
      .mockResolvedValueOnce(resposta(422, { erro: 'acao_rejeitada', mensagem: 'Ação inválida', detalhe: 'palpite_vazio' }))
      .mockResolvedValueOnce(resposta(200, { versao: 3, visao: visao(3) }))
    const { result } = renderHook(() => useSala('ABCDE'))
    await waitFor(() => expect(result.current.versao).toBe(1))
    await act(() => result.current.agir({ tipo: 'avancar' }))
    expect(result.current.versao).toBe(2)
    await act(() => result.current.agir({ tipo: 'avancar' }))
    expect(result.current.erro).toEqual({ mensagem: 'Ação inválida', detalhe: 'palpite_vazio' })
    await act(() => result.current.agir({ tipo: 'avancar' }))
    expect(result.current.erro).toBeNull()
    expect(result.current.versao).toBe(3)
  })

  it('pausa o poll com a aba oculta e retoma ao voltar', async () => {
    salvarCredenciais('ABCDE', { jogadorId: 'j', token: 't' })
    fetchMock.mockResolvedValue(resposta(204))
    renderHook(() => useSala('ABCDE'))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const antes = fetchMock.mock.calls.length
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(fetchMock.mock.calls.length).toBe(antes)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(fetchMock.mock.calls.length).toBeGreaterThan(antes)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- ui/online ui/rota`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/ui/rota.ts`:

```ts
import { useEffect, useState } from 'react'
import { codigoValido } from '../servidor/codigo'

export type Rota = { nome: 'mesa' } | { nome: 'online' } | { nome: 'sala'; codigo: string }

export function rotaDe(pathname: string): Rota {
  const partes = pathname.split('/').filter(Boolean)
  if (partes[0] === 'online') return { nome: 'online' }
  if (partes[0] === 'sala' && partes[1]) {
    const codigo = partes[1].toUpperCase()
    if (codigoValido(codigo)) return { nome: 'sala', codigo }
  }
  return { nome: 'mesa' }
}

export function navegar(caminho: string): void {
  window.history.pushState(null, '', caminho)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => rotaDe(window.location.pathname))
  useEffect(() => {
    const ao = () => setRota(rotaDe(window.location.pathname))
    window.addEventListener('popstate', ao)
    return () => window.removeEventListener('popstate', ao)
  }, [])
  return rota
}
```

`src/ui/online/credenciais.ts`:

```ts
export type Credenciais = { jogadorId: string; token: string }

const chave = (codigo: string) => `top10:sala:${codigo}`

export function lerCredenciais(codigo: string): Credenciais | null {
  try {
    const bruto = localStorage.getItem(chave(codigo))
    if (!bruto) return null
    const v = JSON.parse(bruto) as Partial<Credenciais>
    return typeof v.jogadorId === 'string' && typeof v.token === 'string' ? { jogadorId: v.jogadorId, token: v.token } : null
  } catch {
    return null
  }
}

export function salvarCredenciais(codigo: string, c: Credenciais): void {
  try {
    localStorage.setItem(chave(codigo), JSON.stringify(c))
  } catch {
    // sem storage: a sessao dura ate recarregar a pagina
  }
}

export function limparCredenciais(codigo: string): void {
  try {
    localStorage.removeItem(chave(codigo))
  } catch {
    // nada a fazer
  }
}
```

`src/ui/online/cliente-api.ts`:

```ts
import type { AcaoSala, ErroServidor, VisaoSala } from '../../servidor/tipos'
import type { Credenciais } from './credenciais'

export type RespostaApi<T> =
  | { ok: true; status: number; corpo: T }
  | { ok: false; status: number; erro: ErroServidor; mensagem: string; detalhe?: string; versao?: number; visao?: VisaoSala }
  | { ok: false; status: 0; erro: 'rede'; mensagem: string }

async function chamar<T>(url: string, init: RequestInit, semCorpo = false): Promise<RespostaApi<T | null>> {
  let resp: Response
  try {
    resp = await fetch(url, init)
  } catch {
    return { ok: false, status: 0, erro: 'rede', mensagem: 'Sem conexão.' }
  }
  if (resp.status === 204 && semCorpo) return { ok: true, status: 204, corpo: null }
  let corpo: Record<string, unknown> = {}
  try {
    corpo = (await resp.json()) as Record<string, unknown>
  } catch {
    // corpo vazio ou nao-JSON
  }
  if (resp.ok) return { ok: true, status: resp.status, corpo: corpo as T }
  return {
    ok: false,
    status: resp.status,
    erro: (corpo.erro as ErroServidor) ?? 'store_indisponivel',
    mensagem: (corpo.mensagem as string) ?? 'Erro inesperado.',
    detalhe: corpo.detalhe as string | undefined,
    versao: corpo.versao as number | undefined,
    visao: corpo.visao as VisaoSala | undefined,
  }
}

const json = (corpo: unknown, extra: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...extra },
  body: JSON.stringify(corpo),
})
const auth = (c: Credenciais) => ({ 'X-Jogador-Id': c.jogadorId, 'X-Jogador-Token': c.token })

export type CorpoEntrada = { jogadorId: string; token: string; versao: number; visao: VisaoSala }
export type CorpoLeitura = { versao: number; visao: VisaoSala }

export function criarSalaApi(apelido: string) {
  return chamar<CorpoEntrada & { codigo: string }>('/api/salas', json({ apelido })) as Promise<RespostaApi<CorpoEntrada & { codigo: string }>>
}
export function entrarApi(codigo: string, apelido: string) {
  return chamar<CorpoEntrada>(`/api/salas/${codigo}/entrar`, json({ apelido })) as Promise<RespostaApi<CorpoEntrada>>
}
export function lerApi(codigo: string, c: Credenciais, versao: number | null) {
  const q = versao === null ? '' : `?versao=${versao}`
  return chamar<CorpoLeitura>(`/api/salas/${codigo}${q}`, { method: 'GET', headers: auth(c) }, true)
}
export function agirApi(codigo: string, c: Credenciais, versao: number, acao: AcaoSala) {
  return chamar<CorpoLeitura>(`/api/salas/${codigo}/acoes`, json({ versao, acao }, auth(c))) as Promise<RespostaApi<CorpoLeitura>>
}
```

`src/ui/online/useSala.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e confirmar que passa; suíte inteira**

Run: `npm test`
Expected: PASS, sem `act()` warnings.

- [ ] **Step 5: Commit**

```bash
git add src/ui/online src/ui/rota.ts src/ui/rota.test.tsx
git commit -m "feat(cliente): credenciais, api tipada, rota e hook de sala com polling

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Telas de entrada e lobby

**Files:**
- Create: `src/ui/online/TelaEntrada.tsx`, `src/ui/online/TelaLobby.tsx`
- Modify: `package.json` (dep `qrcode`, `@types/qrcode`), `src/ui/estilos.css` (classes `.codigo-sala`, `.qr`, `.entrada-online`)
- Test: `src/ui/online/TelaEntrada.test.tsx`, `src/ui/online/TelaLobby.test.tsx`

**Interfaces:**
- Produces:

```ts
export function TelaEntrada({ aoCriar, aoEntrar, erro }: {
  aoCriar: (apelido: string) => void
  aoEntrar: (codigo: string, apelido: string) => void
  erro: string | null
})
export function TelaLobby({ visao, urlSala, aoIniciar, aoEntrarNaPartida }: {
  visao: VisaoSala
  urlSala: string
  aoIniciar: (modo: ModoDuracao) => void
  aoEntrarNaPartida: () => void
})
```

`TelaLobby` mostra o código em destaque, um `<canvas aria-label="QR code do link da sala">` com o QR de `urlSala`, a lista de apelidos, e — só quando `visao.ehHost` — a escolha de modo (mesmos controles da `TelaSetup`: rádios "Por categorias"/"Por tempo", inputs "Quantidade de categorias"/"Minutos de partida") e o botão "Começar partida", desabilitado com menos de 2 jogadores ou valor inválido (mesma regra da `TelaSetup`). Quando `visao.jogo !== null` (partida já rolando) e o jogador não está em `visao.jogo.jogadores`, mostra "A partida já começou" e um botão "Entrar na próxima rodada" que chama `aoEntrarNaPartida`.

- [ ] **Step 1: Instalar `qrcode`**

```bash
npm install qrcode && npm install -D @types/qrcode
```

- [ ] **Step 2: Testes falhando**

`src/ui/online/TelaEntrada.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelaEntrada } from './TelaEntrada'

describe('TelaEntrada', () => {
  it('cria sala com apelido', async () => {
    const aoCriar = vi.fn()
    render(<TelaEntrada aoCriar={aoCriar} aoEntrar={vi.fn()} erro={null} />)
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu apelido'), 'Ana')
    await u.click(screen.getByRole('button', { name: 'Criar sala' }))
    expect(aoCriar).toHaveBeenCalledWith('Ana')
  })

  it('entra com codigo em maiusculas', async () => {
    const aoEntrar = vi.fn()
    render(<TelaEntrada aoCriar={vi.fn()} aoEntrar={aoEntrar} erro={null} />)
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu apelido'), 'Bruno')
    await u.type(screen.getByLabelText('Código da sala'), 'kjqtm')
    await u.click(screen.getByRole('button', { name: 'Entrar na sala' }))
    expect(aoEntrar).toHaveBeenCalledWith('KJQTM', 'Bruno')
  })

  it('botoes desabilitados sem apelido; entrar desabilitado sem codigo valido', async () => {
    render(<TelaEntrada aoCriar={vi.fn()} aoEntrar={vi.fn()} erro={null} />)
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Entrar na sala' })).toBeDisabled()
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu apelido'), 'Ana')
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeEnabled()
    await u.type(screen.getByLabelText('Código da sala'), 'ABC')
    expect(screen.getByRole('button', { name: 'Entrar na sala' })).toBeDisabled()
  })

  it('mostra erro', () => {
    render(<TelaEntrada aoCriar={vi.fn()} aoEntrar={vi.fn()} erro="Sala não encontrada" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sala não encontrada')
  })
})
```

`src/ui/online/TelaLobby.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelaLobby } from './TelaLobby'
import type { VisaoSala } from '../../servidor/tipos'

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }))

const base: VisaoSala = {
  codigo: 'KJQTM', hostId: 'h', jogadorId: 'h', ehHost: true,
  jogadores: [{ id: 'h', apelido: 'Ana' }, { id: 'b', apelido: 'Bruno' }], jogo: null,
}

describe('TelaLobby', () => {
  it('mostra codigo, QR e jogadores', () => {
    render(<TelaLobby visao={base} urlSala="http://x/sala/KJQTM" aoIniciar={vi.fn()} aoEntrarNaPartida={vi.fn()} />)
    expect(screen.getByText('KJQTM')).toBeInTheDocument()
    expect(screen.getByLabelText('QR code do link da sala')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('host escolhe o modo e inicia', async () => {
    const aoIniciar = vi.fn()
    render(<TelaLobby visao={base} urlSala="u" aoIniciar={aoIniciar} aoEntrarNaPartida={vi.fn()} />)
    const u = userEvent.setup()
    await u.click(screen.getByRole('radio', { name: 'Por tempo' }))
    await u.clear(screen.getByLabelText('Minutos de partida'))
    await u.type(screen.getByLabelText('Minutos de partida'), '20')
    await u.click(screen.getByRole('button', { name: 'Começar partida' }))
    expect(aoIniciar).toHaveBeenCalledWith({ tipo: 'tempo', minutos: 20 })
  })

  it('host com um jogador so nao pode iniciar', () => {
    render(<TelaLobby visao={{ ...base, jogadores: [base.jogadores[0]] }} urlSala="u" aoIniciar={vi.fn()} aoEntrarNaPartida={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled()
  })

  it('nao host ve espera, sem controles', () => {
    render(<TelaLobby visao={{ ...base, jogadorId: 'b', ehHost: false }} urlSala="u" aoIniciar={vi.fn()} aoEntrarNaPartida={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument()
    expect(screen.getByText(/aguardando/i)).toBeInTheDocument()
  })

  it('quem chega com a partida rolando pode entrar na proxima rodada', async () => {
    const aoEntrarNaPartida = vi.fn()
    const jogo = { jogadorId: 'c', fase: 'em_rodada', jogadores: [{ id: 'h', nome: 'Ana' }, { id: 'b', nome: 'Bruno' }], placar: {}, relogio: { modo: { tipo: 'categorias', quantidade: 3 }, iniciadoEm: null, pausadoEm: null, msPausados: 0, expirado: false }, rodada: null, concluidas: [], encerrarAposRodada: false, categoriasDisponiveis: [], podeAgir: { palpite: false, duvidar: false, host: false } } as const
    render(<TelaLobby visao={{ ...base, jogadorId: 'c', ehHost: false, jogo }} urlSala="u" aoIniciar={vi.fn()} aoEntrarNaPartida={aoEntrarNaPartida} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar na próxima rodada' }))
    expect(aoEntrarNaPartida).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- online/Tela`
Expected: FAIL.

- [ ] **Step 4: Implementar `TelaEntrada.tsx`**

```tsx
import { useState } from 'react'
import { codigoValido } from '../../servidor/codigo'

type Props = {
  aoCriar: (apelido: string) => void
  aoEntrar: (codigo: string, apelido: string) => void
  erro: string | null
}

export function TelaEntrada({ aoCriar, aoEntrar, erro }: Props) {
  const [apelido, setApelido] = useState('')
  const [codigo, setCodigo] = useState('')
  const apelidoOk = apelido.trim() !== ''
  const codigoNorm = codigo.trim().toUpperCase()

  return (
    <section className="tela entrada-online">
      <h1>Top 10 com Blefe — online</h1>

      <div className="linha">
        <label htmlFor="apelido">Seu apelido</label>
        <input id="apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} autoComplete="nickname" />
      </div>

      {erro && <p role="alert" className="aviso">{erro}</p>}

      <h2>Criar uma sala nova</h2>
      <button type="button" className="principal" disabled={!apelidoOk} onClick={() => aoCriar(apelido.trim())}>
        Criar sala
      </button>

      <h2>Ou entrar numa sala</h2>
      <div className="linha">
        <label htmlFor="codigo">Código da sala</label>
        <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={5} autoCapitalize="characters" />
        <button
          type="button"
          disabled={!apelidoOk || !codigoValido(codigoNorm)}
          onClick={() => aoEntrar(codigoNorm, apelido.trim())}
        >
          Entrar na sala
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Implementar `TelaLobby.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { ModoDuracao } from '../../engine/types'
import type { VisaoSala } from '../../servidor/tipos'

type Props = {
  visao: VisaoSala
  urlSala: string
  aoIniciar: (modo: ModoDuracao) => void
  aoEntrarNaPartida: () => void
}

export function TelaLobby({ visao, urlSala, aoIniciar, aoEntrarNaPartida }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tipoModo, setTipoModo] = useState<'categorias' | 'tempo'>('categorias')
  const [quantidade, setQuantidade] = useState(3)
  const [minutos, setMinutos] = useState(30)

  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, urlSala, { width: 220 })
  }, [urlSala])

  const partidaRolando = visao.jogo !== null && visao.jogo.fase !== 'fim_jogo'
  const estouNaPartida = visao.jogo?.jogadores.some((j) => j.id === visao.jogadorId) ?? false

  const duracaoValida =
    tipoModo === 'categorias' ? Number.isInteger(quantidade) && quantidade >= 1 : Number.isInteger(minutos) && minutos >= 1
  const podeIniciar = visao.jogadores.length >= 2 && duracaoValida

  return (
    <section className="tela">
      <h1>Sala</h1>
      <p className="codigo-sala">{visao.codigo}</p>
      <canvas ref={canvas} className="qr" aria-label="QR code do link da sala" />
      <p className="fonte">{urlSala}</p>

      <h2>Quem está na sala</h2>
      <ul className="lista-jogadores">
        {visao.jogadores.map((j) => (
          <li key={j.id}>
            <span>{j.apelido}</span>
            {j.id === visao.hostId && <span className="fonte"> (anfitrião)</span>}
          </li>
        ))}
      </ul>

      {partidaRolando && !estouNaPartida && (
        <>
          <p className="aviso">A partida já começou. Você entra na próxima rodada.</p>
          <button type="button" className="principal" onClick={aoEntrarNaPartida}>
            Entrar na próxima rodada
          </button>
        </>
      )}

      {!partidaRolando && visao.ehHost && (
        <>
          <h2>Duração da partida</h2>
          <fieldset>
            <label>
              <input type="radio" name="modo" checked={tipoModo === 'categorias'} onChange={() => setTipoModo('categorias')} />
              Por categorias
            </label>
            <label>
              <input type="radio" name="modo" checked={tipoModo === 'tempo'} onChange={() => setTipoModo('tempo')} />
              Por tempo
            </label>
          </fieldset>
          {tipoModo === 'categorias' ? (
            <div className="linha">
              <label htmlFor="quantidade">Quantidade de categorias</label>
              <input id="quantidade" type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
            </div>
          ) : (
            <div className="linha">
              <label htmlFor="minutos">Minutos de partida</label>
              <input id="minutos" type="number" min={1} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
            </div>
          )}
          <button
            type="button"
            className="principal"
            disabled={!podeIniciar}
            onClick={() => aoIniciar(tipoModo === 'categorias' ? { tipo: 'categorias', quantidade } : { tipo: 'tempo', minutos })}
          >
            Começar partida
          </button>
        </>
      )}

      {!partidaRolando && !visao.ehHost && <p>Aguardando o anfitrião começar a partida…</p>}
    </section>
  )
}
```

Em `estilos.css`, acrescentar:

```css
.codigo-sala {
  font-size: 4rem;
  letter-spacing: 0.3em;
  font-weight: 700;
  text-align: center;
  margin: 0.5rem 0;
}
.qr {
  display: block;
  margin: 0 auto 1rem;
  background: #fff;
  padding: 0.5rem;
  border-radius: 0.5rem;
}
```

- [ ] **Step 6: Rodar e confirmar que passa; suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cliente): telas de entrada e lobby com QR code

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: `perspectiva` nas telas do jogo, `TelaSala` e `Raiz`

**Files:**
- Modify: `src/ui/TelaRodada.tsx`, `src/ui/TelaRevelacao.tsx`, `src/ui/TelaFimJogo.tsx`, `src/ui/ModalTempo.tsx`, `src/ui/Relogio.tsx`, `src/ui/App.tsx`, `src/main.tsx`
- Create: `src/ui/online/TelaSala.tsx`, `src/ui/Raiz.tsx`
- Test: `src/ui/TelaRodada.test.tsx` (novos casos), `src/ui/online/TelaSala.test.tsx`

**Interfaces:**
- Produces:

```ts
export type Perspectiva = 'mesa' | { jogadorId: string; podeAgir: PodeAgir }
// TelaRodada
type Props = {
  estado: EstadoVisivel
  categorias: { id: string; titulo: string }[]
  erro: ErroRodada | 'acao_invalida' | null
  perspectiva: Perspectiva
  aoEscolherCategoria: (categoriaId: string) => void
  aoAgir: (acao: AcaoRodada) => void
}
// TelaRevelacao / TelaFimJogo: estado: EstadoVisivel; perspectiva: Perspectiva
// ModalTempo: + perspectiva (nao host ve "O anfitrião está decidindo…" sem botoes)
// Relogio: estado: EstadoVisivel
export function TelaSala({ codigo }: { codigo: string })
export function Raiz()
```

Regras da `perspectiva` em `TelaRodada`:
- `'mesa'`: comportamento atual (campo para quem é a vez; botão de dúvida por jogador vivo; "Ninguém duvidou").
- Jogador: campo de palpite só se `podeAgir.palpite` (com o texto "Sua vez" ou, na janela, "Você pode dar o próximo palpite"); um único botão **"Duvido"** se `podeAgir.duvidar`; **sem** "Ninguém duvidou"; escolha de categoria só se `podeAgir.host`; caso contrário, a mesa e o texto "Vez de X".
- `aoAgir` recebe `{ tipo: 'palpite', texto, jogadorId }` com o id da perspectiva (ou `vezDe` na mesa) e `{ tipo: 'duvidar', duvidadorId }` com o id da perspectiva.

`TelaRevelacao`: botão "Continuar" só para `'mesa'` ou `podeAgir.host`; os demais veem "Aguardando o anfitrião…".
`TelaFimJogo`: "Nova partida" só para `'mesa'`; online mostra "Voltar ao início" que navega para `/online`.

- [ ] **Step 1: Testes falhando**

Acrescentar a `src/ui/TelaRodada.test.tsx` (adaptando a fábrica existente para passar `categorias` e `perspectiva="mesa"` nos testes atuais, que devem continuar passando):

```tsx
describe('TelaRodada — perspectiva de jogador', () => {
  const p = (jogadorId: string, podeAgir: Partial<{ palpite: boolean; duvidar: boolean; host: boolean }>) =>
    ({ jogadorId, podeAgir: { palpite: false, duvidar: false, host: false, ...podeAgir } }) as const

  it('quem e a vez ve o campo; quem nao e, so a mesa', () => {
    const estado = estadoEmRodada()
    const { rerender } = render(
      <TelaRodada estado={estado} categorias={[]} erro={null} perspectiva={p('a', { palpite: true })} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.getByLabelText('Seu palpite')).toBeInTheDocument()
    rerender(
      <TelaRodada estado={estado} categorias={[]} erro={null} perspectiva={p('b', {})} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.queryByLabelText('Seu palpite')).not.toBeInTheDocument()
    expect(screen.getByText(/Vez de Ana/)).toBeInTheDocument()
  })

  it('palpite leva o jogadorId da perspectiva', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoEmRodada()} categorias={[]} erro={null} perspectiva={p('a', { palpite: true })} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Seu palpite'), 'Item 3')
    await u.click(screen.getByRole('button', { name: 'Dar palpite' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'palpite', texto: 'Item 3', jogadorId: 'a' })
  })

  it('na janela, um unico botao Duvido para quem pode, e nunca "Ninguem duvidou"', async () => {
    const aoAgir = vi.fn()
    render(
      <TelaRodada estado={estadoComPalpite()} categorias={[]} erro={null} perspectiva={p('b', { duvidar: true, palpite: true })} aoEscolherCategoria={vi.fn()} aoAgir={aoAgir} />,
    )
    expect(screen.queryByRole('button', { name: 'Ninguém duvidou' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bruno duvida/ })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Duvido' }))
    expect(aoAgir).toHaveBeenCalledWith({ tipo: 'duvidar', duvidadorId: 'b' })
    expect(screen.getByLabelText('Seu palpite')).toBeInTheDocument()
  })

  it('autor do palpite nao ve Duvido', () => {
    render(
      <TelaRodada estado={estadoComPalpite()} categorias={[]} erro={null} perspectiva={p('a', {})} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: 'Duvido' })).not.toBeInTheDocument()
  })

  it('escolha de categoria so para host', () => {
    const estado = estadoConfigurado()
    const cats = [{ id: 'c1', titulo: 'Categoria de teste' }]
    const { rerender } = render(
      <TelaRodada estado={estado} categorias={cats} erro={null} perspectiva={p('a', { host: true })} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Categoria de teste' })).toBeInTheDocument()
    rerender(
      <TelaRodada estado={estado} categorias={[]} erro={null} perspectiva={p('b', {})} aoEscolherCategoria={vi.fn()} aoAgir={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: 'Categoria de teste' })).not.toBeInTheDocument()
    expect(screen.getByText(/anfitrião/i)).toBeInTheDocument()
  })
})
```

`src/ui/online/TelaSala.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TelaSala } from './TelaSala'
import { salvarCredenciais } from './credenciais'
import type { VisaoSala } from '../../servidor/tipos'

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }))

const resposta = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn().mockResolvedValue(resposta(204))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const lobby: VisaoSala = {
  codigo: 'KJQTM', hostId: 'h', jogadorId: 'b', ehHost: false,
  jogadores: [{ id: 'h', apelido: 'Ana' }, { id: 'b', apelido: 'Bruno' }], jogo: null,
}

describe('TelaSala', () => {
  it('sem credenciais pede apelido', () => {
    render(<TelaSala codigo="KJQTM" />)
    expect(screen.getByLabelText('Seu apelido')).toBeInTheDocument()
  })

  it('com credenciais mostra o lobby', async () => {
    salvarCredenciais('KJQTM', { jogadorId: 'b', token: 't' })
    fetchMock.mockResolvedValueOnce(resposta(200, { versao: 1, visao: lobby }))
    render(<TelaSala codigo="KJQTM" />)
    await waitFor(() => expect(screen.getByText('KJQTM')).toBeInTheDocument())
    expect(screen.getByText(/aguardando/i)).toBeInTheDocument()
  })

  it('sala inexistente mostra aviso', async () => {
    salvarCredenciais('KJQTM', { jogadorId: 'b', token: 't' })
    fetchMock.mockResolvedValue(resposta(404, { erro: 'sala_inexistente', mensagem: 'Sala não encontrada ou expirada.' }))
    render(<TelaSala codigo="KJQTM" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não encontrada/))
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- TelaRodada TelaSala`
Expected: FAIL.

- [ ] **Step 3: Implementar `TelaRodada.tsx`** (substituir o arquivo)

```tsx
import { useState } from 'react'
import type { AcaoRodada, ErroRodada, EstadoVisivel, PodeAgir } from '../engine/types'

export type Perspectiva = 'mesa' | { jogadorId: string; podeAgir: PodeAgir }

type Props = {
  estado: EstadoVisivel
  categorias: { id: string; titulo: string }[]
  erro: ErroRodada | 'acao_invalida' | null
  perspectiva: Perspectiva
  aoEscolherCategoria: (categoriaId: string) => void
  aoAgir: (acao: AcaoRodada) => void
}

const MENSAGENS: Record<ErroRodada | 'acao_invalida', string> = {
  palpite_vazio: 'Escreva alguma coisa antes de enviar.',
  palpite_duplicado: 'Esse palpite já foi dito nesta rodada. Tente outro.',
  fase_invalida: 'Ação fora de hora.',
  duvidador_invalido: 'Esse jogador não pode duvidar agora.',
  jogador_invalido: 'Não é a sua vez.',
  acao_invalida: 'Ação inválida.',
}

export function TelaRodada({ estado, categorias, erro, perspectiva, aoEscolherCategoria, aoAgir }: Props) {
  const [texto, setTexto] = useState('')
  const rodada = estado.rodada
  const nomeDe = (id: string) => estado.jogadores.find((j) => j.id === id)?.nome ?? id
  const mesa = perspectiva === 'mesa'
  const eu = mesa ? null : perspectiva

  if (rodada === null) {
    if (mesa || eu!.podeAgir.host) {
      return (
        <section className="tela">
          <h2>Escolha a categoria</h2>
          <div className="grade-categorias">
            {categorias.map((c) => (
              <button key={c.id} type="button" onClick={() => aoEscolherCategoria(c.id)}>
                {c.titulo}
              </button>
            ))}
          </div>
        </section>
      )
    }
    return (
      <section className="tela">
        <p>O anfitrião está escolhendo a categoria…</p>
      </section>
    )
  }

  const ultimo = rodada.palpites[rodada.palpites.length - 1]
  const mostraCampo = mesa ? rodada.fase === 'palpite' : eu!.podeAgir.palpite
  const autorDoCampo = mesa ? rodada.vezDe : eu!.jogadorId

  const enviarPalpite = () => {
    aoAgir({ tipo: 'palpite', texto, jogadorId: autorDoCampo })
    setTexto('')
  }

  return (
    <section className="tela">
      <h2>{rodada.categoria.titulo}</h2>

      <ul className="painel-jogadores">
        {rodada.ordem.map((id) => (
          <li key={id} className={rodada.vivos.includes(id) ? 'jogador-vivo' : 'jogador-eliminado'}>
            {nomeDe(id)}
            {eu && id === eu.jogadorId && ' (você)'}
          </li>
        ))}
      </ul>

      {rodada.ultimoEvento && (
        <p className="aviso">
          {rodada.ultimoEvento.tipo === 'eliminado_por_duvida_certa'
            ? `${nomeDe(rodada.ultimoEvento.duvidadorId)} acertou: "${rodada.ultimoEvento.palpite}" não está na lista. ${nomeDe(rodada.ultimoEvento.eliminadoId)} está fora.`
            : `"${rodada.ultimoEvento.palpite}" está na lista! ${nomeDe(rodada.ultimoEvento.eliminadoId)} duvidou errado e está fora.`}
        </p>
      )}

      {erro && <p role="alert" className="aviso">{MENSAGENS[erro]}</p>}

      {rodada.fase === 'janela_duvida' && ultimo && (
        <p>
          {nomeDe(ultimo.autorId)} disse: <strong>{ultimo.texto}</strong>
        </p>
      )}

      {!mostraCampo && rodada.fase === 'palpite' && <p>Vez de {nomeDe(rodada.vezDe)}</p>}

      {mostraCampo && (
        <div className="linha">
          <p>{mesa ? `Vez de ${nomeDe(rodada.vezDe)}` : rodada.fase === 'palpite' ? 'Sua vez' : 'Você pode dar o próximo palpite'}</p>
          <label htmlFor="palpite">Seu palpite</label>
          <input
            id="palpite"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviarPalpite()
            }}
          />
          <button type="button" className="principal" onClick={enviarPalpite}>
            Dar palpite
          </button>
        </div>
      )}

      {rodada.fase === 'janela_duvida' && ultimo && mesa && (
        <div className="janela-duvida">
          <div className="grade-categorias">
            {rodada.vivos
              .filter((id) => id !== ultimo.autorId)
              .map((id) => (
                <button key={id} type="button" onClick={() => aoAgir({ tipo: 'duvidar', duvidadorId: id })}>
                  {nomeDe(id)} duvida
                </button>
              ))}
          </div>
          <button type="button" className="principal" onClick={() => aoAgir({ tipo: 'ninguem_duvidou' })}>
            Ninguém duvidou
          </button>
        </div>
      )}

      {rodada.fase === 'janela_duvida' && eu && eu.podeAgir.duvidar && (
        <div className="janela-duvida">
          <button type="button" className="principal" onClick={() => aoAgir({ tipo: 'duvidar', duvidadorId: eu.jogadorId })}>
            Duvido
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Ajustar `TelaRevelacao`, `TelaFimJogo`, `ModalTempo`, `Relogio`**

- Trocar `estado: EstadoJogo` por `estado: EstadoVisivel` em `TelaRevelacao`, `TelaFimJogo`, `Relogio`. Em `TelaRevelacao` e `TelaFimJogo`, itens vêm de `categoria.itens ?? []`.
- `TelaRevelacao` ganha `perspectiva: Perspectiva`; o botão "Continuar" renderiza só se `perspectiva === 'mesa' || perspectiva.podeAgir.host`; senão `<p>Aguardando o anfitrião…</p>`.
- `TelaFimJogo` ganha `perspectiva`; o botão passa a ter o texto vindo de uma prop `rotuloReiniciar: string` (mesa: "Nova partida"; online: "Voltar ao início").
- `ModalTempo` ganha `perspectiva`; se não é mesa nem host, renderiza o `role="dialog"` com o título e `<p>O anfitrião está decidindo…</p>`, sem botões.
- `App.tsx` passa `perspectiva="mesa"`, `categorias={categoriasDisponiveis(estado).map(c => ({ id: c.id, titulo: c.titulo }))}` e `rotuloReiniciar="Nova partida"`. Importar `categoriasDisponiveis` de `../engine/jogo` em `App.tsx`.
- Atualizar os testes existentes de `TelaRevelacao`, `TelaFimJogo` e `ModalTempo` apenas para passar `perspectiva="mesa"` (e `rotuloReiniciar`).

- [ ] **Step 5: Implementar `src/ui/online/TelaSala.tsx`**

```tsx
import { navegar } from '../rota'
import { ModalTempo } from '../ModalTempo'
import { Relogio } from '../Relogio'
import { TelaFimJogo } from '../TelaFimJogo'
import { TelaRevelacao } from '../TelaRevelacao'
import { TelaRodada, type Perspectiva } from '../TelaRodada'
import { TelaEntrada } from './TelaEntrada'
import { TelaLobby } from './TelaLobby'
import { useSala } from './useSala'
import type { ErroRodada } from '../../engine/types'

export function TelaSala({ codigo }: { codigo: string }) {
  const { visao, conexao, erro, entrar, agir } = useSala(codigo)

  if (conexao === 'sem_credenciais' || conexao === 'token_invalido') {
    return (
      <TelaEntrada
        aoCriar={() => navegar('/online')}
        aoEntrar={(_c, apelido) => void entrar(apelido)}
        erro={conexao === 'token_invalido' ? 'Suas credenciais não valem mais para esta sala. Entre de novo.' : erro?.mensagem ?? null}
      />
    )
  }

  if (conexao === 'sala_inexistente') {
    return (
      <section className="tela">
        <p role="alert" className="aviso">Sala não encontrada ou expirada.</p>
        <button type="button" className="principal" onClick={() => navegar('/online')}>
          Voltar
        </button>
      </section>
    )
  }

  if (visao === null) {
    return (
      <section className="tela">
        <p>{conexao === 'reconectando' ? 'Reconectando…' : 'Carregando…'}</p>
      </section>
    )
  }

  const jogo = visao.jogo
  const urlSala = `${window.location.origin}/sala/${visao.codigo}`
  const estouNaPartida = jogo?.jogadores.some((j) => j.id === visao.jogadorId) ?? false

  if (jogo === null || (!estouNaPartida && jogo.fase !== 'fim_jogo')) {
    return (
      <>
        {conexao === 'reconectando' && <p className="aviso">Reconectando…</p>}
        <TelaLobby
          visao={visao}
          urlSala={urlSala}
          aoIniciar={(modo) => void agir({ tipo: 'iniciar_partida', modo })}
          aoEntrarNaPartida={() => void agir({ tipo: 'entrar_na_partida' })}
        />
      </>
    )
  }

  const perspectiva: Perspectiva = { jogadorId: visao.jogadorId, podeAgir: jogo.podeAgir }
  const erroRodada = (erro?.detalhe ?? null) as ErroRodada | 'acao_invalida' | null

  return (
    <main>
      {conexao === 'reconectando' && <p className="aviso">Reconectando…</p>}
      {jogo.fase !== 'fim_jogo' && <Relogio estado={jogo} />}

      {jogo.fase === 'em_rodada' && (
        <TelaRodada
          estado={jogo}
          categorias={jogo.categoriasDisponiveis}
          erro={erroRodada}
          perspectiva={perspectiva}
          aoEscolherCategoria={(categoriaId) => void agir({ tipo: 'iniciar_rodada', categoriaId })}
          aoAgir={(acao) => void agir({ tipo: 'rodada', acao })}
        />
      )}

      {jogo.fase === 'revelacao' && (
        <TelaRevelacao estado={jogo} perspectiva={perspectiva} aoAvancar={() => void agir({ tipo: 'avancar' })} />
      )}

      {jogo.fase === 'decisao_tempo' && (
        <ModalTempo perspectiva={perspectiva} aoDecidir={(decisao) => void agir({ tipo: 'decidir_expiracao', decisao })} />
      )}

      {jogo.fase === 'fim_jogo' && (
        <TelaFimJogo estado={jogo} perspectiva={perspectiva} rotuloReiniciar="Voltar ao início" aoReiniciar={() => navegar('/online')} />
      )}
    </main>
  )
}
```

- [ ] **Step 6: `Raiz.tsx` e `main.tsx`**

`src/ui/Raiz.tsx`:

```tsx
import { useState } from 'react'
import { App } from './App'
import { TelaEntrada } from './online/TelaEntrada'
import { TelaSala } from './online/TelaSala'
import { criarSalaApi } from './online/cliente-api'
import { salvarCredenciais } from './online/credenciais'
import { navegar, useRota } from './rota'
import './estilos.css'

function Online() {
  const [erro, setErro] = useState<string | null>(null)
  return (
    <TelaEntrada
      erro={erro}
      aoCriar={async (apelido) => {
        const r = await criarSalaApi(apelido)
        if (!r.ok) {
          setErro(r.mensagem)
          return
        }
        salvarCredenciais(r.corpo.codigo, { jogadorId: r.corpo.jogadorId, token: r.corpo.token })
        navegar(`/sala/${r.corpo.codigo}`)
      }}
      aoEntrar={(codigo) => navegar(`/sala/${codigo}`)}
    />
  )
}

export function Raiz() {
  const rota = useRota()
  if (rota.nome === 'online') return <Online />
  if (rota.nome === 'sala') return <TelaSala codigo={rota.codigo} />
  return <App />
}
```

Em `main.tsx`, renderizar `<Raiz />` em vez de `<App />`. Em `App.tsx`, o `TelaSetup` ganha um link/botão "Jogar online" que chama `navegar('/online')` — acrescente uma prop opcional `aoJogarOnline?: () => void` em `TelaSetup` e renderize `<button type="button" onClick={aoJogarOnline}>Jogar online</button>` quando presente.

Nota: `TelaEntrada.aoEntrar` no `Raiz` só navega; a `TelaSala` então pede o apelido de novo porque não há credenciais. Para evitar digitar duas vezes, `aoEntrar` no `Raiz` faz `sessionStorage.setItem('top10:apelido-pendente', apelido)` antes de navegar, e `TelaSala`, ao montar sem credenciais, lê e remove essa chave e chama `entrar(apelido)` automaticamente se existir. Implemente isso com um `useEffect` em `TelaSala`.

- [ ] **Step 7: Rodar e confirmar que passa; suíte inteira; build; verificação manual**

Run: `npm test && npm run build`
Expected: PASS.

Run: `npm run dev`; abra duas janelas anônimas em `http://localhost:5173/online`; crie a sala numa, entre com o código na outra; jogue uma rodada. Confirme com os próprios olhos que só quem é a vez vê o campo, que o outro vê "Duvido", e que o palpite seguinte fecha a janela. Reporte o que observou; se não puder usar um navegador, diga isso explicitamente.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(cliente): perspectiva por jogador, tela da sala e roteamento

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Ponta a ponta local, README e roteiro de provisionamento

**Files:**
- Create: `src/servidor/ponta-a-ponta.test.ts`, `docs/deploy-vps.md`
- Modify: `README.md`

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Teste ponta a ponta** — `src/servidor/ponta-a-ponta.test.ts`, dois "aparelhos" contra `roteador` + `storeMemoria`, uma partida inteira de uma categoria:

```ts
import { describe, it, expect } from 'vitest'
import { roteador, type DependenciasHttp } from './http'
import { storeMemoria } from './store'
import { carregarCategorias } from '../data/carregar'
import type { AcaoSala, VisaoSala } from './tipos'

function aparelho(deps: DependenciasHttp) {
  let cred: { id: string; token: string } | null = null
  let versao = 0
  let visao: VisaoSala | null = null
  const headers = () => ({ 'content-type': 'application/json', 'X-Jogador-Id': cred!.id, 'X-Jogador-Token': cred!.token })
  const adotar = (b: { versao: number; visao: VisaoSala }) => { versao = b.versao; visao = b.visao }
  return {
    get visao() { return visao! },
    async criar(apelido: string) {
      const r = await roteador(new Request('http://x/api/salas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apelido }) }), deps)
      const b = await r.json()
      cred = { id: b.jogadorId, token: b.token }
      adotar(b)
      return b.codigo as string
    },
    async entrar(codigo: string, apelido: string) {
      const r = await roteador(new Request(`http://x/api/salas/${codigo}/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apelido }) }), deps)
      const b = await r.json()
      cred = { id: b.jogadorId, token: b.token }
      adotar(b)
    },
    async poll(codigo: string) {
      const r = await roteador(new Request(`http://x/api/salas/${codigo}?versao=${versao}`, { headers: headers() }), deps)
      if (r.status === 200) adotar(await r.json())
      return r.status
    },
    async agir(codigo: string, acao: AcaoSala) {
      const r = await roteador(new Request(`http://x/api/salas/${codigo}/acoes`, { method: 'POST', headers: headers(), body: JSON.stringify({ versao, acao }) }), deps)
      const b = await r.json()
      if (r.status === 200 || r.status === 409) adotar(b)
      return r.status
    },
    id: () => cred!.id,
  }
}

describe('partida completa com dois aparelhos', () => {
  it('do lobby ao fim de jogo, sem nunca vazar a lista', async () => {
    let n = 0
    const deps: DependenciasHttp = {
      store: storeMemoria(),
      catalogo: carregarCategorias(),
      agora: () => 1_000_000 + n++ * 100,
      geradores: { novoId: () => `j${++n}`, novoToken: () => `t${n}`, novoCodigo: () => 'KJQTM' },
    }
    const ana = aparelho(deps)
    const bruno = aparelho(deps)

    const codigo = await ana.criar('Ana')
    await bruno.entrar(codigo, 'Bruno')
    expect(await ana.poll(codigo)).toBe(200)
    expect(ana.visao.jogadores).toHaveLength(2)

    expect(await ana.agir(codigo, { tipo: 'iniciar_partida', modo: { tipo: 'categorias', quantidade: 1 } })).toBe(200)
    await bruno.poll(codigo)
    expect(bruno.visao.jogo?.categoriasDisponiveis).toEqual([])
    const primeira = ana.visao.jogo!.categoriasDisponiveis[0]
    expect(await ana.agir(codigo, { tipo: 'iniciar_rodada', categoriaId: primeira.id })).toBe(200)
    await bruno.poll(codigo)

    // Bruno tenta agir fora da vez: 403 (nao e ele em jogadorId) / 422 (engine).
    expect(await bruno.agir(codigo, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'x', jogadorId: bruno.id() } })).toBe(422)

    // Ana chuta algo que nao existe; a resposta nao tem itens.
    expect(await ana.agir(codigo, { tipo: 'rodada', acao: { tipo: 'palpite', texto: 'zzzqqqxxx', jogadorId: ana.id() } })).toBe(200)
    expect(JSON.stringify(ana.visao)).not.toContain('"itens"')

    // Bruno duvida com versao velha: 409 e adota; depois duvida certo.
    await bruno.poll(codigo)
    expect(bruno.visao.jogo?.podeAgir.duvidar).toBe(true)
    const status = await bruno.agir(codigo, { tipo: 'rodada', acao: { tipo: 'duvidar', duvidadorId: bruno.id() } })
    expect(status).toBe(200)
    expect(bruno.visao.jogo?.fase).toBe('revelacao')
    expect(bruno.visao.jogo?.rodada?.categoria.itens).toHaveLength(10)
    expect(bruno.visao.jogo?.placar[bruno.id()]).toBe(1)

    // So o host avanca.
    expect(await bruno.agir(codigo, { tipo: 'avancar' })).toBe(403)
    await ana.poll(codigo)
    expect(await ana.agir(codigo, { tipo: 'avancar' })).toBe(200)
    expect(ana.visao.jogo?.fase).toBe('fim_jogo')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npm test -- ponta-a-ponta`
Expected: PASS. Se falhar, o defeito está numa task anterior: corrija-o lá com um teste unitário, não aqui.

- [ ] **Step 3: `docs/deploy-vps.md`** — o roteiro que o dono do projeto executa na VPS (Ubuntu/Debian), em português:

```markdown
# Publicar numa VPS

Um único processo Node serve o site e a API. As salas ficam em memória com snapshot em
`dados/salas.json`, então um restart não perde partidas em andamento.

## 1. Na VPS, uma vez

sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

## 2. Código

git clone <url-do-repositorio> top10 && cd top10
npm ci
npm run build

## 3. Rodar e manter de pé

PORTA=3000 pm2 start npm --name top10 -- start
pm2 save
pm2 startup        # imprime um comando; execute-o para subir junto com a máquina

Logs: `pm2 logs top10`. Restart: `pm2 restart top10`.

## 4. HTTPS com Caddy (recomendado)

sudo apt install -y caddy
Em /etc/caddy/Caddyfile:

    seu-dominio.com.br {
        reverse_proxy localhost:3000
    }

sudo systemctl reload caddy

Caddy obtém e renova o certificado sozinho. Aponte o DNS do domínio para o IP da VPS
antes de recarregar. Libere as portas 80 e 443 no firewall (`sudo ufw allow 80,443/tcp`).

## 5. Atualizar

cd top10 && git pull && npm ci && npm run build && pm2 restart top10

## Variáveis

- `PORTA` (padrão 3000)
- `DADOS` (padrão `dados/salas.json`) — caminho do snapshot das salas
- `DIST` (padrão `dist`)

## O que não há

Sem banco, sem serviço externo. Salas expiram 6 h após a última atividade. Se a máquina
reiniciar, `pm2 startup` sobe o processo e o snapshot restaura as salas.
```

- [ ] **Step 4: README** — acrescentar uma seção "Jogar online" com: o que muda (cada um no próprio aparelho), como criar/entrar numa sala, que o anfitrião escolhe categoria e inicia, que o próximo palpite fecha a janela de dúvida (não há "ninguém duvidou" online), que quem chega atrasado entra na próxima rodada, e um link para `docs/deploy-vps.md`. Atualizar a seção de arquitetura para incluir `src/servidor/` e `servidor.ts`, e a seção de como rodar com `npm start` (produção) além de `npm run dev`.

- [ ] **Step 5: Suíte inteira e build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: partida online ponta a ponta; docs de deploy e README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificação final

- [ ] `npm test` verde; `npm run build` limpo.
- [ ] `grep -rn "Date.now\|localStorage\|document\.\|window\.\|from 'react" src/engine src/servidor --include=*.ts | grep -v test | grep -v vite-plugin-api | grep -v store-arquivo | grep -v node-web | grep -v "http.ts"` não devolve nada. (`http.ts` só usa `Date.now` dentro de `dependenciasPadrao`; `vite-plugin-api.ts`, `node-web.ts` e `store-arquivo.ts` são adaptadores.)
- [ ] `grep -rn "data/" src/ui` não devolve nada além de `App.tsx` (modo mesa).
- [ ] O teste de sigilo em `visao.test.ts` e o de `http.test.ts` ("nunca contém itens") estão presentes e inalterados.
- [ ] Modo de um dispositivo (`/`) joga uma partida completa como antes.
