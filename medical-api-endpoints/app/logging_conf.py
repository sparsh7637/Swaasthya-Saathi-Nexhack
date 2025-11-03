from loguru import logger
import sys
from app.config import settings

logger.remove()
logger.add(
    sys.stderr,
    level=settings.LOG_LEVEL or "INFO",
    enqueue=True,
    backtrace=True,
    diagnose=False,
)
