"""Conjunto de dados de DEMONSTRAÇÃO (fictícios), sem usuários.

Usado por seed_dados_teste.py (banco local) e por carregar_poc_nuvem.py (POC em produção).
As datas são relativas a `hoje`, para sempre haver eventos em andamento.
"""
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models import (
    Alocacao, CustoExtra, Equipe, EquipeModelo, EquipeModeloItem, Evento, Funcao, Material, MaterialEvento,
    Prestador,
)


def popular(db: Session, hoje: date, responsavel_id: str | None = None) -> dict[str, Prestador]:
    """Insere funções, prestadores, materiais, modelos, eventos, equipes, alocações e custos.

    Não faz commit. Devolve os prestadores por nome (para vincular usuários Líder).
    """
    HOJE = hoje

    def dt(dias: int, hora: int = 7, minuto: int = 0) -> datetime:
        return datetime.combine(HOJE + timedelta(days=dias), time(hora, minuto))

    # ── Funções ──────────────────────────────────────────────────────────────
    funcoes_def = [
        ("Supervisor de campo", 550), ("Eletricista líder", 450), ("Eletricista", 320),
        ("Auxiliar de elétrica", 200), ("Encanador", 300), ("Auxiliar de limpeza", 170),
        ("Montador de estrutura", 280), ("Técnico de som", 400), ("Operador de gerador", 300),
        ("Motorista", 250), ("Auxiliar geral", 180),
    ]
    F = {}
    for nome, v in funcoes_def:
        F[nome] = Funcao(nome=nome, valor_diaria_ref=v)
        db.add(F[nome])
    db.flush()

    # ── Prestadores ──────────────────────────────────────────────────────────
    P: dict[str, Prestador] = {}

    def prest(nome, funcao, vinculo="Diarista", valor=None, forma="diaria", empresa=None, cidade="São Paulo", uf="SP", status="Ativo"):
        p = Prestador(
            nome=nome, funcao_id=F[funcao].id, tipo_vinculo=vinculo, empresa=empresa, cidade=cidade, uf=uf,
            forma_custo=forma, valor_custo=valor if valor is not None else F[funcao].valor_diaria_ref,
            telefone="(11) 9" + str(abs(hash(nome)) % 10**8).zfill(8)[:4] + "-" + str(abs(hash(nome)) % 10**4).zfill(4),
            status=status,
        )
        db.add(p)
        P[nome] = p
        return p

    prest("Ricardo Moura", "Supervisor de campo", "CLT", 520)
    prest("Juliana Prado", "Supervisor de campo", "CLT", 520, cidade="Goiânia", uf="GO")
    prest("Carlos Eduardo Lima", "Eletricista líder", "PJ", 480)
    prest("Fernanda Reis", "Eletricista líder", "MEI", 460, cidade="Florianópolis", uf="SC")
    for n in ["André Santos", "Bruno Costa", "Diego Almeida", "Eduardo Nunes", "Felipe Rocha", "Gustavo Pires"]:
        prest(n, "Eletricista")
    for n in ["Henrique Dias", "Igor Martins", "João Pedro Alves", "Lucas Ferreira"]:
        prest(n, "Auxiliar de elétrica")
    prest("Marcos Teixeira", "Encanador")
    prest("Paulo Henrique", "Encanador", cidade="Campinas")
    for n in ["Rosa Oliveira", "Sandra Melo", "Tânia Souza", "Vera Lúcia"]:
        prest(n, "Auxiliar de limpeza", "Terceirizado", 165, empresa="Limpa Bem Serviços Ltda.")
    for n in ["Wagner Batista", "Alex Ribeiro", "Caio Mendes", "Daniel Freitas", "Elias Gomes", "Fábio Cardoso", "Gilson Ramos", "Hugo Barros"]:
        prest(n, "Montador de estrutura", "Terceirizado", 270, empresa="Estrutura Forte Montagens")
    prest("Leandro Viana", "Técnico de som", "PJ", 55, forma="hora")
    prest("Otávio Lins", "Operador de gerador")
    prest("Sérgio Campos", "Operador de gerador", cidade="Ribeirão Preto")
    prest("Roberto Assis", "Motorista", "CLT", 240)
    prest("Nelson Prates", "Auxiliar geral", status="Inativo")
    db.flush()

    # ── Materiais ────────────────────────────────────────────────────────────
    M: dict[str, Material] = {}
    materiais_def = [
        ("ELE-001", "Refletor LED 400W", "Elétrica", "un", "proprio", "diaria", 18, 120),
        ("ELE-002", "Quadro de distribuição 125A", "Elétrica", "un", "proprio", "diaria", 95, 14),
        ("ELE-003", "Cabo PP 4x16mm (rolo 50m)", "Elétrica", "rl", "proprio", "diaria", 40, 60),
        ("ELE-004", "Extensão tripolar 20m", "Elétrica", "un", "proprio", "diaria", 6, 200),
        ("ELE-005", "Fita isolante e conectores (kit)", "Consumíveis", "kit", "consumivel", "unidade", 35, None),
        ("GER-001", "Gerador 180 kVA silenciado", "Geradores", "un", "locado", "diaria", 1450, None),
        ("GER-002", "Gerador 500 kVA silenciado", "Geradores", "un", "locado", "diaria", 3200, None),
        ("GER-003", "Diesel S10", "Consumíveis", "L", "consumivel", "unidade", 6.2, None),
        ("HID-001", "Caixa d'água 5.000 L", "Hidráulica", "un", "proprio", "diaria", 60, 12),
        ("HID-002", "Bomba pressurizadora", "Hidráulica", "un", "proprio", "diaria", 45, 10),
        ("BAN-001", "Banheiro químico standard", "Banheiros", "un", "locado", "diaria", 85, None),
        ("BAN-002", "Banheiro químico PCD", "Banheiros", "un", "locado", "diaria", 120, None),
        ("BAN-003", "Banheiro VIP container (4 cabines)", "Banheiros", "un", "proprio", "diaria", 650, 6),
        ("PAS-001", "Passa-cabo de borracha 1m", "Passa-cabos", "un", "proprio", "diaria", 3, 400),
        ("PAL-001", "Palco modular 12x10m", "Palco e estruturas", "un", "proprio", "diaria", 2800, 3),
        ("PAL-002", "Grid de alumínio Q30 (m)", "Palco e estruturas", "m", "proprio", "diaria", 22, 600),
        ("PAL-003", "Gradil de contenção 2m", "Palco e estruturas", "un", "locado", "diaria", 9, None),
        ("PAL-004", "Tenda pirâmide 10x10m", "Palco e estruturas", "un", "proprio", "diaria", 380, 20),
        ("SOM-001", "Sistema de PA line array (kit)", "Iluminação e som", "kit", "locado", "diaria", 4200, None),
        ("CLI-001", "Climatizador evaporativo", "Climatização", "un", "locado", "diaria", 140, None),
        ("EPI-001", "Kit EPI (capacete, luva, óculos)", "EPI", "kit", "consumivel", "unidade", 75, None),
        ("FER-001", "Andaime tubular (módulo)", "Ferramentas", "un", "proprio", "diaria", 12, 80),
    ]
    for cod, nome, cat, un, tipo, cob, custo, qtd in materiais_def:
        M[cod] = Material(codigo=cod, nome=nome, categoria=cat, unidade=un, tipo=tipo, cobranca=cob, custo_unitario=custo, qtd_propria=qtd)
        db.add(M[cod])
    db.flush()

    # ── Equipes modelo ───────────────────────────────────────────────────────
    def modelo(nome, cor, desc, itens):
        m = EquipeModelo(nome=nome, cor=cor, descricao=desc)
        for fn, q in itens:
            m.itens.append(EquipeModeloItem(funcao_id=F[fn].id, quantidade=q))
        db.add(m)
        return m

    mod_ele = modelo("Elétrica padrão", "#FF4700", "Distribuição de energia e iluminação",
                     [("Eletricista líder", 1), ("Eletricista", 4), ("Auxiliar de elétrica", 2)])
    mod_ban = modelo("Hidráulica e banheiros", "#2B6CB0", "Abastecimento, banheiros químicos e limpeza",
                     [("Encanador", 1), ("Auxiliar de limpeza", 3)])
    mod_pal = modelo("Palco e estruturas", "#3A3A3A", "Montagem de palco, grid, tendas e gradis",
                     [("Supervisor de campo", 1), ("Montador de estrutura", 6)])
    mod_ger = modelo("Geradores", "#1E7F4F", "Operação de geradores 24h", [("Operador de gerador", 2)])
    db.flush()

    # ── Eventos ──────────────────────────────────────────────────────────────
    def evento(**kw):
        e = Evento(responsavel_id=responsavel_id, **kw)
        db.add(e)
        db.flush()
        return e

    horizonte = evento(
        numero_projeto="GF-2026-0141", nome="Festival Horizonte 2026", cliente="Horizonte Produções", tipo="Festival",
        status="Em execução", inicio=dt(-3, 6), fim=dt(3, 23), evento_inicio=dt(0, 14), evento_fim=dt(2, 23, 59),
        endereco="Av. Senador Teotônio Vilela, 261 — Interlagos", cidade="São Paulo", uf="SP",
        latitude=-23.7036, longitude=-46.6997,
        orcamento_pessoas=45000, orcamento_materiais=360000, orcamento_outros=20000,
        observacoes="3 palcos, área VIP e praça de alimentação.",
    )
    agro = evento(
        numero_projeto="GF-2026-0152", nome="Expo Agro Rio Verde", cliente="Sindicato Rural de Rio Verde", tipo="Feira",
        status="Montagem", inicio=dt(-1, 7), fim=dt(8, 20), evento_inicio=dt(3, 9), evento_fim=dt(7, 22),
        endereco="Parque de Exposições de Rio Verde", cidade="Rio Verde", uf="GO",
        latitude=-17.7923, longitude=-50.9192,
        orcamento_pessoas=35000, orcamento_materiais=210000, orcamento_outros=10000,
    )
    rodeio = evento(
        numero_projeto="GF-2026-0158", nome="Rodeio Interior Paulista", cliente="Associação Os Peões", tipo="Show",
        status="Confirmado", inicio=dt(12, 7), fim=dt(17, 22), evento_inicio=dt(14, 18), evento_fim=dt(16, 23, 59),
        endereco="Parque do Peão", cidade="Barretos", uf="SP", latitude=-20.5531, longitude=-48.5698,
        orcamento_pessoas=48000, orcamento_materiais=70000, orcamento_outros=9000,
    )
    reveillon = evento(
        numero_projeto="GF-2026-0163", nome="Réveillon Arena Sul", cliente="Arena Sul Eventos", tipo="Show",
        status="Confirmado", inicio=datetime(HOJE.year, 12, 27, 7), fim=datetime(HOJE.year + 1, 1, 2, 18),
        evento_inicio=datetime(HOJE.year, 12, 31, 20), evento_fim=datetime(HOJE.year + 1, 1, 1, 6),
        endereco="Beira-Mar Norte", cidade="Florianópolis", uf="SC", latitude=-27.5838, longitude=-48.5463,
        orcamento_pessoas=72000, orcamento_materiais=150000, orcamento_outros=35000,
        observacoes="Fora do estado: passagens e hotel para a equipe de SP.",
    )
    evento(
        nome="Convenção Grupo Alfa 2027", cliente="Grupo Alfa", tipo="Corporativo", status="Planejado",
        inicio=datetime(HOJE.year + 1, 2, 22, 8), fim=datetime(HOJE.year + 1, 2, 26, 20),
        endereco="Riocentro — Av. Salvador Allende, 6555", cidade="Rio de Janeiro", uf="RJ",
        latitude=-22.9776, longitude=-43.4117, orcamento_pessoas=30000, orcamento_materiais=45000,
    )
    mineirao = evento(
        numero_projeto="GF-2026-0119", nome="Show Estádio Mineirão", cliente="BH Live Entretenimento", tipo="Show",
        status="Concluído", inicio=dt(-30, 7), fim=dt(-26, 20), evento_inicio=dt(-28, 19), evento_fim=dt(-28, 23, 59),
        endereco="Av. Antônio Abrahão Caram, 1001", cidade="Belo Horizonte", uf="MG",
        latitude=-19.8659, longitude=-43.9711,
        orcamento_pessoas=40000, orcamento_materiais=90000, orcamento_outros=12000,
    )
    evento(
        nome="Corrida Noturna Curitiba", cliente="Run Sul", tipo="Esportivo", status="Cancelado",
        inicio=dt(5, 14), fim=dt(6, 4), cidade="Curitiba", uf="PR", latitude=-25.4284, longitude=-49.2733,
        observacoes="Cancelado pelo cliente (previsão de tempestade).",
    )

    # ── Equipes e alocações ──────────────────────────────────────────────────
    def equipe(ev, mod, nome=None, lider=None, ordem=0):
        e = Equipe(evento_id=ev.id, nome=nome or mod.nome, descricao=mod.descricao, cor=mod.cor, modelo_id=mod.id,
                   lider_id=P[lider].id if lider else None, ordem=ordem)
        db.add(e)
        db.flush()
        return e

    def aloca(eq, nome, ini, fim, origem=None, motivo=None):
        p = P[nome]
        a = Alocacao(equipe_id=eq.id, prestador_id=p.id, inicio=ini, fim=fim, funcao_id=p.funcao_id,
                     forma_custo=p.forma_custo, valor_custo=p.valor_custo, origem_id=origem.id if origem else None,
                     motivo_encerramento=motivo)
        db.add(a)
        db.flush()
        return a

    # Festival Horizonte (em execução)
    h_ele = equipe(horizonte, mod_ele, "Elétrica — Palco principal", "Carlos Eduardo Lima", 0)
    h_ban = equipe(horizonte, mod_ban, "Banheiros e hidráulica", "Marcos Teixeira", 1)
    h_pal = equipe(horizonte, mod_pal, "Palco e estruturas", "Ricardo Moura", 2)
    h_ger = equipe(horizonte, mod_ger, "Geradores", "Otávio Lins", 3)
    ini, fim = horizonte.inicio, horizonte.fim
    for n in ["Carlos Eduardo Lima", "André Santos", "Bruno Costa", "Diego Almeida", "Henrique Dias", "Igor Martins"]:
        aloca(h_ele, n, ini, fim)
    for n in ["Marcos Teixeira", "Rosa Oliveira", "Sandra Melo", "Tânia Souza"]:
        aloca(h_ban, n, ini, fim)
    for n in ["Ricardo Moura", "Wagner Batista", "Alex Ribeiro", "Daniel Freitas", "Elias Gomes"]:
        aloca(h_pal, n, ini, fim)
    # Movimentação dentro do evento: Caio saiu do palco ontem às 14h e foi reforçar a elétrica
    caio = aloca(h_pal, "Caio Mendes", ini, dt(-1, 14), motivo="Movido para Elétrica — Palco principal — reforço na montagem da iluminação")
    aloca(h_ele, "Caio Mendes", dt(-1, 14), fim, origem=caio)
    # Movimentação entre eventos: Fábio terminou o palco do Horizonte e foi hoje às 6h para a Expo Agro
    for n in ["Otávio Lins", "Sérgio Campos"]:
        aloca(h_ger, n, ini, fim)
    aloca(h_ele, "Leandro Viana", dt(0, 12), dt(2, 23, 59))  # técnico por hora

    # Expo Agro (montagem)
    a_ele = equipe(agro, mod_ele, "Elétrica — Pavilhões", "Juliana Prado", 0)
    a_pal = equipe(agro, mod_pal, "Tendas e estruturas", None, 1)
    for n in ["Juliana Prado", "Eduardo Nunes", "Felipe Rocha", "João Pedro Alves"]:
        aloca(a_ele, n, agro.inicio, agro.fim)
    fabio = aloca(h_pal, "Fábio Cardoso", ini, dt(0, 6), motivo="Movido para Tendas e estruturas · Expo Agro Rio Verde")
    aloca(a_pal, "Fábio Cardoso", dt(0, 6), agro.fim, origem=fabio)
    for n in ["Gilson Ramos", "Hugo Barros"]:
        aloca(a_pal, n, agro.inicio, agro.fim)

    # Rodeio (futuro) — equipe montada, parcialmente preenchida
    r_ele = equipe(rodeio, mod_ele, "Elétrica — Arena", "Carlos Eduardo Lima", 0)
    for n in ["Carlos Eduardo Lima", "André Santos", "Gustavo Pires"]:
        aloca(r_ele, n, rodeio.inicio, rodeio.fim)
    equipe(rodeio, mod_ger, "Geradores", None, 1)

    # Réveillon (futuro) — equipes criadas, sem pessoas ainda
    equipe(reveillon, mod_ele, "Elétrica — Orla", "Fernanda Reis", 0)
    equipe(reveillon, mod_ban, "Banheiros", None, 1)

    # Mineirão (concluído)
    m_ele = equipe(mineirao, mod_ele, "Elétrica", "Carlos Eduardo Lima", 0)
    m_pal = equipe(mineirao, mod_pal, "Palco", "Ricardo Moura", 1)
    for n in ["Carlos Eduardo Lima", "André Santos", "Bruno Costa", "Lucas Ferreira"]:
        aloca(m_ele, n, mineirao.inicio, mineirao.fim)
    for n in ["Ricardo Moura", "Wagner Batista", "Alex Ribeiro", "Caio Mendes"]:
        aloca(m_pal, n, mineirao.inicio, mineirao.fim)

    # ── Materiais por evento ─────────────────────────────────────────────────
    def mat(ev, cod, qtd, custo=None):
        db.add(MaterialEvento(evento_id=ev.id, material_id=M[cod].id, quantidade=qtd,
                              custo_unitario=custo if custo is not None else M[cod].custo_unitario))

    for cod, q in [("ELE-001", 80), ("ELE-002", 10), ("ELE-003", 40), ("PAS-001", 250), ("GER-002", 2), ("GER-001", 3),
                   ("GER-003", 6000), ("BAN-001", 120), ("BAN-002", 12), ("BAN-003", 2), ("HID-001", 6),
                   ("PAL-001", 2), ("PAL-002", 300), ("PAL-003", 400), ("SOM-001", 1), ("EPI-001", 30)]:
        mat(horizonte, cod, q)
    for cod, q in [("ELE-001", 40), ("ELE-002", 6), ("ELE-004", 80), ("GER-001", 2), ("GER-003", 2500),
                   ("PAL-004", 14), ("BAN-001", 50), ("CLI-001", 20)]:
        mat(agro, cod, q)
    for cod, q in [("ELE-001", 30), ("GER-001", 2), ("BAN-001", 60)]:
        mat(rodeio, cod, q)
    for cod, q in [("ELE-001", 50), ("PAL-001", 1), ("PAL-002", 180), ("GER-002", 1), ("BAN-001", 40), ("SOM-001", 1)]:
        mat(mineirao, cod, q)

    # ── Custos extras ────────────────────────────────────────────────────────
    db.add_all([
        CustoExtra(evento_id=horizonte.id, categoria="Alimentação", descricao="Marmitas equipe (7 dias)", data=HOJE - timedelta(days=3), valor=6720),
        CustoExtra(evento_id=horizonte.id, categoria="Transporte", descricao="Van traslado diário", data=HOJE - timedelta(days=3), valor=3150),
        CustoExtra(evento_id=horizonte.id, categoria="Frete", descricao="Caminhão munck — geradores", data=HOJE - timedelta(days=3), valor=4800),
        CustoExtra(evento_id=agro.id, categoria="Hospedagem", descricao="Hotel equipe SP (8 noites × 3)", data=HOJE - timedelta(days=1), valor=5760),
        CustoExtra(evento_id=agro.id, categoria="Transporte", descricao="Passagens aéreas SP–GO", data=HOJE - timedelta(days=2), valor=2940),
        CustoExtra(evento_id=mineirao.id, categoria="Alimentação", descricao="Alimentação equipe", data=HOJE - timedelta(days=30), valor=2400),
        CustoExtra(evento_id=mineirao.id, categoria="Hora extra", descricao="Desmontagem estendida madrugada", data=HOJE - timedelta(days=26), valor=1850),
    ])

    db.flush()
    return P
