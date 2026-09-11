# Study App

Aplicação web responsiva para registrar e acompanhar atividades de estudo pelo computador, tablet ou celular.

## Aplicação online

Acesse a versão publicada em: [cadernoestudos.vercel.app](https://cadernoestudos.vercel.app)

## Funcionalidades atuais

- Cadastro e remoção de disciplinas.
- Acesso com e-mail e senha ou conta Google.
- Cadastro de conta e recuperação de senha por e-mail.
- Calendário mensal com os registros de cada dia.
- Cadastro, edição e remoção de registros de estudo.
- Registro de tempo de estudo.
- Classificação entre teoria e exercícios.
- Anotações sobre o conteúdo estudado.
- Resumo mensal e semanal.

## Executar localmente

### Requisitos

- Node.js 22 ou superior.
- pnpm.

### Passos

```bash
git clone https://github.com/vinalmeida/study-app.git
cd study-app
pnpm dev
```

Depois, acesse `http://localhost:5173` no navegador.

Crie um arquivo `.env.local` a partir de `.env.example` e informe a URL e a chave
pública (`anon`) do projeto Supabase. O banco deve receber a migration presente
em `supabase/migrations`.

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
ou e-mail e senha, recuperação de acesso e isolamento dos registros por usuário.
