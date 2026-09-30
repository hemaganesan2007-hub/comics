# ComicCraft – AI Comic Story Creator using Gemini Models

ComicCraft is a complete, full-stack application that transforms any user story premise into a coherent 5-panel AI-generated comic. It leverages **Google Gemini Flash** for rapid, structured storyboard outlines, **Google Gemini Pro** for immersive dialogue, narration, and captions, **Hugging Face Diffusers with Stable Diffusion** (or stylized comic rendering) for panel illustrations, and **FPDF** for multi-page PDF compilation.

---

## Table of Contents

1. [Overview & Core Features](#overview--core-features)
2. [Architecture & Workflow](#architecture--workflow)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites & System Requirements](#prerequisites--system-requirements)
6. [Local Installation & Setup](#local-installation--setup)
   - [Windows Setup](#windows-setup)
   - [macOS / Linux Setup](#macos--linux-setup)
7. [Environment Configuration](#environment-configuration)
8. [Running the Application](#running-the-application)
9. [API Endpoints & Swagger Documentation](#api-endpoints--swagger-documentation)
   - [Sample JSON API Request & Response](#sample-json-api-request--response)
10. [Three Key Testing Scenarios](#three-key-testing-scenarios)
11. [PDF Export Process](#pdf-export-process)
12. [Running Tests](#running-tests)
13. [Troubleshooting](#troubleshooting)
14. [Future Roadmap](#future-roadmap)

---

## Overview & Core Features

- **Sequential 5-Panel Comic Generation**: Follows classic storytelling: Introduction, Discovery/Problem, Conflict, Climax, and Resolution.
- **Dual-Model Gemini Pipeline**:
  - **Gemini Flash (`gemini-3.8-flash`)**: High-speed, JSON-constrained storyboard outline generation.
  - **Gemini Pro**: Nuanced narrative prose, character dialogue bubbles, captions, and action tags.
- **Visual Art Generation with Stable Diffusion**:
  - Employs Hugging Face Diffusers (`runwayml/stable-diffusion-v1-5`) with caching and CUDA/MPS/CPU auto-detection.
  - Automatically adds style markers for **Anime**, **Pixel Art**, **Comic Book**, and **Realistic** aesthetics.
  - Built-in stylized fallback using Pillow so generations never fail if GPU resources are constrained.
- **Full PDF Export with FPDF**: Generates publication-ready multi-page comic PDFs with headers, proportional image sizing, and automatic page breaks.
- **Dual Interface Modes**:
  - **Interactive Web UI**: Built with Jinja2, semantic HTML, and comic-book styled CSS.
  - **RESTful JSON API**: Pydantic-validated endpoint for headless or automated integrations.
- **Developer Test Route**: Dedicated `/test-image` utility to test image prompts independently.

---

## Architecture & Workflow

```
[ User Input (Web Form or JSON API) ]
                 │
                 ▼
     [ FastAPI Orchestrator (routes.py) ]
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[ Gemini Flash ]    [ Gemini Pro ]
 (5-Panel Outline)   (Captions, Dialogue & Narration)
       │                   │
       └─────────┬─────────┘
                 ▼
    [ Image Generator (Diffusers / SD) ]
      (Generates 5 panel illustrations)
                 │
                 ▼
     [ Layout Builder (layout_builder.py) ]
   (Integrates order, story, text & imagery)
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[ Web Preview HTML ]  [ FPDF Exporter ]
(comic_preview.html)  (Multi-Page PDF in static/exports)
```

---

## Technology Stack

- **Backend Framework**: FastAPI (v0.110+)
- **ASGI Server**: Uvicorn
- **Templating**: Jinja2
- **Language Models**: Google Gemini (`@google/genai` / `google-genai` / `google-generativeai`)
- **Image Generation**: Hugging Face Diffusers, PyTorch, Transformers, Accelerate
- **Image Processing**: Pillow (PIL)
- **PDF Generation**: FPDF2
- **Data Validation**: Pydantic v2
- **Environment Management**: python-dotenv

---

## Project Structure

```
ComicCraft/
├── app/
│   ├── __init__.py           # Application package marker
│   ├── main.py               # FastAPI app initialization & static mounts
│   ├── routes.py             # Form, JSON, and test routes
│   ├── gemini_flash.py       # Outline generator (5 panels, JSON validation)
│   ├── gemini_pro.py         # Story expansion (dialogue, narration, captions)
│   ├── image_generator.py    # Diffusers Stable Diffusion pipeline & Pillow fallback
│   ├── layout_builder.py     # Combines story, images, and sequence
│   └── exporters.py          # FPDF multi-page PDF generation
├── templates/
│   ├── index.html            # ComicCraft creation homepage
│   ├── comic_preview.html    # Interactive 5-panel comic viewer
│   └── export_success.html   # PDF export confirmation & reset page
├── static/
│   ├── css/
│   │   └── style.css         # Comic-themed responsive stylesheet
│   ├── panels/               # Storage for generated panel images
│   ├── exports/              # Storage for timestamped comic PDFs
│   └── images/               # App icons and branding assets
├── test_app.py               # Comprehensive pytest test suite
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── requirements.txt          # Python dependency specifications
└── README.md                 # Complete documentation
```

---

## Prerequisites & System Requirements

- **Python**: Version 3.10, 3.11, or 3.12
- **RAM**: Minimum 8 GB (16 GB recommended if running Stable Diffusion on CPU/GPU)
- **GPU (Optional)**: NVIDIA GPU with CUDA support for accelerated image inference
- **Google Gemini API Key**: Free tier or paid key from [Google AI Studio](https://aistudio.google.com/)

---

## Local Installation & Setup

### Windows Setup

1. Open PowerShell or Command Prompt:
   ```cmd
   git clone <repo-url>
   cd ComicCraft
   ```

2. Create and activate a Python virtual environment:
   ```cmd
   python -m venv comiccraft-env
   comiccraft-env\Scripts\activate
   ```

3. Install required dependencies:
   ```cmd
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

### macOS / Linux Setup

1. Open your terminal:
   ```bash
   git clone <repo-url>
   cd ComicCraft
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python -m venv comiccraft-env
   source comiccraft-env/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

---

## Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your API keys and preferred settings:

```env
# Google Gemini API Key
GEMINI_API_KEY="your_gemini_api_key_here"

# Optional Hugging Face Token for private models
HF_API_KEY="your_huggingface_api_key_here"

# Stable Diffusion Model ID
STABLE_DIFFUSION_MODEL="runwayml/stable-diffusion-v1-5"

# Device override: 'cuda', 'mps', 'cpu', or 'auto'
SD_DEVICE="auto"

# Output image size
IMAGE_WIDTH=512
IMAGE_HEIGHT=512
NUM_INFERENCE_STEPS=25
```

---

## Running the Application

Run the server with Uvicorn:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Once started:
- **Homepage UI**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Swagger Interactive API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## API Endpoints & Swagger Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Renders the ComicCraft homepage creation form (`index.html`) |
| `POST` | `/generate` | Browser form submission generating comic & rendering `comic_preview.html` |
| `POST` | `/generate-comic/json` | REST API endpoint accepting JSON and returning structured comic layout & PDF URL |
| `GET` / `POST` | `/test-image` | Developer utility route to test prompt image rendering directly |
| `GET` | `/export-success` | Confirmation screen after PDF export (`export_success.html`) |
| `GET` | `/download-pdf/{filename}` | Direct browser attachment download for saved PDF files |

### Sample JSON API Request & Response

#### Request (`POST /generate-comic/json`)
```json
{
  "story_prompt": "A brave fox exploring an enchanted forest",
  "character_name": "Finn",
  "setting": "Forest",
  "tone": "Dramatic",
  "art_style": "Anime"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "generation_id": "a1b2c3d4",
  "pdf_path": "/static/exports/comic_20260930_120000_a1b2c3d4.pdf",
  "layout": [
    {
      "panel_number": 1,
      "title": "Into the Whispering Canopy",
      "caption": "CHAPTER I: THE DEEP WOODS",
      "narration": "Ancient mist blankets the emerald shadows of the forest.",
      "dialogue": "Finn: \"The elders warned of this place... but I must know the truth.\"",
      "scene_description": "Finn steps quietly into a glade illuminated by bioluminescent flora.",
      "image_prompt": "Anime style comic panel: Finn the fox standing alert in an enchanted forest...",
      "image_path": "/static/panels/panel_1_20260930_120000_a1b2c3d4.png"
    }
    // ... Panels 2 through 5
  ]
}
```

---

## Three Key Testing Scenarios

1. **Scenario 1 (Dramatic Anime Fox)**:
   - Prompt: `"A brave fox exploring an enchanted forest"`
   - Character: `Finn`, Setting: `Forest`, Tone: `Dramatic`, Art Style: `Anime`
   - Outcome: A tense, emotionally charged 5-panel anime comic with cinematic wide shots, suspenseful captions, and dramatic dialogue.

2. **Scenario 2 (Funny Comic Book Fox)**:
   - Change Tone to `Funny` and Art Style to `Comic Book`.
   - Outcome: The entire pipeline regenerates humorous dialogue, witty captions, comic action bubbles, and classic dot-halftone comic visuals.

3. **Scenario 3 (PDF Export & Confirmation Flow)**:
   - On `comic_preview.html`, click **"Download Your Comic as PDF"**.
   - Verifies sequential layout, proportional image scaling, word wrapping, and transitions to `export_success.html` with **"Go Create Another Comic"** navigation.

---

## PDF Export Process

1. Uses `FPDF2` in `app/exporters.py`.
2. Formatted for standard A4 pages with a branded title card.
3. Automatically computes image aspect ratios (52mm x 52mm box).
4. Includes panel captions, narration blocks, speech bubbles, and italicized scene descriptions.
5. Sanitizes special quotes and em-dashes to avoid Latin-1 encoding errors.
6. Saves files to `static/exports/comic_YYYYMMDD_HHMMSS_<id>.pdf`.

---

## Running Tests

Run the test suite with `pytest`:

```bash
pytest test_app.py -v
```

Tests verify:
- 5-panel strict sequential outline format.
- Tone adaptation in character dialogue.
- Safe file naming and image disk storage.
- Multi-page PDF generation and non-empty byte count.
- HTTP status codes and JSON API schemas.

---

## Troubleshooting

- **CUDA Out of Memory**: Reduce `IMAGE_WIDTH` and `IMAGE_HEIGHT` to `384` or `256` in `.env`, or set `SD_DEVICE="cpu"`.
- **Gemini Rate Limits / Missing Key**: If `GEMINI_API_KEY` is not supplied, the app automatically switches to the high-coherence local narrative generator, ensuring you never receive a 500 error during testing.
- **Port In Use**: Run on an alternate port: `uvicorn app.main:app --port 8080`.

---

## Future Roadmap

- User accounts and personalized comic libraries.
- Regeneration of individual panels without regenerating the full comic.
- Multi-character dialogue exchanges with distinct voice tags.
- Direct social sharing of web comic strips.
