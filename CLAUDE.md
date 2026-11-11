# CLAUDE.md — Grupo Forte · Gestão de Eventos

## Visão geral
Sistema para o Grupo Forte gerenciar **equipes, prestadores, materiais e custos por evento**
(shows, feiras, festivais — infraestrutura completa: elétrica, palco, banheiros químicos etc.).
Derivado do stack do projeto DELLUT, com identidade visual do CRM comercial do Grupo Forte
(`../COMERCIAL/poc-crm/app/public/style.css`: laranja #FF4700, preto, Montserrat).

**Situação atual:** em produção (POC) — https://fort-eventos.vercel.app · repo público github.com/chicodam-netizen/fort-eventos · Neon (Postgres, sa-east-1).
Ver seção "Produção". Fluxo obrigatório: commit local → revisão → push só com aprovação → confirmar deploy.

## Stack
| Camada | Tecnologia |
|---|---|
| Backend | FastAPI + SQLAlchemy 2.x + PostgreSQL |
| Frontend | React 19 + TypeScript + Vite + TanStack Query + Tailwind v4 + Leaflet (OpenStreetMap) |

## Como rodar (local)
```bash
# Backend — porta 8002 (o DELLUT usa 8001; não reutilizar)
cd backend
C:\Python314\python.exe -m uvicorn app.main:app --port 8002 --reload

# Frontend — porta 5174 (o DELLUT usa 5173)
cd frontend
npm run dev        # http://localhost:5174  (proxy /api → 8002)
```

## Banco local
| Item | Valor |
|---|---|
| Servidor | Postgres 17 nativo, serviço `postgresql-dellut-test`, porta **5433** (compartilhado com o teste do DELLUT) |
| Banco / usuário | `fort_eventos` / `fort_eventos` (próprios — não tocam no `dellut_test`) |
| Config | `backend/.env` (gitignored) |
| Seed fictício | `backend/seed_dados_teste.py` (`--recriar` apaga e recria tudo; trava: aborta se o banco não for localhost) |
| Logins de teste | `admin@teste.local`, `escritorio@teste.local`, `lider@teste.local` — senha `teste123` |

O schema é criado no startup (`create_tables()`); não há migrações ainda. Quando houver
banco em nuvem com dados reais, introduzir Alembic antes de qualquer mudança de schema.

## Produção (Vercel + Neon)
| Item | Como está |
|---|---|
| Hospedagem | **Um único projeto Vercel** na raiz do repo: `frontend/dist` estático + a API FastAPI como função Python em `api/index.py` (importa `backend/app`). `vercel.json` reescreve `/api/*` → função e o resto → `index.html`. |
| Dependências da função | `requirements.txt` da **raiz** (sem uvicorn). Local continua usando `backend/requirements.txt`. Manter as duas listas em sincronia. |
| Banco | Neon Postgres — usar a connection string **pooled** (host com `-pooler`). Em `VERCEL=1` o engine usa `NullPool` (`app/database.py`); `postgres://` é normalizado. |
| Variáveis na Vercel | `DATABASE_URL`, `JWT_SECRET_KEY` (novo, diferente do local), `APP_NAME`, `FRONTEND_URL` (URL pública), `GEOCODER_USER_AGENT`. |
| Preparar o banco | `backend/preparar_banco_nuvem.py` — cria tabelas e o 1º admin (lê `DATABASE_URL_NUVEM` ou `backend/.env.producao`, gitignored; recusa localhost; só aditivo). |
| Seed fictício | `seed_dados_teste.py` **nunca** em produção (aborta fora de localhost). Os dados ficam em `dados_demo.py` (sem usuários), compartilhado com a POC. |
| POC em produção | Desde 2026-11-10 o Neon tem os dados de demonstração (sem logins `teste123` — repo público). Carga: `carregar_poc_nuvem.py` (só aditiva). Limpeza ao fim da POC: `limpar_poc_nuvem.py` (sem flag = só mostra o plano; `--executar` pede frase de confirmação; apaga cadastros e não-admins, mantém admins) — mostrar o plano e ter confirmação explícita antes. |
| Scripts de nuvem | Todos usam `nuvem_util.py` (URL de `DATABASE_URL_NUVEM` ou `backend/.env.producao`; recusa localhost). |

Antes da primeira mudança de schema com dados reais no Neon: introduzir Alembic (baseline do schema atual).

## Modelo de domínio (regras que importam)
- **Evento**: período total da operação (`inicio`/`fim`, montagem → desmontagem) + período aberto
  ao público opcional; endereço + lat/long; status
  Planejado → Confirmado → Montagem → Em execução → Desmontagem → Concluído / Cancelado.
- **Equipe** pertence a um evento; pode nascer de uma **Equipe modelo** (composição por função)
  e é personalizável. A composição do modelo vira referência de vagas no quadro.
- **Alocação** = prestador numa equipe com **data e hora** de início e fim. Nunca se sobrescreve:
  - **Mover** (`POST /alocacoes/{id}/mover`): encerra a atual no momento da troca e abre outra na
    equipe destino (mesmo ou outro evento) com `origem_id`. Se ainda não começou, só transfere.
  - **Retirar**: encerra no momento informado; o período trabalhado fica no histórico e no custo.
  - **Excluir**: só para lançamento errado (líder só exclui alocação que ainda não começou).
  - **Conflito**: sobreposição com outra alocação do mesmo prestador → 409 com detalhes;
    o front oferece "mesmo assim" (`forcar=true`).
- **Custo de pessoas** (`services/custos.py`): diária por dia de calendário trabalhado; se no mesmo
  dia houve mais de uma alocação, a diária é **rateada pelas horas** de cada uma. Por hora: horas × valor.
  O valor é copiado do prestador para a alocação (editável pelo escritório).
- **Materiais**: cadastro com tipo (próprio/locado/consumível) e cobrança (unidade/diária).
  `qtd_propria` existe mas **ainda não é usada** — fase futura: alertar falta de material próprio
  entre eventos simultâneos.
- **Perfis**: Administrador (tudo + usuários) · Escritório (operação completa) ·
  Líder (vinculado a um prestador; vê só eventos onde esse prestador lidera equipe; aloca, move e
  retira nesses eventos; **não vê valores**). Regras em `services/alocacoes.py`.

## Convenções
- Backend: routers por domínio em `app/routers/` (registrar em `__init__.py` e `main.py`);
  schemas em `app/schemas.py`; regras de negócio em `app/services/`.
- Datas: horário local de Brasília **sem fuso** no banco (`services/tempo.py`).
- Frontend: chamadas HTTP só em `src/api.ts`; páginas em `src/pages/`; componentes do evento em
  `src/components/evento/`. Estilos em `src/index.css` (classes no padrão do CRM).
- Parâmetros de lista em GET no FastAPI precisam de `Query(None)` (senão viram corpo).
- Geocodificação: `GET /api/geo/buscar` faz proxy para o Nominatim (OSM) com User-Agent próprio;
  acionado só por botão (política de uso: ≤1 req/s).

## Próximos passos previstos
1. Controle de estoque de material próprio entre eventos simultâneos.
2. Integração com o CRM (proposta fechada → evento com orçamento; `numero_projeto` já existe).
3. Alembic antes de qualquer mudança de schema em produção.
