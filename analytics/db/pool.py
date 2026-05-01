"""Global asyncpg connection pool — imported by routes to avoid circular imports."""
import asyncpg

_pool: asyncpg.Pool | None = None


def set_pool(pool: asyncpg.Pool) -> None:
    global _pool
    _pool = pool


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised")
    return _pool
