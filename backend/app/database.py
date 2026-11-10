import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings


def _url(url: str) -> str:
    # Neon/Heroku às vezes entregam "postgres://", que o SQLAlchemy 2 não aceita.
    return "postgresql://" + url[len("postgres://"):] if url.startswith("postgres://") else url


if os.getenv("VERCEL"):
    # Função serverless: sem pool próprio (cada instância é efêmera); o pooler do Neon
    # (host com "-pooler") faz o reaproveitamento de conexões.
    engine = create_engine(_url(settings.DATABASE_URL), echo=settings.DEBUG, poolclass=NullPool, pool_pre_ping=True)
else:
    engine = create_engine(
        _url(settings.DATABASE_URL),
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    import app.models  # noqa: F401  (registra os modelos no metadata)
    Base.metadata.create_all(bind=engine)
