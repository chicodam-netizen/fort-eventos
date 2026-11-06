from app.routers.auth import router as auth_router
from app.routers.cadastros import router as cadastros_router
from app.routers.eventos import router as eventos_router
from app.routers.painel import router as painel_router

__all__ = ["auth_router", "cadastros_router", "eventos_router", "painel_router"]
