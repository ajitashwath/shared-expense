from prisma import Prisma
from app.config import settings
from contextlib import asynccontextmanager

prisma = Prisma(datasource={"url": settings.DATABASE_URL})

async def get_db() -> Prisma:
    return prisma

async def connect_db():
    await prisma.connect()

async def disconnect_db():
    if prisma.is_connected():
        await prisma.disconnect()