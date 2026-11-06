from datetime import datetime
from zoneinfo import ZoneInfo

FUSO = ZoneInfo("America/Sao_Paulo")


def agora() -> datetime:
    """Horário local de Brasília sem fuso (todas as datas do sistema são horário local)."""
    return datetime.now(FUSO).replace(tzinfo=None, microsecond=0)


def sem_fuso(dt: datetime | None) -> datetime | None:
    """Normaliza datas recebidas da API: converte para horário de Brasília e remove o fuso."""
    if dt is None or dt.tzinfo is None:
        return dt
    return dt.astimezone(FUSO).replace(tzinfo=None)
