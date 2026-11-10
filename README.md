# Study App

Aplicação web responsiva para registrar e acompanhar atividades de estudo pelo computador, tablet ou celular.

## Aplicação online

Acesse a versão publicada em: [cadernoestudos.vercel.app](https://cadernoestudos.vercel.app)

## Funcionalidades atuais

- Cadastro, edição e remoção de disciplinas.
- Acesso com conta Google.
- Calendário mensal com os registros de cada dia.
- Cadastro, edição e remoção de registros de estudo.
- Registro de tempo de estudo com horário de início em horas e minutos.
- Classificação entre teoria e exercícios.
- Anotações sobre o conteúdo estudado.
- Resumo mensal e semanal.

## Executar localmente

### Requisitos

- Node.js 22 ou superior.
- pnpm.
- Um projeto Supabase com o provedor Google ativado.

### Passos

```bash
git clone https://github.com/vinalmeida/study-app.git
cd study-app
pnpm install
```

Crie um arquivo `.env.local` na raiz com a URL e a chave pública (`anon`) do projeto
Supabase (*Project Settings → API*):

```bash
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon>
```

E rode:

```bash
pnpm dev
```

Depois, acesse `http://127.0.0.1:5173` no navegador.

### Configuração do Supabase

- Aplique, em ordem, todas as migrations de `supabase/migrations` (pelo SQL Editor
  ou com `supabase db push`).
- Ative o provedor Google em *Authentication → Sign In / Providers* e deixe o
  provedor Email desativado: o app só oferece acesso com Google.
- Inclua `http://127.0.0.1:5173` em *Authentication → URL Configuration → Redirect
  URLs*. Sem isso, o login com Google volta para o endereço publicado em vez do
  ambiente local.

Rodando localmente com o `.env.local` da versão publicada, o app usa o mesmo banco
de produção: o que for criado ou apagado no teste afeta os dados reais.

## Gerar a versão de produção

```bash
pnpm build
```

## Tecnologias

- HTML, CSS, JavaScript e Vite.
- Supabase Auth, Postgres e Row Level Security.
- Vercel para build, CDN e hospedagem.

## Status

Em desenvolvimento. A versão atual contém calendário, histórico, acesso com Google
e isolamento dos registros por usuário.
