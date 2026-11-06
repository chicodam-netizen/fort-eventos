from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Grupo Forte - Gestão de Eventos"
    DEBUG: bool = False

    # Formato: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
    DATABASE_URL: str = "postgresql://fort_eventos:fort_eventos@localhost:5433/fort_eventos"

    FRONTEND_URL: str = "http://localhost:5174"

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 10

    GEOCODER_USER_AGENT: str = "GrupoForte-GestaoEventos/1.0"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

if not settings.JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY não definido no .env")
