"""Limpa o banco em nuvem depois da POC — operação DESTRUTIVA e irreversível.

Apaga TODOS os cadastros operacionais (eventos, equipes, alocações, materiais por evento,
custos extras, prestadores, materiais, funções, equipes modelo) e todos os usuários que NÃO
são Administrador (com seus registros de acesso). Mantém as tabelas e os Administradores.

Uso (na pasta backend):
  python limpar_poc_nuvem.py             # só mostra o plano (o que seria apagado); não altera nada
  python limpar_poc_nuvem.py --executar  # mostra o plano e pede a frase de confirmação

Antes de executar: mostrar o plano ao responsável e obter confirmação explícita.
"""
import sys

from nuvem_util import preparar_ambiente

preparar_ambiente()

from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402

CONFIRMACAO = "APAGAR DADOS DA POC"

# Ordem respeita as chaves estrangeiras (filhos antes dos pais).
PASSOS = [
    ("alocacoes", "DELETE FROM alocacoes"),
    ("materiais_evento", "DELETE FROM materiais_evento"),
    ("custos_extras", "DELETE FROM custos_extras"),
    ("equipes", "DELETE FROM equipes"),
    ("eventos", "DELETE FROM eventos"),
    ("equipes_modelo_itens", "DELETE FROM equipes_modelo_itens"),
    ("equipes_modelo", "DELETE FROM equipes_modelo"),
    ("logs_acesso (de não administradores)",
     "DELETE FROM logs_acesso WHERE usuario_id IN (SELECT id FROM usuarios WHERE perfil <> 'Administrador')"),
    ("usuarios (não administradores)", "DELETE FROM usuarios WHERE perfil <> 'Administrador'"),
    ("vínculo de prestador dos administradores", "UPDATE usuarios SET prestador_id = NULL WHERE prestador_id IS NOT NULL"),
    ("prestadores", "DELETE FROM prestadores"),
    ("materiais", "DELETE FROM materiais"),
    ("funcoes", "DELETE FROM funcoes"),
]


def plano(conn) -> None:
    print("\nSerá APAGADO:")
    for tabela in ("eventos", "equipes", "alocacoes", "materiais_evento", "custos_extras", "prestadores",
                   "materiais", "funcoes", "equipes_modelo", "equipes_modelo_itens"):
        print(f"  {tabela:22} {conn.execute(text(f'SELECT count(*) FROM {tabela}')).scalar():>6} registros")
    usuarios = conn.execute(text("SELECT nome, email, perfil FROM usuarios ORDER BY perfil, nome")).all()
    apagar = [u for u in usuarios if u.perfil != "Administrador"]
    manter = [u for u in usuarios if u.perfil == "Administrador"]
    print(f"  {'usuarios':22} {len(apagar):>6} (não administradores):")
    for u in apagar:
        print(f"      - {u.nome} <{u.email}> · {u.perfil}")
    print("\nSerá MANTIDO:")
    for u in manter:
        print(f"      - {u.nome} <{u.email}> · Administrador")
    print("  e a estrutura de todas as tabelas.")


def main() -> None:
    with engine.connect() as conn:
        plano(conn)
    if "--executar" not in sys.argv:
        print("\nNada foi alterado (modo plano). Para executar: python limpar_poc_nuvem.py --executar")
        return
    if input(f'\nPara confirmar, digite exatamente "{CONFIRMACAO}": ').strip() != CONFIRMACAO:
        sys.exit("Confirmação não confere. Nada foi alterado.")
    with engine.begin() as conn:  # transação única: ou apaga tudo, ou nada
        for nome, sql in PASSOS:
            n = conn.execute(text(sql)).rowcount
            print(f"  {nome}: {n}")
    print("\nLimpeza concluída.")


if __name__ == "__main__":
    main()
