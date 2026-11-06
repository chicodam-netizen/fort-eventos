# CLAUDE.md — Grupo Forte · Gestão de Eventos

## Visão geral
Sistema para o Grupo Forte gerenciar **equipes, prestadores, materiais e custos por evento**
(shows, feiras, festivais — infraestrutura completa: elétrica, palco, banheiros químicos etc.).
Derivado do stack do projeto DELLUT, com identidade visual do CRM comercial do Grupo Forte
(`../COMERCIAL/poc-crm/app/public/style.css`: laranja #FF4700, preto, Montserrat).

**Situação atual: somente ambiente local.** O banco em nuvem e o deploy serão definidos depois.

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
3. Definir banco em nuvem e deploy (seguir o fluxo commit → revisão → push → confirmação).
