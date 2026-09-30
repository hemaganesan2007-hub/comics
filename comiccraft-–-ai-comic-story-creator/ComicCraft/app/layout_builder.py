"""
Layout Builder Module.
Assembles the structured outline, story details, and generated image paths
into a unified, ordered 5-panel comic data structure.
"""

from typing import List, Dict, Any


def build_comic_layout(
    outline: List[Dict[str, Any]],
    story: List[Dict[str, Any]],
    images: List[str]
) -> List[Dict[str, Any]]:
    """
    Combines outline, story, and image paths into a sequence-verified list of panel objects.
    
    Args:
        outline: List of 5 outline dictionaries with title, scene_description, image_prompt.
        story: List of 5 story dictionaries with caption, narration, dialogue, action.
        images: List of 5 image paths corresponding to panels 1 to 5.
        
    Returns:
        List of 5 complete panel dictionaries ready for rendering or PDF export.
    """
    layout = []
    total_panels = 5

    # Sort inputs by panel_number if present to guarantee strict 1..5 ordering
    sorted_outline = sorted(outline, key=lambda x: int(x.get("panel_number", 1)))
    sorted_story = sorted(story, key=lambda x: int(x.get("panel_number", 1)))

    for i in range(total_panels):
        panel_num = i + 1
        out = sorted_outline[i] if i < len(sorted_outline) else {}
        st = sorted_story[i] if i < len(sorted_story) else {}
        img_path = images[i] if i < len(images) else ""

        layout.append({
            "panel_number": panel_num,
            "title": out.get("title", f"Panel {panel_num}"),
            "scene_description": out.get("scene_description", ""),
            "image_prompt": out.get("image_prompt", ""),
            "caption": st.get("caption", f"Panel {panel_num}"),
            "narration": st.get("narration", ""),
            "dialogue": st.get("dialogue", ""),
            "action": st.get("action", ""),
            "emotional_context": st.get("emotional_context", ""),
            "image_path": img_path,
        })

    return layout
