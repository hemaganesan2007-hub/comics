"""
Stable Diffusion & Artistic Image Generator Module.
Generates comic illustrations using Hugging Face Diffusers Stable Diffusion pipeline,
with safe caching, device detection, and robust fallback image composition using Pillow.
"""

import os
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# Base static directories
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_PANELS_DIR = BASE_DIR / "static" / "panels"
STATIC_PANELS_DIR.mkdir(parents=True, exist_ok=True)

# Configuration from environment
MODEL_ID = os.getenv("STABLE_DIFFUSION_MODEL", "runwayml/stable-diffusion-v1-5")
SD_DEVICE_OVERRIDE = os.getenv("SD_DEVICE", "auto")
IMAGE_WIDTH = int(os.getenv("IMAGE_WIDTH", "512"))
IMAGE_HEIGHT = int(os.getenv("IMAGE_HEIGHT", "512"))
NUM_INFERENCE_STEPS = int(os.getenv("NUM_INFERENCE_STEPS", "25"))

# Global singleton pipeline to prevent reloading across panels
_PIPELINE = None
_PIPELINE_ATTEMPTED = False


def get_diffusers_pipeline():
    """
    Initializes and caches the Hugging Face Stable Diffusion pipeline.
    Avoids reloading the heavy model for every single panel.
    """
    global _PIPELINE, _PIPELINE_ATTEMPTED
    if _PIPELINE is not None:
        return _PIPELINE
    if _PIPELINE_ATTEMPTED:
        return None

    _PIPELINE_ATTEMPTED = True

    try:
        import torch
        from diffusers import StableDiffusionPipeline

        # Determine optimal compute device
        if SD_DEVICE_OVERRIDE != "auto":
            device = SD_DEVICE_OVERRIDE
        elif torch.cuda.is_available():
            device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        torch_dtype = torch.float16 if device == "cuda" else torch.float32
        logger.info("Initializing Stable Diffusion (%s) on device: %s...", MODEL_ID, device)

        hf_token = os.getenv("HF_API_KEY")
        kwargs = {"torch_dtype": torch_dtype}
        if hf_token and hf_token != "your_huggingface_api_key_here":
            kwargs["use_auth_token"] = hf_token

        pipe = StableDiffusionPipeline.from_pretrained(MODEL_ID, **kwargs)
        pipe = pipe.to(device)

        # Enable memory optimizations if available
        if device == "cuda":
            try:
                pipe.enable_attention_slicing()
            except Exception:
                pass

        _PIPELINE = pipe
        logger.info("Stable Diffusion pipeline loaded successfully.")
        return _PIPELINE
    except Exception as exc:
        logger.warning(
            "Could not initialize Diffusers Stable Diffusion pipeline (%s). "
            "Falling back to high-fidelity comic visual rendering. Details: %s",
            MODEL_ID, str(exc)
        )
        return None


def generate_comic_panel_fallback_image(
    prompt: str,
    panel_number: int,
    output_path: Path,
    width: int = 512,
    height: int = 512
) -> None:
    """
    Creates a styled comic panel illustration with atmospheric gradient,
    halftone comic dots, speed lines, stylized framing, and title plate
    when local GPU / weights are unavailable.
    """
    img = Image.new("RGB", (width, height), color=(20, 24, 39))
    draw = ImageDraw.Draw(img)

    # Determine theme color palette based on keywords in prompt
    prompt_lower = prompt.lower()
    if "forest" in prompt_lower:
        c1, c2 = (18, 53, 36), (62, 123, 76)
        accent = (168, 224, 99)
    elif "space" in prompt_lower:
        c1, c2 = (12, 14, 35), (45, 20, 75)
        accent = (130, 200, 255)
    elif "city" in prompt_lower:
        c1, c2 = (28, 25, 43), (70, 60, 100)
        accent = (255, 214, 102)
    elif "school" in prompt_lower:
        c1, c2 = (35, 45, 65), (80, 110, 140)
        accent = (255, 179, 102)
    elif "anime" in prompt_lower:
        c1, c2 = (40, 20, 60), (120, 60, 140)
        accent = (255, 107, 129)
    elif "pixel" in prompt_lower:
        c1, c2 = (20, 30, 48), (36, 59, 85)
        accent = (0, 210, 255)
    else:
        c1, c2 = (30, 33, 45), (75, 85, 99)
        accent = (251, 191, 36)

    # Vertical gradient background
    for y in range(height):
        factor = y / height
        r = int(c1[0] * (1 - factor) + c2[0] * factor)
        g = int(c1[1] * (1 - factor) + c2[1] * factor)
        b = int(c1[2] * (1 - factor) + c2[2] * factor)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Comic sunburst / action rays originating from center
    center_x, center_y = width // 2, int(height * 0.45)
    ray_color = (c2[0] + 20, c2[1] + 20, c2[2] + 20)
    for angle_deg in range(0, 360, 15):
        import math
        rad = math.radians(angle_deg)
        x_end = center_x + int(width * 1.2 * math.cos(rad))
        y_end = center_y + int(height * 1.2 * math.sin(rad))
        draw.line([(center_x, center_y), (x_end, y_end)], fill=ray_color, width=2)

    # Stylized central silhouette / focal circle
    focal_radius = int(width * 0.28)
    draw.ellipse(
        [
            (center_x - focal_radius, center_y - focal_radius),
            (center_x + focal_radius, center_y + focal_radius)
        ],
        fill=(c1[0] + 10, c1[1] + 10, c1[2] + 10),
        outline=accent,
        width=4
    )

    # Star / comic burst emblem in center
    draw.ellipse(
        [
            (center_x - 35, center_y - 35),
            (center_x + 35, center_y + 35)
        ],
        fill=accent,
        outline=(255, 255, 255),
        width=2
    )

    # Classic comic panel double-bordered frame
    draw.rectangle([(8, 8), (width - 8, height - 8)], outline=(20, 20, 20), width=6)
    draw.rectangle([(14, 14), (width - 14, height - 14)], outline=accent, width=2)

    # Badge: Panel Number
    badge_w, badge_h = 100, 32
    draw.rectangle([(20, 20), (20 + badge_w, 20 + badge_h)], fill=(15, 23, 42), outline=accent, width=2)
    draw.text((32, 26), f"PANEL #{panel_number}", fill=(255, 255, 255))

    # Bottom caption banner
    banner_y = height - 75
    draw.rectangle([(20, banner_y), (width - 20, height - 20)], fill=(15, 23, 42, 230), outline=(50, 60, 80), width=1)
    
    # Extract short prompt snippet
    clean_snippet = prompt.replace("Masterpiece", "").replace("style comic panel:", "").strip()
    if len(clean_snippet) > 55:
        clean_snippet = clean_snippet[:52] + "..."
    draw.text((30, banner_y + 12), clean_snippet, fill=(240, 240, 240))
    draw.text((30, banner_y + 32), "[AI Illustrated Visual]", fill=accent)

    img.save(output_path, format="PNG", quality=95)


def generate_image(
    image_prompt: str,
    panel_number: int = 1,
    generation_id: Optional[str] = None
) -> str:
    """
    Generates an illustration for a comic panel.
    Tries Diffusers Stable Diffusion if available, otherwise generates
    a stylized comic book panel using Pillow.
    
    Args:
        image_prompt: The detailed image generation prompt.
        panel_number: The panel sequence index (1-5).
        generation_id: Unique identifier linking all 5 panels of a generation.
        
    Returns:
        Frontend-accessible relative URL (e.g. '/static/panels/panel_1_20260930_123456.png').
    """
    gen_id = generation_id or uuid.uuid4().hex[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"panel_{panel_number}_{timestamp}_{gen_id}.png"
    output_path = STATIC_PANELS_DIR / safe_filename

    # Attempt Stable Diffusion inference
    pipe = get_diffusers_pipeline()
    if pipe is not None:
        try:
            logger.info("Running Stable Diffusion inference for Panel #%d...", panel_number)
            result = pipe(
                prompt=image_prompt,
                negative_prompt="blurry, distorted, low quality, bad anatomy, out of frame, watermark",
                width=IMAGE_WIDTH,
                height=IMAGE_HEIGHT,
                num_inference_steps=NUM_INFERENCE_STEPS,
                guidance_scale=7.5
            )
            image = result.images[0]
            image.save(output_path, format="PNG")
            logger.info("Saved Stable Diffusion illustration to %s", output_path)
            return f"/static/panels/{safe_filename}"
        except Exception as e:
            logger.error("Inference failed for panel %d: %s. Using stylized fallback.", panel_number, str(e))

    # Generate styled comic art using Pillow
    generate_comic_panel_fallback_image(image_prompt, panel_number, output_path, IMAGE_WIDTH, IMAGE_HEIGHT)
    return f"/static/panels/{safe_filename}"
