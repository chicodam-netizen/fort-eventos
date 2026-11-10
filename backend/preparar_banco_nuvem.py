"""Prepara o banco em nuvem (Neon): cria as tabelas e o primeiro administrador.

Operação só ADITIVA: create_all não altera nem apaga tabelas existentes, e o admin só é
criado se o e-mail ainda não existir. Não carrega nenhum dado fictício.

A connection string é lida, nesta ordem, de:
  1. variável de ambiente DATABASE_URL_NUVEM
  2. arquivo backend/.env.producao (linha DATABASE_URL=...)  — gitignored

Uso (na pasta backend):
  python preparar_banco_nuvem.py                    # tabelas + pergunta os dados do admin
  python preparar_banco_nuvem.py --somente-tabelas  # só cria/confere as tabelas
"""
import getpass
import os
import re
import sys

from dotenv import dotenv_values

AQUI = os.path.dirname(os.path.abspath(__file__))


def _url_nuvem() -> str:
    url = os.getenv("DATABASE_URL_NUVEM") or dotenv_values(os.path.join(AQUI, ".env.producao")).get("DATABASE_URL")
    if not url:
        sys.exit("Defina DATABASE_URL_NUVEM ou crie backend/.env.producao com DATABASE_URL=<connection string do Neon>.")
    if re.search(r"@(localhost|127\.0\.0\.1)[:/]", url):
        sys.exit("Esta connection string aponta para o banco LOCAL. Use a do Neon.")
    return url


def _mascarar(url: str) -> str:
    return re.sub(r"://([^:]+):[^@]+@", r"://\1:****@", url)


url = _url_nuvem()
# Precisa estar no ambiente antes de importar o app (as variáveis têm prioridade sobre o .env local).
os.environ["DATABASE_URL"] = url
os.environ.setdefault("JWT_SECRET_KEY", "nao-usado-neste-script")
sys.path.insert(0, AQUI)

from app.auth import hash_senha  # noqa: E402
from app.database import SessionLocal, create_tables  # noqa: E402
from app.models import Usuario  # noqa: E402


def main() -> None:
    print(f"Banco: {_mascarar(url)}")
    create_tables()
    print("Tabelas criadas/conferidas.")
    if "--somente-tabelas" in sys.argv:
        return

    db = SessionLocal()
    try:
        print(f"Usuários já cadastrados: {db.query(Usuario).count()}")
        print("\nPrimeiro administrador")
        nome = input("  Nome: ").strip()
        email = input("  E-mail: ").strip().lower()
        if not nome or "@" not in email:
            sys.exit("Nome e e-mail válidos são obrigatórios.")
        if db.query(Usuario).filter(Usuario.email == email).first():
            sys.exit(f"Já existe um usuário com o e-mail {email}. Nada foi alterado.")
        senha = getpass.getpass("  Senha (mín. 8 caracteres, não aparece na tela): ")
        if len(senha) < 8:
            sys.exit("Senha muito curta.")
        if getpass.getpass("  Repita a senha: ") != senha:
            sys.exit("As senhas não conferem.")
        db.add(Usuario(nome=nome, email=email, senha_hash=hash_senha(senha), perfil="Administrador", ativo=True))
        db.commit()
        print(f"\nAdministrador {email} criado.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
