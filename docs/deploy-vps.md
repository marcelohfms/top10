# Publicar numa VPS

Um único processo Node serve o site e a API. As salas ficam em memória com snapshot em
`dados/salas.json`, então um restart não perde partidas em andamento.

## 1. Na VPS, uma vez

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2. Código

```bash
git clone <url-do-repositorio> top10 && cd top10
npm ci
npm run build
```

## 3. Rodar e manter de pé

```bash
PORTA=3000 pm2 start npm --name top10 -- start
pm2 save
pm2 startup        # imprime um comando; execute-o para subir junto com a máquina
```

Logs: `pm2 logs top10`. Restart: `pm2 restart top10`.

## 4. HTTPS com Caddy (recomendado)

```bash
sudo apt install -y caddy
```

Em `/etc/caddy/Caddyfile`:

```
seu-dominio.com.br {
    request_body {
        max_size 1MB
    }
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtém e renova o certificado sozinho. Aponte o DNS do domínio para o IP da VPS
antes de recarregar. Libere as portas 80 e 443 no firewall (`sudo ufw allow 80,443/tcp`).

## 5. Atualizar

```bash
cd top10 && git pull && npm ci && npm run build && pm2 restart top10
```

## Variáveis

- `PORTA` (padrão 3000)
- `DADOS` (padrão `dados/salas.json`) — caminho do snapshot das salas
- `DIST` (padrão `dist`)

## O que não há

Sem banco, sem serviço externo. Salas expiram 6 h após a última atividade. Se a máquina
reiniciar, `pm2 startup` sobe o processo e o snapshot restaura as salas.

## Alternativa: Docker / Easypanel

O `Dockerfile` na raiz monta a imagem em duas etapas (build do cliente, runtime só com
dependências de produção) e sobe `tsx servidor.ts` na porta 3000.

No Easypanel: crie um serviço **App** a partir do repositório GitHub (`marcelohfms/top10`,
branch `main`, build "Dockerfile"). Depois:

- **Porta**: 3000 (o servidor também aceita a variável `PORT`, que a plataforma injeta).
- **Volume**: monte um volume em `/app/dados` — é onde fica `salas.json`; sem ele um
  redeploy perde as salas em andamento.
- **Domínio**: adicione o domínio no serviço; o Easypanel cuida do HTTPS.

Rodando na mão:

```bash
docker build -t top10 . && docker run -d --name top10 -p 3000:3000 -v top10-dados:/app/dados top10
```
