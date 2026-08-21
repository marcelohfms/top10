# Top 10 com Blefe — Design

**Data:** 2026-08-21
**Status:** aprovado (aguardando plano de implementação)

## 1. Visão geral

Jogo de mesa digital para um grupo de pessoas na mesma sala, compartilhando um único
dispositivo. Escolhe-se uma categoria ("Elementos mais abundantes na atmosfera terrestre",
"Países com maior custo de vida"); os jogadores dão palpites de itens que acreditam estar no
Top 10 daquela categoria. Entre um palpite e o próximo, qualquer jogador vivo pode duvidar.
Quem erra a aposta — seja o autor do palpite, seja o duvidador — é eliminado da rodada. A
rodada acaba quando resta um jogador. A lista completa só é revelada ao fim de cada rodada.

O jogo roda 100% offline, sem backend e sem chamadas de rede.

## 2. Decisões tomadas

| Decisão | Escolha |
|---|---|
| Fonte dos dados | Banco local curado em JSON, versionado no repositório |
| Interface | Web local no navegador, um único dispositivo |
| Palpite repetido | Rejeitado na digitação, com aviso; não consome a vez |
| Estrutura da partida | Várias rodadas com placar; lista revelada ao fim de cada rodada |
| Quem pode duvidar | Apenas jogadores vivos, exceto o autor do palpite |
| Grafia | Aceite automático: normalização + apelidos + tolerância a typo |
| Duração da partida | Por número de categorias **ou** por tempo |
| Stack | Vite + TypeScript + React; Vitest para testes |

## 3. Arquitetura

Três camadas com fronteiras rígidas:

| Camada | Responsabilidade | Depende de |
|---|---|---|
| `src/data/categories.json` | Categorias curadas: título, 10 itens ordenados, apelidos por item, fonte/ano | nada |
| `src/engine/` (TS puro) | Regras do jogo e matching de grafia. Funções puras `(estado, ação) → novo estado`. Sem import de React ou DOM | apenas os tipos do catálogo |
| `src/ui/` (React) | Telas, botões, cronômetro, animações. Lê estado e despacha ações | engine |

Princípio central: **a engine não sabe que existe uma tela.** Toda a regra do jogo é testável
sem renderizar nada, incluindo cenários dependentes de tempo.

### Módulos da engine

- `engine/types.ts` — tipos de `Categoria`, `Jogador`, `EstadoPartida`, `EstadoRodada`, `Acao`.
- `engine/match.ts` — comparação de palpite contra item da lista. Sem estado.
- `engine/round.ts` — máquina de estados de uma rodada.
- `engine/match-clock.ts` — regras de duração e expiração da partida (recebe o instante atual como parâmetro; nunca lê o relógio sozinho).
- `engine/game.ts` — redutor de topo: compõe rodada + relógio + placar.

Nenhum módulo da engine chama `Date.now()` internamente. O instante atual entra sempre como
argumento, o que torna determinístico testar "o tempo zerou no meio da janela de dúvida".

## 4. Máquina de estados da rodada

```
SETUP → (escolhe categoria) → PALPITE

PALPITE
  jogador da vez digita um palpite
    → palpite duplicado: rejeitado, permanece em PALPITE (a vez não passa)
    → palpite válido: JANELA_DUVIDA

JANELA_DUVIDA
  ├─ "ninguém duvidou"  → PALPITE (próximo jogador vivo)
  └─ "X duvida"         → resolve o palpite contra a lista oficial:
        palpite ESTÁ no top 10   → X (duvidador) é eliminado
        palpite NÃO está          → autor do palpite é eliminado
        → resta 1 vivo?  sim → FIM_RODADA
                         não → PALPITE (próximo vivo após o eliminado)

FIM_RODADA
  revela a lista completa, credita 1 ponto ao sobrevivente
    → partida continua → PALPITE (nova categoria)
    → partida encerrada → FIM_JOGO (placar final)
```

### Regras derivadas

- Palpite duplicado é rejeitado no momento da digitação, sem consumir a vez e sem revelar nada
  sobre a lista. A comparação de duplicidade usa o mesmo matching de grafia da seção 5.
- Palpite que ninguém duvida fica **pendente e nunca é verificado** — fiel ao jogo de mesa —
  mas entra na lista de "já ditos" para efeito de duplicidade.
- Se os 10 itens já saíram, qualquer palpite novo é necessariamente falso. O jogo não avisa;
  essa é justamente a tensão da mecânica.
- Uma categoria já jogada não se repete na mesma partida.
- Ao duvidar, revela-se **apenas** se o palpite existe ou não na lista — nunca a posição.

## 5. Matching de grafia (`engine/match.ts`)

Cascata determinística, para na primeira etapa que casar:

1. **Normalização** de ambos os lados: minúsculas, remoção de acentos via NFD, remoção de
   pontuação, colapso de espaços, remoção de artigos iniciais (`o`, `a`, `os`, `as`, `de`,
   `da`, `do`).
2. **Apelidos** cadastrados no JSON por item. Ex.: `"Estados Unidos"` →
   `["eua", "usa", "estados unidos da america"]`.
3. **Similaridade** por Damerau-Levenshtein normalizado (variante OSA, em que a troca de duas
   letras vizinhas custa uma única edição), limiar ≥ 0.85, com regra mais rígida para strings
   curtas (menos de 6 caracteres exigem match exato após normalização).

O resultado é binário: casou ou não casou. Não há diálogo de confirmação — a decisão é
automática, conforme escolhido no brainstorming.

Testes cobrem uma tabela de casos reais: variações de acento, siglas, typos de transposição
(`nitorgenio`), e explicitamente os **falso-positivos que não podem casar** (`Brasil` vs
`Brunei`, `Chade` vs `Chile`).

## 6. Duração da partida

Definida no SETUP, antes da primeira categoria. Dois modos mutuamente exclusivos:

**Por categorias** — `N` rodadas (presets 3 / 5 / 7 e valor custom). A partida acaba quando a
N-ésima rodada termina. Um cronômetro de tempo decorrido fica visível, mas é apenas
informativo e não afeta o jogo.

**Por tempo** — `T` minutos (presets 15 / 30 / 45 e valor custom). Contagem regressiva do
relógio de parede, iniciada no primeiro palpite da primeira rodada.

### Comportamento na expiração de `T`

- **Entre rodadas** (tela de revelação ou placar): a partida encerra direto, sem perguntar —
  não há categoria em andamento sobre a qual decidir.
- **No meio de uma rodada**: o timer congela, a rodada congela, e sobe um modal com duas
  opções:
  - **Encerrar agora** — a partida termina imediatamente. A rodada em curso é **abortada e não
    pontua**, mas sua lista é revelada junto com as demais no placar final, para que ninguém
    fique sem a resposta.
  - **Terminar esta categoria** — a rodada segue normalmente até sobrar um jogador e vale ponto
    normalmente. A partida encerra logo em seguida; nenhuma categoria nova começa.

### Invariantes do relógio

- O timer **pausa** enquanto o modal está aberto: a deliberação do grupo não consome tempo.
- O modal aparece no instante exato da expiração, inclusive no meio da janela de dúvida. O
  estado da rodada é preservado intacto; ao escolher "Terminar esta categoria", o jogo retoma
  exatamente do ponto em que parou.
- Empate no placar final é exibido como empate, sem desempate automático.

## 7. Dados

`src/data/categories.json` — array de categorias:

```json
{
  "id": "elementos-atmosfera",
  "titulo": "Elementos mais abundantes na atmosfera terrestre",
  "fonte": "NASA, 2023",
  "itens": [
    { "nome": "Nitrogênio", "apelidos": ["n2", "azoto"] },
    { "nome": "Oxigênio",   "apelidos": ["o2"] }
  ]
}
```

Cada categoria tem exatamente 10 itens, em ordem de ranking. Uma suíte de testes valida o
arquivo: 10 itens por categoria, ids únicos, sem nomes duplicados dentro de uma categoria, e
nenhum par de itens da mesma categoria que colida pelo matching da seção 5 (o que tornaria a
duplicidade ambígua).

Meta inicial: 30 a 50 categorias em português, com temas variados (geografia, ciência,
cultura pop, esporte, história, comida).

## 8. Persistência

Placar e progresso da partida em memória, espelhados em `localStorage` a cada transição de
estado, de modo que um F5 acidental no meio do jogo não perca a partida. Sem backend, sem
contas, sem histórico entre partidas.

## 9. Testes

- **Engine** (Vitest, sem DOM): máquina de estados da rodada, eliminação em ambas as direções,
  ordem de turno após eliminação, rejeição de duplicata, esgotamento dos 10 itens, expiração de
  tempo nos dois cenários e nas duas escolhas do modal, pausa do timer.
- **Matching**: tabela de casos positivos e negativos, incluindo falso-positivos proibidos.
- **Dados**: validação estrutural do `categories.json`.
- **UI**: cobertura fina — apenas fluxo de smoke de uma partida completa. A lógica está toda na
  engine e é lá que a suíte pesa.

## 10. Fora de escopo

Multi-dispositivo (cada jogador no próprio celular), timer por jogada, categorias geradas por
IA, histórico entre partidas, contas de usuário, i18n. Todos cabem depois sem reescrever a
engine, porque nenhum deles atravessa a fronteira engine/UI.
