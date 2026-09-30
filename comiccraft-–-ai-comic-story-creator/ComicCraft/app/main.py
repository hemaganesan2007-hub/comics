"""
FastAPI Main Application Entry Point.
Initializes ComicCraft app, mounts static assets, includes routes, and boots server.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routes import router

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
PANELS_DIR = STATIC_DIR / "panels"
EXPORTS_DIR = STATIC_DIR / "exports"

# Ensure all static persistence directories exist
PANELS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="ComicCraft – AI Comic Story Creator using Gemini Models",
    description="Transform your creative stories into 5-panel AI-illustrated comics with Gemini outline, dialogue, narration, Stable Diffusion artwork, and downloadable PDF.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Mount static files to serve images, CSS, and exported PDFs
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Register routes
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
