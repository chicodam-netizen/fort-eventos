"""Popula o banco LOCAL com dados fictícios para demonstração e testes.

Uso:
    C:\Python314\python.exe seed_dados_teste.py            # só popula se o banco estiver vazio
    C:\Python314\python.exe seed_dados_teste.py --recriar  # apaga TODAS as tabelas e recria (somente banco local)

Trava: aborta se DATABASE_URL não apontar para localhost/127.0.0.1.
Os dados em si estão em dados_demo.py (compartilhado com a carga da POC em nuvem).
"""
import sys

from app.config import settings

if not any(h in settings.DATABASE_URL for h in ("@localhost", "@127.0.0.1")):
    sys.exit("ABORTADO: DATABASE_URL não é um banco local. Este seed só roda em banco local de teste.")

from app.auth import hash_senha  # noqa: E402
from app.database import Base, SessionLocal, create_tables, engine  # noqa: E402
from app.models import Usuario  # noqa: E402
from app.services.tempo import agora  # noqa: E402
from dados_demo import popular  # noqa: E402


def main() -> None:
    if "--recriar" in sys.argv:
        import app.models  # noqa: F401
        Base.metadata.drop_all(bind=engine)
    create_tables()
    db = SessionLocal()
    if db.query(Usuario).count():
        sys.exit("O banco já tem dados. Use --recriar para apagar e popular de novo.")

    P = popular(db, agora().date())

    senha = hash_senha("teste123")
    db.add_all([
        Usuario(nome="Administrador (teste)", email="admin@teste.local", senha_hash=senha, perfil="Administrador"),
        Usuario(nome="Ana Escritório (teste)", email="escritorio@teste.local", senha_hash=senha, perfil="Escritório"),
        Usuario(nome="Carlos Eduardo Lima", email="lider@teste.local", senha_hash=senha, perfil="Líder",
                prestador_id=P["Carlos Eduardo Lima"].id),
    ])
    db.commit()
    db.close()
    print("Seed concluído. Logins (senha teste123): admin@teste.local · escritorio@teste.local · lider@teste.local")


if __name__ == "__main__":
    main()
