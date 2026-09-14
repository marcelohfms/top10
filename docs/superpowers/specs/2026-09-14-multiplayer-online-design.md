# Top 10 com Blefe — Multiplayer online

**Data:** 2026-09-14
**Status:** aprovado (aguardando plano de implementação)
**Depende de:** `2026-08-21-top10-blefe-design.md` (o jogo de um dispositivo, já implementado)

## 1. Objetivo

Permitir que cada jogador entre numa partida pelo próprio aparelho, de qualquer lugar, via
link ou código de sala, e jogue com o próprio campo de palpite e o próprio botão "Duvido".
O jogo de um dispositivo continua existindo e funcionando como hoje.

## 2. Decisões tomadas

| Decisão | Escolha |
|---|---|
| Alcance | Internet, qualquer lugar |
| Hospedagem | VPS (Hostinger): um único processo Node (`servidor.ts`) serve o `dist/` e a API, mantido por `pm2`, HTTPS via Caddy |
| Transporte | HTTP + polling de 1 s. Sem WebSocket |
| Estado da sala | Em memória no processo, com snapshot em `dados/salas.json` após cada gravação (sobrevive a restart). Sem banco, sem serviço externo |
| Entrada | Código de sala + apelido, sem conta |
| Autoridade | Servidor. Roda a mesma engine; o cliente só renderiza e envia ações |
| Sigilo | A lista de itens nunca sai do servidor durante a rodada |
| Concorrência | Versão no estado + compare-and-set. Conflito devolve 409 com o estado atual |

## 3. Topologia

```
celulares ──HTTP──▶ servidor.ts (Node, um processo) ──▶ memória + snapshot em dados/salas.json
                        │
                        └─ src/engine (a mesma de hoje)
```

O catálogo (`src/data/categorias.json`) passa a ser carregado **apenas** pelo servidor. O
bundle do cliente não o inclui mais. Em desenvolvimento, o plugin do Vite monta `/api` com o
store em memória; nada precisa ser provisionado.

## 4. Modelo da sala

```ts
type Sala = {
  codigo: string                 // 5 letras maiúsculas, ex. "KJQTM"
  hostId: string
  jogadores: JogadorSala[]
  jogo: EstadoJogo | null        // null = lobby. Nunca inclui `catalogo`
  versao: number                 // incrementa a cada gravação
  criadaEm: number
  atualizadaEm: number           // TTL: 6 h sem atividade
}

type JogadorSala = {
  id: string
  apelido: string
  token: string                  // segredo do aparelho; nunca aparece na visão pública
  ultimoPollEm: number
}
```

Identidade: ao criar ou entrar, o aparelho recebe `{ jogadorId, token }` e guarda em
`localStorage` sob a chave `top10:sala:<codigo>`. Toda requisição autenticada envia o token no
header `X-Jogador-Token`. O servidor confere que o token pertence ao `jogadorId` daquela sala.

Apelidos são únicos por sala (comparação após `normalizar`). Tentativa de repetir devolve 409.

## 5. Rotas

Todas sob `/api`, servidas por `servidor.ts` (produção) e pelo plugin do Vite (dev), respondendo JSON. Erros seguem `{ erro: string, mensagem: string }`.

| Método e rota | Auth | Corpo | Resposta |
|---|---|---|---|
| `POST /api/salas` | não | `{ apelido }` | `201 { codigo, jogadorId, token, visao }` |
| `POST /api/salas/:codigo/entrar` | não | `{ apelido }` | `200 { jogadorId, token, visao }` |
| `GET /api/salas/:codigo?versao=N` | sim | — | `200 { versao, visao }` ou `204` se `versao === N` |
| `POST /api/salas/:codigo/acoes` | sim | `{ versao, acao }` | `200 { versao, visao }` ou `409 { versao, visao }` |

`GET` no modo por tempo aplica `{ tipo: 'tick' }` com `agora = Date.now()` do servidor antes de
responder, e grava se o estado mudou. É o único lugar onde o tick roda online.

### Autorização por ação

| Ação | Quem pode |
|---|---|
| `iniciar_partida` (configura modo e jogadores da sala) | host |
| `iniciar_rodada`, `avancar`, `decidir_expiracao` | host |
| `rodada.palpite` | o jogador indicado em `jogadorId`, que deve ser o próprio autor do request |
| `rodada.duvidar` | o jogador indicado em `duvidadorId`, que deve ser o próprio autor do request |
| `adicionar_jogador` | o próprio jogador, só entre rodadas |

**Host ausente:** se `ultimoPollEm` do host estiver há mais de 30 s, qualquer jogador da sala
pode executar as ações de host. O `hostId` não muda.

### Códigos de erro

| HTTP | `erro` | Quando |
|---|---|---|
| 400 | `corpo_invalido` | JSON malformado ou campo faltando |
| 403 | `token_invalido` | token não pertence ao jogador na sala |
| 403 | `nao_autorizado` | ação de host por não-host com host presente |
| 404 | `sala_inexistente` | código desconhecido ou sala expirada |
| 409 | `versao_desatualizada` | CAS falhou; corpo traz `versao` e `visao` atuais |
| 409 | `apelido_em_uso` | apelido repetido na sala |
| 422 | `acao_rejeitada` | engine recusou (`erro` da engine no campo `detalhe`) |
| 503 | `store_indisponivel` | store falhou; nada foi aplicado |

## 6. Mudanças na engine

Todas em `src/engine/`, puras, testáveis sem servidor. A fronteira da engine (sem React, DOM,
`localStorage`, `Date.now()`) não muda.

### 6.1 `palpite` ganha `jogadorId`

```ts
{ tipo: 'palpite'; texto: string; jogadorId: string }
```

Validação:
- Em `fase === 'palpite'`: `jogadorId` deve ser `vezDe`. Caso contrário, `ErroRodada`
  `'jogador_invalido'`.
- Em `fase === 'janela_duvida'`: `jogadorId` deve ser o **próximo vivo depois do autor** do
  último palpite. Nesse caso a engine aplica `ninguem_duvidou` implicitamente e em seguida o
  palpite. Qualquer outro `jogadorId` → `'jogador_invalido'`.
- `ninguem_duvidou` continua existindo para o modo de um dispositivo.

O modo de um dispositivo passa a enviar `jogadorId: rodada.vezDe`.

### 6.2 `adicionar_jogador`

```ts
{ tipo: 'adicionar_jogador'; jogador: Jogador }
```

Válido apenas em `fase === 'em_rodada'` com `rodada === null` (entre rodadas) ou em
`'revelacao'`. Acrescenta ao fim de `jogadores` e cria `placar[id] = 0`. Id repetido →
`'acao_invalida'`. Quem chega no meio de uma rodada assiste e entra na próxima.

### 6.3 `visaoPublica(estado, jogadorId, ehHost): VisaoJogo`

Novo módulo `src/engine/visao.ts`. Projeção do `EstadoJogo` que pode ir para o cliente.
`ehHost` é decidido pelo servidor (host, ou qualquer jogador com host ausente) e passado
como parâmetro; a engine não sabe o que é host.

- Remove `catalogo` inteiramente.
- Em `rodada`, substitui `categoria` por `{ id, titulo, fonte }` — **sem `itens`** — enquanto
  `fase` for `'em_rodada'` ou `'decisao_tempo'`. Em `'revelacao'` e `'fim_jogo'`, `itens`
  aparece.
- `concluidas` mantém os itens (já foram revelados).
- Inclui `categoriasDisponiveis: { id, titulo }[]` apenas quando `ehHost`.
- Inclui `jogadorId` para o cliente saber quem é.
- Inclui `podeAgir: { palpite: boolean; duvidar: boolean; host: boolean }`, calculado pela
  engine a partir de `jogadorId` e `ehHost`, para a UI não reimplementar as regras de turno.

Invariante testada: serializar `visaoPublica` de um estado em `'em_rodada'` com rodada em
curso e afirmar que **nenhum** `itens[n].nome` ou apelido aparece na string.

## 7. Servidor

`servidor.ts` e os adaptadores Node↔Web são a única camada com I/O. A lógica fica em `src/servidor/`, pura e testável:

- `src/servidor/sala.ts` — `criarSala`, `entrarNaSala`, `aplicarAcaoNaSala`, `lerSala`:
  funções `(sala, entrada, agora) → { sala, resposta }` sem I/O.
- `src/servidor/autorizacao.ts` — `podeExecutar(sala, jogadorId, acao, agora)`.
- `src/servidor/codigo.ts` — geração de código de sala (5 letras, sem `I`, `O`, `0`, `1`).
- `src/servidor/store.ts` — interface `StoreSala { obter(codigo); gravarSe(sala, versaoEsperada); }`
  com `storeMemoria` (testes e dev) e `store-arquivo.ts` (produção: memória + snapshot). TTL de 6 h aplicado no roteador: sala com `atualizadaEm` mais velha que isso é tratada como inexistente.
- `src/servidor/http.ts` — roteador `(Request, deps) → Response`: lê request, chama o store, chama a função pura, escreve response.
- `servidor.ts` — `http.createServer`: estático com fallback SPA + `/api` → roteador.

Fluxo de uma ação:

```
1. obter(sala)                  → 404 se não existe
2. autenticar token             → 403
3. podeExecutar                 → 403
4. versao do corpo === sala.versao? não → 409 com visão atual
5. aplicarAcaoJogo(sala.jogo, acao, agora)   → 422 se ok:false
6. gravarSe(sala', versaoEsperada)           → CAS falhou → 409
7. 200 { versao, visao }
```

## 8. Cliente

Rotas: `/` (modo de um dispositivo, como hoje, e a entrada para o online), `/online` (criar
sala ou digitar código), `/sala/:codigo` (lobby e jogo).

- `src/ui/online/useSala.ts` — polling de 1 s com a `versao` atual; expõe `{ visao, agir,
  erro, reconectando }`. Para o polling quando a aba está oculta (`visibilitychange`) e
  retoma ao voltar.
- `src/ui/online/TelaEntrada.tsx` — criar sala / entrar com código + apelido.
- `src/ui/online/TelaLobby.tsx` — código em destaque, QR code do link, lista de jogadores,
  escolha de modo (host), botão iniciar (host).
- As telas existentes (`TelaRodada`, `TelaRevelacao`, `TelaFimJogo`, `ModalTempo`) ganham
  a prop `perspectiva: 'mesa' | { jogadorId: string; podeAgir }`. Com `'mesa'` o
  comportamento é o de hoje. Com um jogador, cada tela mostra apenas o que ele pode fazer:
  campo de palpite se `podeAgir.palpite`, "Duvido" se `podeAgir.duvidar`, ações de host se
  `podeAgir.host`, e só a mesa caso contrário.
- Credenciais em `localStorage` sob `top10:sala:<codigo>`; ao reabrir o link, o aparelho
  volta para a sala sem digitar nada.

## 9. Erros e ciclo de vida

- 404 → volta para `/online` com "Sala não encontrada ou expirada".
- 403 `token_invalido` → limpa credenciais da sala e oferece entrar de novo.
- 409 `versao_desatualizada` → renderiza a `visao` devolvida. Nenhuma ação é reenviada
  automaticamente: o jogador vê o estado novo e decide.
- 422 → mostra a mensagem da engine no `role="alert"`, como hoje.
- 503 ou falha de rede → "reconectando…"; polling continua com backoff até 5 s.
- Sala expira 6 h após `atualizadaEm`.
- Modo por tempo: o relógio da UI usa `msRestantes` calculado a partir da visão mais
  recente e do `Date.now()` local; a expiração real é decidida no servidor no próximo `GET`.

## 10. Testes

- **Engine:** `jogador_invalido` nos dois fases; "ninguém duvidou" implícito; `adicionar_jogador`
  entre rodadas e rejeitado no meio; `visaoPublica` — sigilo por serialização, `podeAgir` em
  cada perspectiva, itens presentes em `revelacao`/`fim_jogo`.
- **Servidor:** cada função pura de `src/servidor/` sobre `storeMemoria`: criação e entrada,
  apelido repetido, token errado, host ausente após 30 s, conflito de versão, tick no `GET`
  em modo por tempo, expiração de sala.
- **Cliente:** `useSala` com fake timers (polling, 204, 409, backoff, aba oculta); telas em
  três perspectivas (vez, outro vivo, eliminado).
- **Ponta a ponta local:** uma partida completa com dois "aparelhos" simulados contra
  `storeMemoria`.

## 11. Fora de escopo

Contas e login, ranking entre partidas, chat, WebSockets, anti-abuso além de código aleatório +
TTL, reconexão com replay de histórico, transferência explícita de host, espectadores sem
apelido.
