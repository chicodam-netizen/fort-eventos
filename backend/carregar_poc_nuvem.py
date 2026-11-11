"""Carrega os dados de DEMONSTRAÇÃO (dados_demo.py) no banco em nuvem, para a POC.

Só acrescenta dados. Exige que já exista um Administrador ativo (vira o responsável dos
eventos) e que o banco ainda não tenha cadastros (aborta se houver funções ou eventos).
NÃO cria os usuários de teste com senha "teste123" (o repositório é público).

Uso (na pasta backend):
  python carregar_poc_nuvem.py             # carrega funções, prestadores, materiais, eventos etc.
  python carregar_poc_nuvem.py --usuarios  # cria usuários de demonstração (Escritório / Líder),
                                           # com senha digitada na hora (rodar no seu terminal)

Para remover tudo depois da POC: limpar_poc_nuvem.py
"""
import getpass
import sys

from nuvem_util import preparar_ambiente

preparar_ambiente()

from app.auth import hash_senha  # noqa: E402
from app.database import SessionLocal, create_tables  # noqa: E402
from app.models import Evento, Funcao, Prestador, Usuario  # noqa: E402
from app.services.tempo import agora  # noqa: E402
from dados_demo import popular  # noqa: E402


def carregar_dados() -> None:
    create_tables()
    db = SessionLocal()
    try:
        admin = (
            db.query(Usuario).filter(Usuario.perfil == "Administrador", Usuario.ativo.is_(True))
            .order_by(Usuario.criado_em).first()
        )
        if not admin:
            sys.exit("Nenhum Administrador ativo. Rode antes preparar_banco_nuvem.py.")
        if db.query(Funcao).count() or db.query(Evento).count():
            sys.exit("O banco já tem cadastros (funções ou eventos). Nada foi alterado.")
        popular(db, agora().date(), responsavel_id=admin.id)
        db.commit()
        print(f"Dados de demonstração carregados. Responsável pelos eventos: {admin.nome}.")
    finally:
        db.close()


def _criar_usuario(db, perfil: str, prestador_id: str | None = None) -> None:
    print(f"\nUsuário {perfil} para a POC")
    nome = input("  Nome: ").strip()
    email = input("  E-mail: ").strip().lower()
    if not nome or "@" not in email:
        print("  Nome e e-mail válidos são obrigatórios. Pulado.")
        return
    if db.query(Usuario).filter(Usuario.email == email).first():
        print(f"  Já existe um usuário com o e-mail {email}. Pulado.")
        return
    senha = getpass.getpass("  Senha (mín. 8 caracteres, não aparece na tela): ")
    if len(senha) < 8 or getpass.getpass("  Repita a senha: ") != senha:
        print("  Senha curta ou não confere. Pulado.")
        return
    db.add(Usuario(nome=nome, email=email, senha_hash=hash_senha(senha), perfil=perfil, prestador_id=prestador_id, ativo=True))
    db.commit()
    print(f"  {perfil} {email} criado.")


def criar_usuarios() -> None:
    db = SessionLocal()
    try:
        if input("\nCriar um usuário Escritório? [s/N] ").strip().lower() == "s":
            _criar_usuario(db, "Escritório")
        if input("\nCriar um usuário Líder (vinculado ao prestador Carlos Eduardo Lima)? [s/N] ").strip().lower() == "s":
            carlos = db.query(Prestador).filter(Prestador.nome == "Carlos Eduardo Lima").first()
            if not carlos:
                print("  Prestador Carlos Eduardo Lima não encontrado. Carregue os dados antes.")
            else:
                _criar_usuario(db, "Líder", carlos.id)
    finally:
        db.close()


if __name__ == "__main__":
    if "--usuarios" in sys.argv:
        criar_usuarios()
    else:
        carregar_dados()
