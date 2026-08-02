# CRED10MIX — Gestão de Seguros Automatizada

Sistema completo para controle e gestão de corretora de seguros, com registro de apólices, cadastro de clientes, gestão financeira, lembretes, alertas e automação de comunicações.

---

## Sumário

1. [Arquitetura do Sistema](#arquitetura-do-sistema)
2. [Tecnologias e Versões](#tecnologias-e-versões)
3. [Requisitos para Instalação](#requisitos-para-instalação)
4. [Instalação do Zero](#instalação-do-zero)
5. [Configuração do PocketBase](#configuração-do-pocketbase)
6. [Configuração do Frontend](#configuração-do-frontend)
7. [Configuração do Resend (E-mails)](#configuração-do-resend-e-mails)
8. [Criação do Primeiro Administrador](#criação-do-primeiro-administrador)
9. [Comandos de Desenvolvimento](#comandos-de-desenvolvimento)
10. [Build de Produção](#build-de-produção)
11. [Deploy com Docker](#deploy-com-docker)
12. [Deploy em VPS](#deploy-em-vps)
13. [Backup e Restauração](#backup-e-restauração)
14. [Atualização Segura](#atualização-segura)
15. [Segurança e Permissões](#segurança-e-permissões)
16. [Estrutura do Projeto](#estrutura-do-projeto)
17. [Serviços Externos](#serviços-externos)
18. [Resolução de Problemas](#resolução-de-problemas)

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (SPA)                     │
│         React 19 + Vite 8 + TypeScript               │
│    Tailwind CSS 3 + Shadcn/UI + React Router 7       │
│              Porta: 5173 (dev) / 80 (prod)            │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE (Real-time)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Backend (API + DB)                   │
│              PocketBase v0.36 (SQLite)                │
│   Auth, CRUD, Real-time, Hooks (JS), Migrations       │
│              Porta: 8090                               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              Serviço de E-mail (Resend)               │
│          Envio de comunicações em massa               │
└─────────────────────────────────────────────────────┘
```

### Fluxo de Dados

- O frontend é uma **Single Page Application (SPA)** que se comunica com o PocketBase via REST API e SSE (Server-Sent Events) para real-time.
- O PocketBase armazena todos os dados em **SQLite** (arquivo único em `pb_data/`).
- **Hooks JavaScript** executam lógica server-side: auto-numeração de códigos, criação de lembretes automáticos, envio de e-mails, validações de usuários.
- **Migrations** versionam o schema do banco de dados.
- O envio de e-mails é feito via **Resend API**, chamado a partir de hooks do PocketBase.

---

## Tecnologias e Versões

### Frontend

| Tecnologia | Versão | Descrição |
|---|---|---|
| React | 19.x | Biblioteca UI |
| TypeScript | 6.x | Tipagem estática |
| Vite | 8.x | Bundler e dev server |
| Tailwind CSS | 3.4.x | Framework CSS |
| Shadcn/UI | — | Componentes de UI |
| React Router | 7.x | Roteamento |
| React Hook Form | 7.x | Formulários |
| Zod | 4.x | Validação de schemas |
| Recharts | 3.x | Gráficos |
| Lucide React | 0.577.x | Ícones |
| PocketBase SDK | — | Cliente do backend |

### Backend

| Tecnologia | Versão | Descrição |
|---|---|---|
| PocketBase | **v0.36.x** | Backend (API + DB + Auth) |
| SQLite | (embutido) | Banco de dados |

### Serviços Externos

| Serviço | Uso |
|---|---|
| Resend | Envio de e-mails transacionais e em massa |

### Build e Dev

| Ferramenta | Versão |
|---|---|
| Node.js | **20.x ou superior** |
| pnpm | **9.x ou superior** |
| Oxlint | 1.71.x |
| Oxfmt | 0.56.x |

---

## Requisitos para Instalação

- **Node.js** 20.x ou superior — [Download](https://nodejs.org/)
- **pnpm** 9.x ou superior — `npm install -g pnpm`
- **PocketBase** v0.36.x — [Download](https://github.com/pocketbase/pocketbase/releases)
- **Resend** (opcional) — Conta em [resend.com](https://resend.com) para envio de e-mails

---

## Instalação do Zero

### 1. Instalar Node.js e pnpm

```bash
# Instale o Node.js 20+ (via nvm, gerenciador de pacotes ou site oficial)
node -v  # deve mostrar v20.x ou superior

# Instalar pnpm globalmente
npm install -g pnpm
pnpm -v  # deve mostrar 9.x ou superior
```

### 2. Clonar/baixar o projeto

```bash
# Se baixou um zip, descompacte e entre na pasta
cd gestao-de-seguros-automatizada
```

### 3. Instalar dependências do frontend

```bash
pnpm install
```

### 4. Baixar e configurar o PocketBase

```bash
# Criar pasta para o backend
mkdir -p pocketbase-bin
cd pocketbase-bin

# Baixar PocketBase v0.36 para Linux amd64 (ajuste conforme seu SO)
wget https://github.com/pocketbase/pocketbase/releases/download/v0.36.0/pocketbase_0.36.0_linux_amd64.zip
unzip pocketbase_0.36.0_linux_amd64.zip
chmod +x pocketbase

# Voltar à raiz do projeto
cd ..
```

> Para macOS: baixe `pocketbase_0.36.0_darwin_arm64.zip` (Apple Silicon) ou `pocketbase_0.36.0_darwin_amd64.zip` (Intel).
> Para Windows: baixe `pocketbase_0.36.0_windows_amd64.zip`.

### 5. Iniciar o PocketBase

```bash
# Na raiz do projeto, crie a estrutura de pastas do PocketBase
mkdir -p pb_data pb_migrations pb_hooks

# Copie as migrations e hooks do projeto
cp -r pocketbase/migrations/* pb_migrations/
cp -r pocketbase/hooks/* pb_hooks/

# Inicie o PocketBase
./pocketbase-bin/pocketbase serve --http=127.0.0.1:8090
```

O PocketBase criará automaticamente o banco SQLite e aplicará as migrations na primeira execução.

### 6. Aplicar migrations (se não aplicadas automaticamente)

Acesse o Admin do PocketBase em `http://127.0.0.1:8090/_/`:

1. Crie a conta de superusuário admin.
2. Vá em **Settings → Import collections → Migrations**.
3. Ou use a CLI: `./pocketbase-bin/pocketbase migrate up`

### 7. Configurar variáveis de ambiente

```bash
# Copiar o exemplo
cp .env.example .env

# Editar com seus valores
nano .env
```

Defina `VITE_POCKETBASE_URL=http://127.0.0.1:8090` (ou a URL do seu servidor).

### 8. Configurar segredos no PocketBase

No Admin do PocketBase (`http://127.0.0.1:8090/_/`):

1. Vá em **Settings → Secrets** (ou configure via variáveis de ambiente do container).
2. Adicione:
   - `RESEND_API_KEY`: sua chave de API do Resend
   - `RESEND_FROM_EMAIL`: e-mail remetente verificado
   - `SITE_URL`: URL pública do frontend

### 9. Iniciar o frontend em desenvolvimento

```bash
pnpm dev
```

Acesse: `http://localhost:5173`

---

## Configuração do PocketBase

### Estrutura

```
pocketbase/
├── migrations/          # 24 migrations versionadas (schema)
│   ├── 0001_create_clients.js
│   ├── 0002_create_policies.js
│   ├── ...
│   └── 0024_create_tipos_seguro.js
└── hooks/               # Hooks JavaScript (lógica server-side)
    ├── birthday_reminders_cron.js
    ├── client_code_auto.js
    ├── on_policy_create_reminder.js
    ├── on_policy_update_reminder.js
    ├── on_users_create_request.js
    ├── on_users_update_request.js
    ├── partner_code_auto.js
    ├── policy_code_auto.js
    ├── send_mass_email.js
    ├── users_create.js
    ├── users_list.js
    └── users_update.js
```

### Migrations

As migrations criam e modificam as seguintes collections:

| Collection | Tipo | Descrição |
|---|---|---|
| `users` | auth | Usuários do sistema com roles |
| `clients` | base | Clientes (PF/PJ) |
| `policies` | base | Apólices/seguros |
| `payments` | base | Pagamentos e parcelas |
| `reminders` | base | Lembretes e alertas |
| `communications` | base | Comunicações enviadas |
| `seguradoras` | base | Seguradoras |
| `parceiros` | base | Parceiros/indicadores |
| `custos_fixos` | base | Custos fixos e variáveis |
| `tipos_seguro` | base | Tipos de seguro cadastrados |

### Aplicar migrations manualmente

```bash
./pocketbase serve  # inicia o servidor
# Em outro terminal:
./pocketbase migrate up
```

### Hooks

Os hooks fornecem:

- **Auto-numeração**: códigos automáticos para clientes, apólices e parceiros
- **Lembretes automáticos**: cria lembretes de renovação ao criar/editar apólices
- **Cron de aniversários**: verifica e cria lembretes de aniversário dos clientes
- **Validação de usuários**: valida role e dados ao criar/editar usuários
- **Envio de e-mails em massa**: rota customizada para envio via Resend

Os hooks são carregados automaticamente pelo PocketBase a partir da pasta `pb_hooks/`.

### Real-time

O PocketBase usa **Server-Sent Events (SSE)** para real-time. O frontend usa o hook `useRealtime` para assinar mudanças nas collections e atualizar a UI em tempo real. Não é necessária configuração adicional — o SSE funciona nativamente.

---

## Configuração do Frontend

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

> Em produção, defina para a URL pública do seu PocketBase (ex: `https://api.seudominio.com`).

### Apontar para o PocketBase

O frontend importa o cliente PocketBase de `src/lib/pocketbase/client.ts`, que lê a variável `VITE_POCKETBASE_URL`. Basta ajustar o `.env`.

---

## Configuração do Resend (E-mails)

O sistema usa o [Resend](https://resend.com) para envio de e-mails.

### Passo a passo

1. **Criar conta**: acesse [resend.com](https://resend.com) e crie uma conta.
2. **Obter API Key**: vá em **API Keys** e crie uma nova chave (começa com `re_`).
3. **Verificar domínio** (opcional): para usar um remetente customizado, verifique seu domínio no Resend. Para testes, use `onboarding@resend.dev`.
4. **Configurar no PocketBase**: adicione a chave como secret `RESEND_API_KEY` no Admin do PocketBase ou como variável de ambiente do container.

### Endpoints de e-mail

O hook `send_mass_email.js` registra a rota `POST /backend/v1/send-mass-email` que:
- Recebe uma lista de destinatários
- Envia cada e-mail via Resend API
- Registra o resultado na collection `communications`

---

## Criação do Primeiro Administrador

### Opção 1: Via Admin do PocketBase

1. Acesse `http://127.0.0.1:8090/_/` no navegador.
2. Crie a conta de superusuário.
3. Faça login no sistema (frontend) com o e-mail `thiaguinhoffs@gmail.com` e senha `Skip@Pass` (seed inicial) — **altere a senha imediatamente após o primeiro login**.

### Opção 2: Via CLI do PocketBase

```bash
./pocketbase superuser upsert admin@seudominio.com sua_senha_segura
```

### Opção 3: Via migration de seed

A migration `0006_seed_initial_user.js` cria um usuário inicial:
- **E-mail**: `thiaguinhoffs@gmail.com`
- **Senha**: `Skip@Pass`
- **Role**: Admin

> ⚠️ **IMPORTANTE**: Altere a senha e o e-mail após a instalação. Esta migration deve ser removida ou modificada em produção.

---

## Comandos de Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Iniciar dev server (frontend)
pnpm dev

# Verificação de tipos
pnpm tsc --noEmit

# Lint
pnpm lint

# Formatar código
pnpm format

# Iniciar PocketBase (em outro terminal)
./pocketbase-bin/pocketbase serve --http=127.0.0.1:8090
```

---

## Build de Produção

```bash
# Gerar build estático
pnpm build

# Os arquivos estarão em dist/
# Sirva com qualquer servidor estático (nginx, caddy, vercel, netlify, etc.)
```

### Servir com preview local

```bash
pnpm preview
```

### Servir com nginx

```nginx
server {
    listen 80;
    server_name seudominio.com;
    root /var/www/cred10mix/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Servir com Caddy

```caddyfile
seudominio.com {
    root * /var/www/cred10mix/dist
    file_server
    try_files {path} /index.html
}
```

---

## Deploy com Docker

### Pré-requisitos

- Docker 24+
- Docker Compose v2+

### Passo a passo

1. **Configurar variáveis**:

```bash
cp .env.example .env
# Edite .env com suas configurações
```

2. **Build e start**:

```bash
docker compose up -d --build
```

3. **Acessar**:
   - Frontend: `http://localhost:5173`
   - PocketBase Admin: `http://localhost:8090/_/`
   - API: `http://localhost:8090/api/`

4. **Parar**:

```bash
docker compose down
```

5. **Ver logs**:

```bash
docker compose logs -f
```

### Volumes persistentes

- `pb_data`: banco de dados SQLite + arquivos enviados

> Para backup: `docker compose cp pocketbase:/pb/pb_data ./backup-pb_data`

---

## Deploy em VPS

### Estrutura recomendada

```
/opt/cred10mix/
├── frontend/dist/         # Build estático do frontend
├── pocketbase/            # Binário + migrations + hooks
│   ├── pocketbase         # Binário
│   ├── pb_data/           # Banco SQLite (NÃO versionar)
│   ├── pb_migrations/     # Migrations
│   └── pb_hooks/          # Hooks
├── .env                   # Variáveis de ambiente
└── docker-compose.yml     # Opcional, se usar Docker
```

### Passo a passo (sem Docker)

1. **Instalar Node.js e pnpm**:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm install -g pnpm
```

2. **Build do frontend**:

```bash
cd /opt/cred10mix/frontend
pnpm install
VITE_POCKETBASE_URL=https://api.seudominio.com pnpm build
```

3. **Instalar PocketBase**:

```bash
cd /opt/cred10mix/pocketbase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.36.0/pocketbase_0.36.0_linux_amd64.zip
unzip pocketbase_0.36.0_linux_amd64.zip
cp -r pocketbase/migrations/* pb_migrations/ 2>/dev/null || true
cp -r pocketbase/hooks/* pb_hooks/ 2>/dev/null || true
```

4. **Configurar Nginx** (proxy reverso + estático):

```nginx
server {
    listen 80;
    server_name seudominio.com;
    root /opt/cred10mix/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. **SSL com Let's Encrypt**:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com -d api.seudominio.com
```

6. **Criar serviço systemd para PocketBase**:

```bash
sudo tee /etc/systemd/system/cred10mix-pb.service << 'EOF'
[Unit]
Description=CRED10MIX PocketBase
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/cred10mix/pocketbase
ExecStart=/opt/cred10mix/pocketbase/pocketbase serve --http=127.0.0.1:8090
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable cred10mix-pb
sudo systemctl start cred10mix-pb
```

7. **Atualizar `VITE_POCKETBASE_URL`**:

No `.env` do frontend, defina:
```env
VITE_POCKETBASE_URL=https://api.seudominio.com
```

Rebuild: `pnpm build`

---

## Backup e Restauração

### Backup

```bash
# Parar o PocketBase (recomendado)
./pocketbase serve &  # ou systemctl stop cred10mix-pb

# Backup do banco de dados
cp pb_data/data.db backup/data_$(date +%Y%m%d_%H%M%S).db

# Backup completo (inclui uploads)
tar -czf backup/pb_data_$(date +%Y%m%d).tar.gz pb_data/

# Reiniciar
./pocketbase serve  # ou systemctl start cred10mix-pb
```

### Backup automático (cron)

```bash
# Crontab - executar diariamente às 03:00
0 3 * * * tar -czf /opt/cred10mix/backup/pb_data_$(date +\%Y\%m\%d).tar.gz /opt/cred10mix/pocketbase/pb_data/
```

### Restauração

```bash
# Parar o PocketBase
systemctl stop cred10mix-pb

# Restaurar
rm -rf pb_data/
tar -xzf backup/pb_data_20260101.tar.gz

# Reiniciar
systemctl start cred10mix-pb
```

### Backup com Docker

```bash
# Backup
docker compose stop pocketbase
docker run --rm -v cred10mix_pb_data:/data -v $(pwd):/backup alpine tar -czf /backup/pb_data_backup.tar.gz /data
docker compose start pocketbase

# Restauração
docker compose stop pocketbase
docker run --rm -v cred10mix_pb_data:/data -v $(pwd):/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/pb_data_backup.tar.gz -C /"
docker compose start pocketbase
```

---

## Atualização Segura

### Atualizar o frontend

```bash
git pull  # ou baixar nova versão
pnpm install
pnpm build
# Reiniciar o servidor web (nginx: sudo systemctl reload nginx)
```

### Atualizar o PocketBase

```bash
# 1. FAZER BACKUP (sempre!)
cp -r pb_data pb_data_backup_$(date +%Y%m%d)

# 2. Baixar nova versão
wget https://github.com/pocketbase/pocketbase/releases/download/v0.36.X/pocketbase_0.36.X_linux_amd64.zip
unzip -o pocketbase_0.36.X_linux_amd64.zip

# 3. Aplicar migrations
./pocketbase migrate up

# 4. Reiniciar
systemctl restart cred10mix-pb

# 5. Testar
curl http://127.0.0.1:8090/api/health
```

### Atualizar migrations/hooks

```bash
# Copiar novas migrations
cp -r pocketbase/migrations/* pb_migrations/

# Copiar novos hooks
cp -r pocketbase/hooks/* pb_hooks/

# Aplicar migrations
./pocketbase migrate up

# Reiniciar (hooks são carregados no startup)
systemctl restart cred10mix-pb
```

---

## Segurança e Permissões

### Perfis de Usuário

O sistema possui 5 perfis com permissões distintas:

| Perfil | Clientes | Apólices | Financeiro | Usuários | Configurações |
|---|---|---|---|---|---|
| **Admin** | CRUD total | CRUD total | CRUD total | CRUD total | Acesso total |
| **Administrador** | CRUD total | CRUD total | CRUD total | CRUD total | Acesso total |
| **Gerente** | Criar/Editar | Criar/Editar | Visualizar | Não | Não |
| **Operador** | Editar | Não | Não | Não | Não |
| **Visualizador** | Visualizar | Visualizar | Não | Não | Não |

### Regras de Acesso (PocketBase RLS)

Todas as collections possuem regras de acesso baseadas em `@request.auth.role`:

- **List/View**: Usuários autenticados (`@request.auth.id != ''`)
- **Create/Update/Delete**: Restrito por role (Admin/Administrador têm acesso total)
- **Custos Fixos**: Apenas Admin/Administrador/Gerente
- **Usuários**: Admin/Administrador podem ver todos; outros veem apenas o próprio

### Proteção de Dados

- ✅ **Sem chaves de API no frontend**: Todas as chaves (Resend, etc.) ficam exclusivamente no backend
- ✅ **Sem senhas no código**: Senhas são gerenciadas pelo PocketBase (bcrypt)
- ✅ **Tokens JWT**: Autenticação via JWT com expiração automática
- ✅ **`.gitignore`**: Protege `.env`, `pb_data/`, backups e arquivos sensíveis
- ✅ **Validação server-side**: Hooks validam dados antes de salvar
- ✅ **Impossibilidade de auto-elevação**: Operadores não podem alterar própria role

### Variáveis Sensíveis

| Variável | Onde configurar | Descrição |
|---|---|---|
| `RESEND_API_KEY` | PocketBase Secrets | Chave da API do Resend |
| `RESEND_FROM_EMAIL` | PocketBase Secrets | E-mail remetente |
| `SITE_URL` | PocketBase Secrets | URL do frontend |

> Nenhuma variável sensível deve ser exposta no frontend. Apenas `VITE_POCKETBASE_URL` é necessária no frontend.

---

## Estrutura do Projeto

```
.
├── src/                          # Frontend
│   ├── components/               # Componentes reutilizáveis
│   │   ├── ui/                   # Componentes Shadcn/UI
│   │   ├── Layout.tsx            # Layout principal (sidebar + header)
│   │   ├── ClientCard.tsx
│   │   ├── PolicyFormDialog.tsx
│   │   └── ...
│   ├── pages/                    # Páginas da aplicação
│   │   ├── Dashboard.tsx
│   │   ├── Clients.tsx
│   │   ├── Policies.tsx
│   │   ├── Financial.tsx
│   │   └── ...
│   ├── hooks/                    # Hooks customizados
│   │   ├── use-auth.tsx          # Autenticação
│   │   ├── use-realtime.ts       # Real-time SSE
│   │   ├── use-permissions.ts    # Permissões
│   │   └── use-mobile.tsx        # Detecção mobile
│   ├── services/                 # Serviços (API calls)
│   │   ├── clients.ts
│   │   ├── policies.ts
│   │   ├── payments.ts
│   │   └── ...
│   ├── lib/                      # Utilitários e configurações
│   │   ├── pocketbase/           # Cliente PocketBase + schema
│   │   ├── utils.ts              # Funções utilitárias
│   │   ├── constants.ts          # Constantes (estados, templates)
│   │   └── ...
│   ├── types/                    # Tipos TypeScript
│   ├── App.tsx                   # Rotas
│   ├── main.tsx                  # Entry point
│   └── main.css                  # Estilos globais
├── pocketbase/                   # Backend
│   ├── migrations/               # 24 migrations
│   └── hooks/                    # 12 hooks JavaScript
├── public/                       # Arquivos estáticos
├── .env.example                  # Template de variáveis
├── Dockerfile                    # Docker do frontend
├── Dockerfile.pocketbase         # Docker do backend
├── docker-compose.yml            # Orquestração completa
├── package.json                  # Dependências e scripts
├── pnpm-lock.yaml                # Lockfile
├── tailwind.config.ts            # Configuração Tailwind
├── vite.config.ts                # Configuração Vite
└── tsconfig.json                 # Configuração TypeScript
```

---

## Serviços Externos

### Resend (E-mail)

- **Uso**: Envio de comunicações e e-mails em massa
- **Como configurar**:
  1. Criar conta em [resend.com](https://resend.com)
  2. Obter API Key
  3. Configurar como secret `RESEND_API_KEY` no PocketBase
  4. O hook `send_mass_email.js` usa `$secrets.get('RESEND_API_KEY')` para autenticar
- **Sem o Resend**: O sistema funciona normalmente, mas o envio de e-mails em massa não estará disponível

### Sem outros serviços externos

O sistema não depende de nenhum outro serviço externo para funcionar. Tudo é autossuficiente com PocketBase + Frontend.

---

## Resolução de Problemas

### O frontend não conecta ao PocketBase

1. Verifique se o PocketBase está rodando: `curl http://127.0.0.1:8090/api/health`
2. Verifique o `.env`: `VITE_POCKETBASE_URL` deve apontar para o PocketBase
3. Verifique CORS: o PocketBase permite todas as origens por padrão

### Migrations não aplicam

```bash
./pocketbase migrate up
# Verificar status
./pocketbase migrate status
```

### Hooks não carregam

1. Verifique se os hooks estão em `pb_hooks/` (não `pocketbase/hooks/`)
2. Reinicie o PocketBase
3. Verifique logs: `./pocketbase serve --debug`

### Erro de permissão (403)

- Verifique se o usuário tem a role correta
- Admin/Administrador têm acesso total
- Operadores têm acesso limitado

### Real-time não funciona

- O PocketBase usa SSE nativo — não requer configuração extra
- Verifique se não há proxy bloqueando SSE
- Com Nginx, adicione: `proxy_set_header Connection ''; proxy_buffering off;`

---

## Dependência da Plataforma Skip

Este projeto **não possui nenhuma dependência exclusiva** da plataforma Skip ou Adapta. Todos os componentes são padrão:

- **Frontend**: React + Vite + TypeScript + Tailwind + Shadcn/UI (100% padrão)
- **Backend**: PocketBase v0.36 (100% padrão)
- **E-mail**: Resend API (serviço externo independente)
- **Banco de dados**: SQLite (embutido no PocketBase)

O sistema pode ser instalado e executado em qualquer infraestrutura: VPS, Docker, Railway, Render, Hostinger, etc.

---

## Licença

Este projeto é propriedade do contratante. Todas as dependências de código aberto mantêm suas respectivas licenças (MIT, Apache 2.0, ISC, BSD, etc.).

---

**CRED10MIX** — Gestão de Seguros Automatizada
