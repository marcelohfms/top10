# Top 10 com Blefe

Jogo de festa local, jogado em grupo compartilhando um único notebook. A cada
rodada uma categoria é sorteada (ex.: "Rios mais longos do mundo") e os
jogadores se revezam dizendo itens que acham que estão entre os 10 primeiros
daquela lista — sem poder repetir o que já foi dito. Só que ninguém vê a
lista real: dá para blefar, e blefar é parte do jogo.

## Regras

1. Cada jogador entra com um nome. A partida pode ser configurada para durar
   uma quantidade fixa de **categorias** ou um tempo total em **minutos**.
2. Em cada rodada uma categoria é escolhida entre as ainda não jogadas.
3. Os jogadores dão palpites em turnos, na ordem em que entraram na rodada.
   Um palpite não pode repetir (mesmo com erro de digitação/acento/plural)
   um palpite já dado nessa rodada.
4. Depois de cada palpite, qualquer outro jogador vivo pode **duvidar**, ou o
   grupo pode decidir que **ninguém duvidou** e passar a vez.
5. Quando alguém duvida, a dúvida revela **apenas se o item existe ou não**
   na lista real — nunca em qual posição ele está. Se o item existir, quem
   duvidou é eliminado da rodada; se não existir (foi um blefe), quem deu o
   palpite é eliminado.
6. A rodada termina quando resta um único jogador vivo — ele vence a rodada e
   ganha um ponto. A lista completa da categoria é revelada ao final da
   rodada.
7. No modo por tempo, se o cronômetro da partida chegar a zero no meio de uma
   rodada, o jogo pausa e pergunta se vocês querem **terminar essa categoria**
   (o cronômetro fica pausado até a rodada acabar) ou **encerrar a partida
   agora** (a rodada em andamento é descartada sem pontuação, mas sua lista
   ainda é mostrada na tela final).
8. Vence a partida quem tiver mais pontos ao final. A tela de fim de jogo
   mostra o placar e a lista completa de todas as categorias jogadas
   (incluindo a que foi interrompida pelo tempo, se houver).

O estado da partida é salvo automaticamente no navegador (`localStorage`), então
recarregar a página no meio de uma partida não perde o progresso.

## Como rodar

Pré-requisitos: Node.js e npm.

```bash
npm install
npm run dev
```

Abra a URL exibida pelo Vite (normalmente `http://localhost:5173`).

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
  mesma categoria** — nem pelo nome, nem por um apelido. Isso é validado
  automaticamente em `src/data/categorias.test.ts`: rode `npm test` depois de
  adicionar a categoria e confira que o teste "não tem itens que colidem pelo
  matching" continua passando para o seu novo `id`. Se dois itens forem
  parecidos demais (ex.: "Rio Amazonas" e "Amazonas"), o jogo não conseguiria
  distinguir um palpite do outro — ajuste o nome ou os apelidos até o teste
  passar.

Depois de editar o JSON, rode `npm test` — o arquivo inteiro é validado por
`categorias.test.ts` (mínimo de 30 categorias, ids únicos, exatamente 10 itens
por categoria, título e fonte preenchidos, e a checagem de colisão acima).
