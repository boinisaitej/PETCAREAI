from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from app.database import create_tables
from app.routers import auth, pets, logs, medical, ai_features, community, realtime, vet
from app.routers import vet_chat, care, finance

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    os.makedirs(os.getenv("UPLOAD_DIR", "uploads"), exist_ok=True)
    yield

app = FastAPI(
    title="PetCare AI - Pet Operating System",
    description="AI-powered platform for pet health tracking, vet collaboration, and emergency response",
    version="1.0.0",
    lifespan=lifespan,
)

# Comma-separated list of allowed frontend origins, e.g.
# FRONTEND_ORIGINS=https://petcare.vercel.app,http://localhost:3000
_origins = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Browsers reject wildcard origins combined with credentials; auth uses
    # Bearer headers (not cookies), so credentials are only enabled for an
    # explicit origin list.
    allow_credentials=_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return validation errors as a plain string so React can render them directly."""
    messages = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err["loc"] if loc != "body")
        msg   = err["msg"].replace("Value error, ", "")
        messages.append(f"{field}: {msg}" if field else msg)
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})

upload_dir = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

app.include_router(auth.router)
app.include_router(pets.router)
app.include_router(logs.router)
app.include_router(medical.router)
app.include_router(ai_features.router)
app.include_router(community.router)
app.include_router(realtime.router)
app.include_router(vet.router)
app.include_router(vet_chat.router)
app.include_router(care.router)
app.include_router(finance.router)


@app.get("/")
def root():
    return {
        "app": "PetCare AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
