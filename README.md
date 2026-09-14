# Top 10 com Blefe

Jogo de festa, jogado em grupo compartilhando um único notebook ou com cada um
no próprio celular (veja [Jogar online](#jogar-online)). A cada
rodada o grupo escolhe uma categoria (ex.: "Rios mais longos do mundo") e os
jogadores se revezam dizendo itens que acham que estão entre os 10 primeiros
daquela lista — sem poder repetir o que já foi dito. Só que ninguém vê a
lista real: dá para blefar, e blefar é parte do jogo.

## Regras

1. Cada jogador entra com um nome. A partida pode ser configurada para durar
   uma quantidade fixa de **categorias** ou um tempo total em **minutos**.
2. Em cada rodada o grupo escolhe a categoria, numa grade com as que ainda
   não foram jogadas nesta partida.
3. Os jogadores dão palpites em turnos, na ordem em que entraram na rodada.
   Um palpite não pode repetir (mesmo com erro de digitação/acento/plural)
   um palpite já dado nessa rodada.
4. Depois de cada palpite, qualquer outro jogador vivo pode **duvidar**, ou o
   grupo pode decidir que **ninguém duvidou** e passar a vez.
5. Quando alguém duvida, a dúvida revela **apenas se o item existe ou não**
   na lista real — nunca em qual posição ele está. Se o item existir, quem
   duvidou é eliminado da rodada; se não existir (foi um blefe), quem deu o
   palpite é eliminado. Nos dois casos a vez segue para o próximo jogador
   vivo **depois do autor do palpite**, na ordem original.
6. A rodada termina quando resta um único jogador vivo — ele vence a rodada e
   ganha um ponto. A lista completa da categoria é revelada ao final da
   rodada.
7. No modo por tempo, se o cronômetro da partida chegar a zero no meio de uma
   rodada, o jogo pausa (inclusive o cronômetro, para que a deliberação não
   consuma tempo) e pergunta se vocês querem **terminar essa categoria** — a
   rodada segue normalmente até sobrar um jogador e vale ponto, e a partida
   encerra logo depois, sem começar categoria nova — ou **encerrar a partida
   agora**, caso em que a rodada em andamento é descartada sem pontuação, mas
   sua lista ainda é mostrada na tela final.
8. Vence a partida quem tiver mais pontos ao final. A tela de fim de jogo
   mostra o placar e a lista completa de todas as categorias jogadas
   (incluindo a que foi interrompida pelo tempo, se houver).

O estado da partida é salvo automaticamente no navegador (`localStorage`), então
recarregar a página no meio de uma partida não perde o progresso. As listas
secretas **não** vão para o `localStorage`: só o identificador da categoria é
gravado, e a lista é recarregada do catálogo do próprio jogo. Abrir o DevTools
no meio da rodada não entrega a resposta.

## Jogar online

Além do modo de um só aparelho, dá para jogar com cada pessoa no próprio
celular. O que muda:

- Alguém **cria uma sala** em `/online` e vira o anfitrião. A sala ganha um
  código de 5 letras e um QR code; os outros entram pelo link, pelo QR ou
  digitando o código e um apelido.
- O **anfitrião** escolhe o modo (categorias ou minutos), inicia a partida e,
  em cada rodada, escolhe a categoria e inicia a rodada. Só ele avança da
  revelação para a próxima rodada.
- Cada jogador vê na própria tela apenas o que pode fazer no momento: o campo
  de palpite quando é a vez dele, o botão **Duvido** depois do palpite de outro.
- Não existe "ninguém duvidou" online: a janela de dúvida fica aberta até o
  **próximo palpite**, que a fecha automaticamente.
- Quem chega atrasado (a partida já começou) entra na sala e passa a jogar a
  partir da **próxima rodada**.
- As credenciais ficam no `localStorage` do aparelho; reabrir o link volta
  para a sala sem digitar nada. O servidor nunca envia a lista da rodada em
  curso a nenhum cliente até a revelação (o catálogo inteiro continua no
  bundle por causa do modo num aparelho só).
- A sala expira 6 h depois da última atividade.

Para publicar numa VPS própria, siga [docs/deploy-vps.md](docs/deploy-vps.md).

## Arquitetura

- `src/engine/` — regras do jogo, puras e sem dependência de UI ou servidor.
- `src/data/` — catálogo de categorias e sua validação.
- `src/ui/` — telas React; `src/ui/online/` tem as telas e o polling do modo
  online.
- `src/servidor/` — API HTTP das salas (`roteador`), autorização, store em
  memória com snapshot em arquivo e o servidor de arquivos estáticos.
- `servidor.ts` — o processo Node de produção: serve `dist/` e a API num
  único porto.

## Como rodar

Pré-requisitos: Node.js (>= 22) e npm.

Em desenvolvimento (Vite com hot reload; a API das salas roda dentro do
próprio dev server):

```bash
npm install
npm run dev
```

Abra a URL exibida pelo Vite (normalmente `http://localhost:5173`).

Em produção, um único processo serve o site já compilado e a API:

```bash
npm run build
npm start
```

O servidor escuta na porta `PORTA` (padrão 3000) e guarda o snapshot das salas
em `DADOS` (padrão `dados/salas.json`).

## Como rodar os testes

```bash
npm test
```

Para observar o build de produção (o mesmo processo usado antes de publicar):

```bash
npm run build
```

## Como adicionar uma categoria nova

As categorias ficam em `src/data/categorias.json`, um array de objetos com
este formato:

```json
{
  "id": "identificador-unico-kebab-case",
  "titulo": "Título exibido ao jogador, em português",
  "fonte": "De onde veio o ranking (ex.: nome do órgão/ano)",
  "itens": [
    { "nome": "Nome do item", "apelidos": ["forma alternativa", "sigla"] }
  ]
}
```

Regras a respeitar:

- `id` precisa ser único no arquivo inteiro e em kebab-case ASCII (sem acentos).
- `itens` precisa ter **exatamente 10 objetos**, na ordem real do ranking (a
  ordem importa para a revelação, mesmo que a dúvida nunca exponha posição).
- `apelidos` é uma lista de formas alternativas aceitas como palpite válido
  para aquele item — siglas, sinônimos, grafias comuns (ex.: `"co2"` e
  `"gas carbonico"` para `"Dióxido de carbono"`). O jogo já tolera acentos,
  maiúsculas/minúsculas e pequenos erros de digitação automaticamente; use
  `apelidos` só para variações que não são apenas "erro de grafia" do nome
  principal (siglas, nomes populares, etc.).
- **Nenhum item da categoria pode combinar (fuzzy-match) com outro item da
  mesma categoria** — nenhuma forma de um item (nome ou apelido) pode casar
  com nenhuma forma de outro item. Isso é validado
  automaticamente em `src/data/categorias.test.ts`: rode `npm test` depois de
  adicionar a categoria e confira que o teste "não tem itens que colidem pelo
  matching" continua passando para o seu novo `id`. Se dois itens forem
  parecidos demais (ex.: "Rio Amazonas" e "Amazonas"), o jogo não conseguiria
  distinguir um palpite do outro — ajuste o nome ou os apelidos até o teste
  passar.

Depois de editar o JSON, rode `npm test` — o arquivo inteiro é validado por
`categorias.test.ts` (mínimo de 30 categorias, ids únicos, exatamente 10 itens
por categoria, título e fonte preenchidos, e a checagem de colisão acima).

Duas categorias (maiores produtores de açúcar, países com mais ouros
olímpicos) foram removidas por ora porque não foi possível confirmar o top 10
delas com confiança. Contribuições são bem-vindas: se alguém confirmar o
ranking numa fonte real, elas voltam.
