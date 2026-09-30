"""
Gemini Flash Outline Generator Module.
Generates a structured 5-panel comic storyline outline using Google Gemini Flash.
"""

import json
import os
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# System instruction ensuring rigid structured output and narrative continuity
OUTLINE_SYSTEM_PROMPT = """You are a master comic book writer and storyboard artist.
Your job is to generate a coherent, cinematic, 5-panel comic outline based on the user's idea.
Each panel must tell a clear visual and narrative story:
- Panel 1: Introduction / Exposition (character in setting, establish world)
- Panel 2: Discovery / Inciting Incident / Problem
- Panel 3: Rising Action / Conflict / Complication
- Panel 4: Climax / Peak Dramatic or Action Moment
- Panel 5: Resolution / Aftermath / Punchline or Meaningful Conclusion

You must return a STRICT JSON array containing exactly 5 panel objects.
No conversational prelude, no markdown wrapping, just valid JSON adhering to:
[
  {
    "panel_number": 1,
    "title": "Panel Title",
    "scene_description": "Detailed description of what is happening in the panel...",
    "image_prompt": "Visual prompt for image generation describing subject, action, framing, lighting, environment, and art style..."
  },
  ...
]
"""

def clean_json_response(raw_text: str) -> str:
    """Removes markdown code fences and extracts raw JSON string."""
    cleaned = raw_text.strip()
    # Match ```json ... ``` or ``` ... ```
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if code_block_match:
        return code_block_match.group(1).strip()
    return cleaned

def generate_outline(
    story_prompt: str,
    character_name: str,
    setting: str,
    tone: str,
    art_style: str
) -> List[Dict[str, Any]]:
    """
    Calls Gemini Flash to generate a structured 5-panel outline.
    
    Args:
        story_prompt: The user's creative core idea.
        character_name: The protagonist's name.
        setting: The primary environment (e.g., Forest, School, Space, City).
        tone: The emotional tone (e.g., Light-hearted, Dramatic, Poetic, Funny).
        art_style: Visual style (e.g., Anime, Pixel Art, Comic Book, Realistic).
        
    Returns:
        List of 5 panel dictionaries containing panel_number, title, scene_description, image_prompt.
    """
    if not story_prompt or not story_prompt.strip():
        raise ValueError("Story prompt cannot be empty.")
    if not character_name or not character_name.strip():
        raise ValueError("Character name cannot be empty.")

    api_key = os.getenv("GEMINI_API_KEY")

    user_instructions = f"""Create a 5-panel comic story outline with the following specifications:
- Core Story Premise: {story_prompt.strip()}
- Main Character: {character_name.strip()}
- Setting: {setting}
- Story Tone: {tone}
- Visual Art Style: {art_style}

Requirements:
1. Exactly 5 sequential panels (1 to 5).
2. The narrative must authentically embody the '{tone}' tone.
3. Every 'image_prompt' must clearly describe {character_name}, their appearance, active gesture, facial expression, the {setting} background, dynamic comic camera angle (e.g., wide shot, close-up, dramatic low angle), lighting, and the visual aesthetics of '{art_style}' style.
4. Ensure character visual consistency across all five panel image prompts.
5. Return JSON ONLY with keys: panel_number, title, scene_description, image_prompt.
"""

    # If Gemini API key is configured, use the official SDK
    if api_key and api_key != "your_gemini_api_key_here":
        try:
            # Prefer modern google-genai SDK if available
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=api_key, http_options={"headers": {"User-Agent": "aistudio-build"}})
                response = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=user_instructions,
                    config=types.GenerateContentConfig(
                        system_instruction=OUTLINE_SYSTEM_PROMPT,
                        temperature=0.8,
                        response_mime_type="application/json"
                    )
                )
                raw_text = response.text or ""
            except ImportError:
                # Fallback to google.generativeai if modern SDK not installed
                import google.generativeai as legacy_genai
                legacy_genai.configure(api_key=api_key)
                model = legacy_genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=OUTLINE_SYSTEM_PROMPT
                )
                response = model.generate_content(
                    user_instructions,
                    generation_config={"response_mime_type": "application/json", "temperature": 0.8}
                )
                raw_text = response.text or ""

            cleaned_json = clean_json_response(raw_text)
            parsed_data = json.loads(cleaned_json)

            if isinstance(parsed_data, dict):
                # If wrapped in a dictionary like {"panels": [...]}
                for key in ["panels", "comic", "story", "outline"]:
                    if key in parsed_data and isinstance(parsed_data[key], list):
                        parsed_data = parsed_data[key]
                        break

            if isinstance(parsed_data, list) and len(parsed_data) == 5:
                validated_panels = []
                for idx, panel in enumerate(parsed_data, start=1):
                    validated_panels.append({
                        "panel_number": int(panel.get("panel_number", idx)),
                        "title": str(panel.get("title", f"Panel {idx}")).strip(),
                        "scene_description": str(panel.get("scene_description", "")).strip(),
                        "image_prompt": str(panel.get("image_prompt", "")).strip(),
                    })
                return validated_panels
            else:
                logger.warning("Gemini did not return exactly 5 panels. Count was %d. Attempting repair.", len(parsed_data) if isinstance(parsed_data, list) else 0)
        except Exception as e:
            logger.error("Error communicating with Gemini Flash: %s. Using robust narrative builder.", str(e))

    # Deterministic dynamic fallback ensuring robust execution without breaking the user experience
    return generate_fallback_outline(story_prompt, character_name, setting, tone, art_style)


def generate_fallback_outline(
    story_prompt: str,
    character_name: str,
    setting: str,
    tone: str,
    art_style: str
) -> List[Dict[str, Any]]:
    """Generates a structured, theme-accurate 5-panel outline if AI API is temporarily unavailable."""
    style_suffix = f"Masterpiece {art_style} comic illustration, vibrant lighting, rich colors, detailed background of {setting}, dynamic comic book composition."
    
    stages = [
        {
            "step": "Introduction",
            "title": f"The Journey of {character_name}",
            "desc": f"{character_name} stands in the vast expanse of the {setting.lower()}, embarking on an uncharted venture: '{story_prompt}'. The atmosphere feels distinctively {tone.lower()}.",
            "prompt": f"{art_style} style comic panel: {character_name} in {setting}, establishing shot, looking forward with determination, {style_suffix}"
        },
        {
            "step": "Discovery",
            "title": "An Unexpected Discovery",
            "desc": f"While investigating the heart of the {setting.lower()}, {character_name} stumbles upon a mysterious anomaly that changes the entire trajectory.",
            "prompt": f"{art_style} style comic panel: {character_name} examining a mysterious glowing relic or clue in {setting}, medium shot, curious expression, dramatic lighting, {style_suffix}"
        },
        {
            "step": "Conflict",
            "title": "Facing the Trial",
            "desc": f"A sudden obstacle erupts. {character_name} must summon courage to overcome the hurdle amidst rising {tone.lower()} tension.",
            "prompt": f"{art_style} style comic panel: dynamic action shot of {character_name} overcoming a perilous obstacle in {setting}, motion blur, dramatic angles, intense expression, {style_suffix}"
        },
        {
            "step": "Climax",
            "title": "The Decisive Moment",
            "desc": f"At the absolute peak of the ordeal, {character_name} makes a bold leap of faith, testing everything learned so far.",
            "prompt": f"{art_style} style comic panel: epic cinematic climax shot of {character_name} making a decisive breakthrough in {setting}, vibrant energy burst, heroic perspective, {style_suffix}"
        },
        {
            "step": "Resolution",
            "title": "A New Dawn",
            "desc": f"The dust settles over {setting}. {character_name} reflects upon the triumph with a {tone.lower()} conclusion, ready for tomorrow's horizons.",
            "prompt": f"{art_style} style comic panel: {character_name} standing peacefully in the serene {setting} at sunset, triumphant smile, wide panoramic closing shot, {style_suffix}"
        }
    ]

    outline = []
    for i, s in enumerate(stages, start=1):
        outline.append({
            "panel_number": i,
            "title": s["title"],
            "scene_description": s["desc"],
            "image_prompt": s["prompt"]
        })
    return outline
