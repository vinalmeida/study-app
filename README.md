# Study App

Aplicação web responsiva para registrar e acompanhar atividades de estudo pelo computador, tablet ou celular.

## Funcionalidades atuais

- Cadastro e remoção de disciplinas.
- Calendário mensal com os registros de cada dia.
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

> O ambiente local utiliza dados demonstrativos mantidos apenas enquanto o servidor está em execução. A versão publicada utiliza armazenamento persistente e identifica cada usuário separadamente.

## Gerar a versão de produção

```bash
pnpm build
```

## Tecnologias

- HTML, CSS e JavaScript.
- Cloudflare Workers e D1.
- Codex Sites para hospedagem.

## Status

Em desenvolvimento. A versão atual contém a experiência principal de calendário; novas visualizações e documentação mais detalhada serão adicionadas progressivamente.
