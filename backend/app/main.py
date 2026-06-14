import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.config import settings
from app.database import prisma
from app.routers import auth, groups, expenses, settlements, imports, balances, audit

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    except OSError as e:
        # Fall back to /tmp/uploads in read-only filesystems (e.g. Vercel)
        if e.errno == 30 or 'Read-only' in str(e):
            settings.UPLOAD_DIR = '/tmp/uploads'
            try:
                os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            except OSError:
                pass  # Ignore if it still fails since UPLOAD_DIR is not active in the import endpoints
        else:
            raise
    await prisma.connect()
    print(f'✅ Connected to database')
    yield
    if prisma.is_connected():
        await prisma.disconnect()
    print('✅ Disconnected from database')
app = FastAPI(title='Shared Expenses API', description='Event-sourced shared expense tracking for flatmates', version=settings.APP_VERSION, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(settlements.router)
app.include_router(imports.router)
app.include_router(balances.router)
app.include_router(audit.router)

@app.get('/health')
async def health():
    return {'status': 'ok', 'app': settings.APP_NAME, 'version': settings.APP_VERSION}

@app.get('/')
async def root():
    return {'message': 'Shared Expenses API', 'docs': '/docs', 'health': '/health'}