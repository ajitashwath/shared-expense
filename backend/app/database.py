from prisma import Prisma
from contextlib import asynccontextmanager
prisma = Prisma()

async def get_db() -> Prisma:
    return prisma

async def connect_db():
    await prisma.connect()

async def disconnect_db():
    if prisma.is_connected():
        await prisma.disconnect()