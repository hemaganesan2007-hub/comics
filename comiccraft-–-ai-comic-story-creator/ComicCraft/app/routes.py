"""
FastAPI Routes Module.
Handles form endpoints, JSON API, image testing, preview rendering, and PDF downloads.
"""

import os
import uuid
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Request, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from app.gemini_flash import generate_outline
from app.gemini_pro import generate_story
from app.image_generator import generate_image
from app.layout_builder import build_comic_layout
from app.exporters import save_pdf

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure template path relative to base directory
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
EXPORTS_DIR = BASE_DIR / "static" / "exports"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


# Pydantic schemas for JSON API
class PromptRequest(BaseModel):
    story_prompt: str = Field(..., description="Creative story premise", min_length=2)
    character_name: str = Field(..., description="Protagonist name", min_length=1)
    setting: str = Field("Forest", description="Setting (e.g. Forest, School, Space, City)")
    tone: str = Field("Dramatic", description="Tone (e.g. Light-hearted, Dramatic, Poetic, Funny)")
    art_style: str = Field("Anime", description="Art Style (e.g. Anime, Pixel Art, Comic Book, Realistic)")


class ComicResponse(BaseModel):
    success: bool
    layout: List[Dict[str, Any]]
    pdf_path: str
    generation_id: str


@router.get("/", response_class=HTMLResponse)
async def get_homepage(request: Request):
    """Renders the ComicCraft homepage creation form."""
    return templates.TemplateResponse("index.html", {"request": request})


@router.post("/generate", response_class=HTMLResponse)
async def generate_comic_form(
    request: Request,
    story_prompt: str = Form(...),
    character_name: str = Form(...),
    setting: str = Form(...),
    tone: str = Form(...),
    art_style: str = Form(...)
):
    """
    Primary browser form generation route.
    Validates input, calls Gemini Flash outline, Gemini Pro story expansion,
    Diffusers image generation for 5 panels, layout builder, and PDF exporter.
    """
    clean_prompt = story_prompt.strip()
    clean_char = character_name.strip()

    if not clean_prompt or not clean_char:
        raise HTTPException(
            status_code=400,
            detail="Story prompt and Character Name cannot be blank."
        )

    generation_id = uuid.uuid4().hex[:8]

    try:
        # Step 1: Gemini Flash 5-panel outline
        outline = generate_outline(
            story_prompt=clean_prompt,
            character_name=clean_char,
            setting=setting,
            tone=tone,
            art_style=art_style
        )

        # Step 2: Gemini Pro rich dialogue and narration
        story = generate_story(
            outline=outline,
            story_prompt=clean_prompt,
            character_name=clean_char,
            setting=setting,
            tone=tone,
            art_style=art_style
        )

        # Step 3: Generate 5 panel illustrations
        images = []
        for panel in outline:
            p_num = panel.get("panel_number", len(images) + 1)
            img_prompt = panel.get("image_prompt", f"{clean_char} in {setting}, {art_style} style")
            img_path = generate_image(img_prompt, panel_number=p_num, generation_id=generation_id)
            images.append(img_path)

        # Step 4: Assemble comic layout
        layout = build_comic_layout(outline, story, images)

        # Step 5: Export to multi-page PDF
        pdf_path = save_pdf(
            layout=layout,
            story_prompt=clean_prompt,
            character_name=clean_char,
            setting=setting,
            tone=tone,
            art_style=art_style,
            generation_id=generation_id
        )

        return templates.TemplateResponse(
            "comic_preview.html",
            {
                "request": request,
                "layout": layout,
                "story_prompt": clean_prompt,
                "character_name": clean_char,
                "setting": setting,
                "tone": tone,
                "art_style": art_style,
                "pdf_path": pdf_path,
                "generation_id": generation_id
            }
        )

    except Exception as exc:
        logger.exception("Error generating comic: %s", str(exc))
        raise HTTPException(status_code=500, detail=f"Comic generation encountered an issue: {str(exc)}")


@router.post("/generate-comic/json", response_model=ComicResponse)
async def generate_comic_json(req: PromptRequest):
    """
    JSON API endpoint for programmatic comic creation.
    Returns success status, assembled 5-panel layout, and PDF download path.
    """
    clean_prompt = req.story_prompt.strip()
    clean_char = req.character_name.strip()
    generation_id = uuid.uuid4().hex[:8]

    try:
        outline = generate_outline(clean_prompt, clean_char, req.setting, req.tone, req.art_style)
        story = generate_story(outline, clean_prompt, clean_char, req.setting, req.tone, req.art_style)

        images = []
        for panel in outline:
            p_num = panel.get("panel_number", len(images) + 1)
            img_prompt = panel.get("image_prompt", f"{clean_char} in {req.setting}")
            img_path = generate_image(img_prompt, panel_number=p_num, generation_id=generation_id)
            images.append(img_path)

        layout = build_comic_layout(outline, story, images)
        pdf_path = save_pdf(
            layout=layout,
            story_prompt=clean_prompt,
            character_name=clean_char,
            setting=req.setting,
            tone=req.tone,
            art_style=req.art_style,
            generation_id=generation_id
        )

        return ComicResponse(
            success=True,
            layout=layout,
            pdf_path=pdf_path,
            generation_id=generation_id
        )
    except Exception as e:
        logger.exception("JSON API error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test-image")
@router.post("/test-image")
async def test_image_generation(
    prompt: Optional[str] = Query(None, description="Custom prompt to test image generation"),
    panel_number: int = Query(1, description="Panel index to simulate")
):
    """
    Developer utility route that directly tests image generation pipeline.
    """
    test_prompt = prompt or "Anime style comic panel: Finn the fox standing bravely in an enchanted glowing forest, vibrant colors"
    img_path = generate_image(test_prompt, panel_number=panel_number)
    return JSONResponse({
        "status": "success",
        "image_prompt": test_prompt,
        "panel_number": panel_number,
        "image_path": img_path
    })


@router.get("/export-success", response_class=HTMLResponse)
async def export_success(
    request: Request,
    pdf_path: Optional[str] = Query(None),
    generation_id: Optional[str] = Query(None)
):
    """Renders export confirmation with download link and return button."""
    return templates.TemplateResponse(
        "export_success.html",
        {
            "request": request,
            "pdf_path": pdf_path or "",
            "generation_id": generation_id or ""
        }
    )


@router.get("/download-pdf/{filename}")
async def download_pdf_file(filename: str):
    """Serves the generated PDF file as a downloadable browser attachment."""
    safe_name = os.path.basename(filename)
    file_path = EXPORTS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Requested PDF file not found.")

    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type="application/pdf"
    )
