# Deploy do App de Folha de Pagamento no Lightsail

Mesmo servidor Lightsail do app de auditorias (IP `15.229.168.209`), agora com um segundo app, num subdomínio e porta diferentes. Roteiro enxuto — os detalhes completos (o que cada comando faz) estão no `DEPLOY.md` do app de auditorias.

Assumindo subdomínio `folha.trokservice.com.br` e porta `3003` (ajuste se combinarmos outro nome/porta).

## 1. Clonar o código

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPO.git ~/folha-pagamento
cd ~/folha-pagamento
```

## 2. Configurar senha e chave secreta

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
nano .env
```
Preencha `APP_PASSWORD`, cole a chave em `SESSION_SECRET`, confirme `PORT=3003` (ou outra porta livre) e deixe `COOKIE_SECURE=false` por enquanto.

## 3. Instalar e testar

```bash
npm install
npm approve-scripts better-sqlite3
npm install
node server.js
```
Deve mostrar `Servidor de Folha de Pagamento rodando na porta 3003`, sem erro. `Ctrl+C` para parar.

## 4. Rodar sempre em segundo plano

```bash
pm2 start server.js --name folha-pagamento
pm2 save
```
(o `pm2 startup` só precisa ser configurado uma vez por servidor — já foi feito para o app de auditorias)

## 5. Nginx (proxy da porta 80 para o app)

```bash
sudo tee /etc/nginx/sites-available/folha > /dev/null << 'EOF'
server {
    listen 80;
    server_name folha.trokservice.com.br;
    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/folha /etc/nginx/sites-enabled/folha
sudo nginx -t
sudo systemctl restart nginx
```

## 6. DNS

Registro A (e opcionalmente AAAA) para `folha` apontando para `15.229.168.209` (e o IPv6 `2600:1f1e:b26:d00:a82b:e75a:2b70:920b`).

## 7. HTTPS

```bash
sudo certbot --nginx -d folha.trokservice.com.br
```
Depois, mudar `COOKIE_SECURE=true` no `.env` e `pm2 restart folha-pagamento`.
