# Study App

Aplicação web para registrar e acompanhar atividades de estudo. Roda **localmente**
no computador, com os dados num arquivo SQLite e cópia automática para uma pasta
sincronizada na nuvem (por exemplo, o Google Drive).

## Funcionalidades atuais

- Cadastro, edição e remoção de disciplinas.
- Calendário mensal com os registros de cada dia.
- Cadastro, edição e remoção de registros de estudo.
- Registro de tempo de estudo com horário de início em horas e minutos.
- Classificação entre teoria e exercícios.
- Anotações sobre o conteúdo estudado.
- Histórico, estatísticas, resumo mensal e semanal e mapa de estudos.
- Backup automático do banco a cada alteração.

## Executar

### Requisitos

- Node.js 22.13 ou superior (usa o `node:sqlite` embutido).
- pnpm.

### Uso diário

```bash
pnpm install
pnpm start
```

Abra `http://127.0.0.1:5174`. O `pnpm start` gera o build e sobe o servidor local,
que serve o app e a API de dados. No Windows, o `start-study-app.bat` faz isso e
abre o navegador.

### Desenvolvimento

Em dois terminais:

```bash
pnpm server   # API e banco em http://127.0.0.1:5174
pnpm dev      # Vite em http://127.0.0.1:5173, com /api redirecionado ao servidor
```

### Dados e backup

- Banco: `data/caderno.db` (fora do Git).
- Cópias: `data/backups/` e, se `BACKUP_DIR` estiver definido no `.env.local`, também
  nessa pasta. Exemplo: `BACKUP_DIR=~/My Drive/Caderno de Estudos`.
- Cada pasta guarda `caderno-atual.db` e uma cópia por dia (últimos 30 dias).
- Para restaurar, pare o servidor e copie um desses arquivos para `data/caderno.db`.

### Importar um backup do Supabase

```bash
pnpm import-backup data/supabase-backup.gz
```

## Tecnologias

- HTML, CSS, JavaScript e Vite.
- Node.js (`node:http` e `node:sqlite`), sem dependências de produção.

## Histórico

Até outubro de 2026 o app usava Supabase (Auth e Postgres) e era publicado na Vercel.
Foi migrado para execução local para não depender de manutenção de produção.
