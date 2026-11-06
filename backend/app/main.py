from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.routers import auth_router, cadastros_router, eventos_router, painel_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Gestão de equipes, prestadores, materiais e custos por evento — Grupo Forte",
    version="0.1.0",
    lifespan=lifespan,
)

_allow_origins = ["http://localhost:5174"]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in _allow_origins:
    _allow_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cadastros_router)
app.include_router(eventos_router)
app.include_router(painel_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
