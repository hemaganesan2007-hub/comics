"""
Unit and Integration Tests for ComicCraft Application.
Tests outline generation, story expansion, image creation, layout assembly,
PDF compilation, and FastAPI HTTP/JSON routes.
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.gemini_flash import generate_outline
from app.gemini_pro import generate_story
from app.image_generator import generate_image
from app.layout_builder import build_comic_layout
from app.exporters import save_pdf

client = TestClient(app)


def test_generate_outline_structure():
    """Verify outline generator produces exactly 5 sequential panels with required keys."""
    panels = generate_outline(
        story_prompt="A brave fox exploring an enchanted forest",
        character_name="Finn",
        setting="Forest",
        tone="Dramatic",
        art_style="Anime"
    )
    assert len(panels) == 5
    for idx, panel in enumerate(panels, start=1):
        assert panel["panel_number"] == idx
        assert "title" in panel and len(panel["title"]) > 0
        assert "scene_description" in panel and len(panel["scene_description"]) > 0
        assert "image_prompt" in panel and len(panel["image_prompt"]) > 0


def test_generate_story_structure():
    """Verify story expansion provides dialogue and narration for all 5 panels."""
    outline = generate_outline("Fox adventure", "Finn", "Forest", "Dramatic", "Anime")
    story = generate_story(outline, "Fox adventure", "Finn", "Forest", "Dramatic", "Anime")
    assert len(story) == 5
    for idx, s in enumerate(story, start=1):
        assert s["panel_number"] == idx
        assert "caption" in s
        assert "narration" in s
        assert "dialogue" in s
        assert "Finn" in s["dialogue"] or len(s["dialogue"]) > 0


def test_image_generator_output():
    """Verify image generator creates a valid image file and returns static path."""
    img_path = generate_image("Anime fox in glowing forest", panel_number=1, generation_id="test1234")
    assert img_path.startswith("/static/panels/")
    assert img_path.endswith(".png")

    # Verify physical file existence
    clean_path = img_path.lstrip("/")
    base_dir = Path(__file__).resolve().parent
    file_exists = (base_dir / clean_path).exists()
    assert file_exists is True


def test_layout_builder_order():
    """Verify layout builder combines 5 panels in exact sequence without reordering."""
    outline = generate_outline("Fox adventure", "Finn", "Forest", "Dramatic", "Anime")
    story = generate_story(outline, "Fox adventure", "Finn", "Forest", "Dramatic", "Anime")
    images = [f"/static/panels/test_{i}.png" for i in range(1, 6)]

    layout = build_comic_layout(outline, story, images)
    assert len(layout) == 5
    for i in range(5):
        assert layout[i]["panel_number"] == i + 1
        assert layout[i]["image_path"] == images[i]
        assert layout[i]["title"] == outline[i]["title"]


def test_pdf_exporter():
    """Verify PDF export compiles 5 panels and outputs valid .pdf file."""
    outline = generate_outline("Fox adventure", "Finn", "Forest", "Dramatic", "Anime")
    story = generate_story(outline, "Fox adventure", "Finn", "Forest", "Dramatic", "Anime")
    images = [generate_image("Test illustration", i, "pdftest") for i in range(1, 6)]
    layout = build_comic_layout(outline, story, images)

    pdf_url = save_pdf(
        layout=layout,
        story_prompt="Fox adventure in the woods",
        character_name="Finn",
        setting="Forest",
        tone="Dramatic",
        art_style="Anime",
        generation_id="pdftest"
    )
    assert pdf_url.startswith("/static/exports/")
    assert pdf_url.endswith(".pdf")

    base_dir = Path(__file__).resolve().parent
    pdf_file = base_dir / pdf_url.lstrip("/")
    assert pdf_file.exists()
    assert pdf_file.stat().st_size > 1000  # Non-empty PDF


def test_http_homepage():
    """Verify GET / returns 200 and loads ComicCraft homepage."""
    response = client.get("/")
    assert response.status_code == 200
    assert "COMICCRAFT" in response.text
    assert "Story Prompt" in response.text


def test_http_json_endpoint():
    """Verify POST /generate-comic/json returns JSON with success and 5 panels."""
    payload = {
        "story_prompt": "A brave fox exploring an enchanted forest",
        "character_name": "Finn",
        "setting": "Forest",
        "tone": "Dramatic",
        "art_style": "Anime"
    }
    response = client.post("/generate-comic/json", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["layout"]) == 5
    assert data["pdf_path"].endswith(".pdf")


def test_http_test_image_route():
    """Verify /test-image developer utility route."""
    response = client.get("/test-image?prompt=Cyberpunk+City&panel_number=2")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["image_path"].startswith("/static/panels/")


def test_empty_input_validation():
    """Verify form submission rejects blank input."""
    response = client.post("/generate", data={
        "story_prompt": "   ",
        "character_name": "Finn",
        "setting": "Forest",
        "tone": "Dramatic",
        "art_style": "Anime"
    })
    assert response.status_code == 400
