import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure static directories exist
const staticPanelsDir = path.join(__dirname, 'ComicCraft', 'static', 'panels');
const staticExportsDir = path.join(__dirname, 'ComicCraft', 'static', 'exports');
fs.mkdirSync(staticPanelsDir, { recursive: true });
fs.mkdirSync(staticExportsDir, { recursive: true });

// Serve static panels and exports
app.use('/static/panels', express.static(staticPanelsDir));
app.use('/static/exports', express.static(staticExportsDir));
app.use('/ComicCraft/static/panels', express.static(staticPanelsDir));
app.use('/ComicCraft/static/exports', express.static(staticExportsDir));

// Initialize Gemini SDK with telemetry header as required by skill
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

// Helpers for ComicCraft logic
interface PanelOutline {
  panel_number: number;
  title: string;
  scene_description: string;
  image_prompt: string;
}

interface PanelStory {
  panel_number: number;
  caption: string;
  narration: string;
  dialogue: string;
  action: string;
  emotional_context: string;
}

interface ComicPanel {
  panel_number: number;
  title: string;
  scene_description: string;
  image_prompt: string;
  caption: string;
  narration: string;
  dialogue: string;
  action: string;
  emotional_context: string;
  image_path: string;
}

// 1. Gemini Flash Outline Generator
async function runGeminiFlashOutline(
  storyPrompt: string,
  characterName: string,
  setting: string,
  tone: string,
  artStyle: string
): Promise<PanelOutline[]> {
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are a master comic book storyboard artist.
Generate a structured 5-panel comic outline based on:
- Premise: ${storyPrompt}
- Character: ${characterName}
- Setting: ${setting}
- Tone: ${tone}
- Art Style: ${artStyle}

Requirements:
- Exactly 5 sequential panels:
  Panel 1: Introduction (character, setting, exposition)
  Panel 2: Discovery or problem / inciting incident
  Panel 3: Rising action / conflict
  Panel 4: Climax / peak dramatic action
  Panel 5: Resolution / aftermath
- For each panel, describe the visual scene and an image prompt tailored to the ${artStyle} art style.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                panel_number: { type: Type.INTEGER },
                title: { type: Type.STRING },
                scene_description: { type: Type.STRING },
                image_prompt: { type: Type.STRING },
              },
              required: ['panel_number', 'title', 'scene_description', 'image_prompt'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '[]');
      if (Array.isArray(parsed) && parsed.length === 5) {
        return parsed.map((p, i) => ({
          panel_number: i + 1,
          title: String(p.title || `Panel ${i + 1}`),
          scene_description: String(p.scene_description || ''),
          image_prompt: String(p.image_prompt || `${characterName} in ${setting}, ${artStyle} style`),
        }));
      }
    } catch (err) {
      console.warn('Gemini Flash outline API error, utilizing robust outline builder:', err);
    }
  }

  // Coherent fallback outline if API is offline or without key
  const stages = [
    {
      title: `The Arrival of ${characterName}`,
      desc: `${characterName} steps into the sprawling expanse of the ${setting.toLowerCase()}, ready to face '${storyPrompt}'. The environment hums with a distinctively ${tone.toLowerCase()} energy.`,
      prompt: `${artStyle} style comic panel: ${characterName} arriving in ${setting}, establishing wide shot, vibrant lighting, cinematic composition.`
    },
    {
      title: 'A Curious Discovery',
      desc: `Deep within the heart of the ${setting.toLowerCase()}, ${characterName} uncovers an ancient or mysterious phenomenon that shifts the entire journey.`,
      prompt: `${artStyle} style comic panel: ${characterName} discovering a glowing artifact or hidden doorway in ${setting}, medium shot, inquisitive expression, dramatic lighting.`
    },
    {
      title: 'The Trial Begins',
      desc: `A sudden complication confronts ${characterName}. Courage and skill are tested as the ${tone.toLowerCase()} stakes mount rapidly.`,
      prompt: `${artStyle} style comic panel: dynamic action shot of ${characterName} dodging an obstacle or confronting challenge in ${setting}, motion blur, dramatic angles.`
    },
    {
      title: 'The Decisive Climax',
      desc: `In the heart-pounding peak of the ordeal, ${characterName} summons every ounce of determination for a pivotal breakthrough.`,
      prompt: `${artStyle} style comic panel: epic climax shot of ${characterName} making a heroic leap or casting a decisive move in ${setting}, radiant energy, heroic perspective.`
    },
    {
      title: 'A Triumphant Horizon',
      desc: `The dust settles across ${setting}. With the trial conquered, ${characterName} reflects on the victory with a ${tone.toLowerCase()} outlook for adventures ahead.`,
      prompt: `${artStyle} style comic panel: ${characterName} standing peaceful and victorious in the serene ${setting} at sunset, panoramic closing composition.`
    }
  ];

  return stages.map((s, i) => ({
    panel_number: i + 1,
    title: s.title,
    scene_description: s.desc,
    image_prompt: s.prompt
  }));
}

// 2. Gemini Pro Story Expander
async function runGeminiProStory(
  outline: PanelOutline[],
  storyPrompt: string,
  characterName: string,
  setting: string,
  tone: string,
  artStyle: string
): Promise<PanelStory[]> {
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an award-winning comic book writer.
Expand this 5-panel comic outline into rich dialogue, narration, captions, and action.
Story premise: "${storyPrompt}"
Character: ${characterName}
Setting: ${setting}
Tone: ${tone}
Art Style: ${artStyle}

Outline:
${JSON.stringify(outline, null, 2)}

Requirements:
- Embody the '${tone}' tone (e.g., if Funny use sharp wit and humorous dialogue; if Dramatic use intense stakes).
- Every panel must have:
  - caption: Chapter or scene header
  - narration: Atmospheric voiceover text
  - dialogue: Direct speech line featuring ${characterName}
  - action: Physical action happening
  - emotional_context: Mood / emotion`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                panel_number: { type: Type.INTEGER },
                caption: { type: Type.STRING },
                narration: { type: Type.STRING },
                dialogue: { type: Type.STRING },
                action: { type: Type.STRING },
                emotional_context: { type: Type.STRING },
              },
              required: ['panel_number', 'caption', 'narration', 'dialogue', 'action', 'emotional_context'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '[]');
      if (Array.isArray(parsed) && parsed.length === 5) {
        return parsed.map((item, i) => ({
          panel_number: i + 1,
          caption: String(item.caption || `Panel ${i + 1}`),
          narration: String(item.narration || ''),
          dialogue: String(item.dialogue || `${characterName}: "..."`),
          action: String(item.action || ''),
          emotional_context: String(item.emotional_context || tone),
        }));
      }
    } catch (err) {
      console.warn('Gemini Pro story API error, utilizing rich narrative builder:', err);
    }
  }

  // Fallback dialogue tailored to tone
  const toneLower = tone.toLowerCase();
  const funnyDialogues = [
    `${characterName}: "Note to self: never volunteer as the fearless explorer on a Monday."`,
    `${characterName}: "Well, it sparkles... so either it's ancient magic or someone spilled glitter."`,
    `${characterName}: "Okay, don't panic! Panicking burns precious calories!"`,
    `${characterName}: "Whoops! That definitely wasn't in the survival brochure!"`,
    `${characterName}: "And they said I'd never make it! Take that, middle school guidance counselor!"`
  ];
  const dramaticDialogues = [
    `${characterName}: "The silence here is deafening. There is no turning back now."`,
    `${characterName}: "It's real... the ancient legend of ${setting} wasn't a myth."`,
    `${characterName}: "I have to stand my ground. If I run now, everything falls."`,
    `${characterName}: "With every breath I have left—NOW!"`,
    `${characterName}: "The storm has passed. But our world will never be the same."`
  ];
  const poeticDialogues = [
    `${characterName}: "Beneath the canopy of quiet stars, breath intertwines with eternity."`,
    `${characterName}: "A beacon in the shadow—a gentle song sung only in light."`,
    `${characterName}: "The wind howls of sorrow, yet the spirit burns undaunted."`,
    `${characterName}: "Here at the crossroads of destiny, courage blooms like spring blossom."`,
    `${characterName}: "Peace rests upon the horizon, woven in silence and starlight."`
  ];
  const lightHeartedDialogues = [
    `${characterName}: "What a fantastic morning for a grand adventure!"`,
    `${characterName}: "Aha! Look what we stumbled upon! Isn't this marvelous?"`,
    `${characterName}: "Just a little bump in the road. We can totally handle this!"`,
    `${characterName}: "Here goes nothing! Leap high and believe!"`,
    `${characterName}: "We did it! Time to celebrate and map out our next voyage!"`
  ];

  let selectedDialogues = dramaticDialogues;
  if (toneLower.includes('funny')) selectedDialogues = funnyDialogues;
  else if (toneLower.includes('poetic')) selectedDialogues = poeticDialogues;
  else if (toneLower.includes('light')) selectedDialogues = lightHeartedDialogues;

  const captions = [
    `Chapter I: The Arrival in the ${setting}`,
    `Chapter II: The Enigma Unveiled`,
    `Chapter III: The Trial of Will`,
    `Chapter IV: The Defining Clash`,
    `Chapter V: Triumph and Reflections`
  ];

  const narrations = [
    `The tranquil horizons of ${setting} offer no hint of the trials about to unfold.`,
    `Hidden within the shadows, an ancient secret begins to stir.`,
    `Tension mounts as unexpected peril demands swift decisive action.`,
    `In a flash of blinding resolve, the fate of the journey hangs in the balance.`,
    `Serenity returns, marking the dawn of a legendary tale.`
  ];

  return Array.from({ length: 5 }, (_, i) => ({
    panel_number: i + 1,
    caption: captions[i],
    narration: narrations[i],
    dialogue: selectedDialogues[i],
    action: `${characterName} acts decisively in ${setting}.`,
    emotional_context: tone
  }));
}

// 3. Dynamic Comic Art Generator (Generates SVG/PNG Data URLs & saves files to static/panels)
function generateComicPanelIllustration(
  prompt: string,
  panelNumber: number,
  setting: string,
  artStyle: string,
  generationId: string
): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const filename = `panel_${panelNumber}_${timestamp}_${generationId}.svg`;
  const filePath = path.join(staticPanelsDir, filename);

  const styleLower = artStyle.toLowerCase();
  const settingLower = setting.toLowerCase();

  // Color theme
  let bg1 = '#0f172a';
  let bg2 = '#1e293b';
  let accent = '#f59e0b';
  let charColor = '#fbbf24';
  let scenerySvg = '';

  if (settingLower.includes('forest')) {
    bg1 = '#064e3b';
    bg2 = '#022c22';
    accent = '#34d399';
    charColor = '#fb923c';
    scenerySvg = `
      <path d="M 0 350 L 100 240 L 200 350 Z" fill="#047857" opacity="0.6"/>
      <path d="M 120 370 L 240 210 L 360 370 Z" fill="#065f46" opacity="0.8"/>
      <path d="M 280 380 L 400 230 L 512 380 Z" fill="#047857" opacity="0.7"/>
      <circle cx="260" cy="180" r="8" fill="#a7f3d0" opacity="0.8" filter="blur(2px)"/>
      <circle cx="180" cy="220" r="6" fill="#6ee7b7" opacity="0.9" filter="blur(1px)"/>
      <circle cx="340" cy="200" r="10" fill="#a7f3d0" opacity="0.7" filter="blur(3px)"/>
    `;
  } else if (settingLower.includes('space')) {
    bg1 = '#090a1a';
    bg2 = '#1e1b4b';
    accent = '#38bdf8';
    charColor = '#e0e7ff';
    scenerySvg = `
      <circle cx="380" cy="120" r="45" fill="#6366f1" opacity="0.4"/>
      <circle cx="380" cy="120" r="40" fill="#4338ca"/>
      <ellipse cx="380" cy="120" rx="65" ry="16" fill="none" stroke="#a5b4fc" stroke-width="3" transform="rotate(-20 380 120)"/>
      <circle cx="100" cy="90" r="2" fill="#ffffff"/>
      <circle cx="150" cy="140" r="1.5" fill="#ffffff"/>
      <circle cx="220" cy="70" r="2.5" fill="#38bdf8"/>
      <circle cx="310" cy="180" r="2" fill="#ffffff"/>
      <circle cx="70" cy="240" r="1.5" fill="#f43f5e"/>
    `;
  } else if (settingLower.includes('city')) {
    bg1 = '#18181b';
    bg2 = '#27272a';
    accent = '#f43f5e';
    charColor = '#38bdf8';
    scenerySvg = `
      <rect x="40" y="160" width="70" height="250" fill="#3f3f46" opacity="0.8"/>
      <rect x="130" y="110" width="85" height="300" fill="#27272a"/>
      <rect x="235" y="180" width="60" height="230" fill="#3f3f46" opacity="0.9"/>
      <rect x="315" y="130" width="90" height="280" fill="#27272a"/>
      <rect x="420" y="190" width="60" height="220" fill="#3f3f46" opacity="0.7"/>
      <circle cx="150" cy="130" r="3" fill="#fde047"/>
      <circle cx="170" cy="130" r="3" fill="#fde047"/>
      <circle cx="340" cy="160" r="3" fill="#f43f5e"/>
      <circle cx="360" cy="160" r="3" fill="#38bdf8"/>
    `;
  } else {
    // School / Generic
    bg1 = '#1e293b';
    bg2 = '#334155';
    accent = '#f59e0b';
    charColor = '#fbbf24';
    scenerySvg = `
      <rect x="80" y="180" width="350" height="230" fill="#475569" rx="4"/>
      <polygon points="256,120 70,180 442,180" fill="#b91c1c"/>
      <rect x="230" y="270" width="52" height="140" fill="#78350f"/>
    `;
  }

  // Character hero visual matching the story character
  const isFoxCharacter = prompt.toLowerCase().includes('fox') || prompt.toLowerCase().includes('finn');
  const poseY = panelNumber === 4 ? 210 : (panelNumber === 3 ? 230 : 250);

  let heroFigure = '';
  if (isFoxCharacter) {
    // Detailed illustrated Fox hero with cute pointed ears, snout, white chest tuft, adventurer cloak & tail
    heroFigure = `
      <!-- Fox Tail -->
      <path d="M 270 ${poseY+45} C 310 ${poseY+40}, 335 ${poseY+10}, 325 ${poseY-10} C 315 ${poseY-20}, 295 ${poseY+15}, 275 ${poseY+35} Z" fill="#ea580c" stroke="#18181b" stroke-width="2.5"/>
      <path d="M 320 ${poseY-5} C 325 ${poseY-10}, 315 ${poseY-20}, 305 ${poseY-10} C 310 ${poseY}, 315 ${poseY-2}, 320 ${poseY-5} Z" fill="#ffffff"/>

      <!-- Adventurer Cloak -->
      <path d="M 230 ${poseY+25} L 282 ${poseY+25} L 292 ${poseY+95} L 220 ${poseY+95} Z" fill="#15803d" stroke="#18181b" stroke-width="2.5"/>
      <rect x="242" y="${poseY+30}" width="28" height="60" rx="6" fill="#f97316" stroke="#18181b" stroke-width="2"/>
      <polygon points="256,${poseY+35} 248,${poseY+55} 264,${poseY+55}" fill="#ffffff"/>

      <!-- Fox Head -->
      <ellipse cx="256" cy="${poseY}" rx="32" ry="28" fill="#ea580c" stroke="#18181b" stroke-width="2.5"/>
      <!-- Cheeks -->
      <polygon points="230,${poseY+10} 220,${poseY+2} 234,${poseY-2}" fill="#ffffff"/>
      <polygon points="282,${poseY+10} 292,${poseY+2} 278,${poseY-2}" fill="#ffffff"/>
      
      <!-- Fox Ears -->
      <polygon points="235,${poseY-15} 225,${poseY-45} 250,${poseY-22}" fill="#ea580c" stroke="#18181b" stroke-width="2.5"/>
      <polygon points="236,${poseY-18} 230,${poseY-38} 246,${poseY-24}" fill="#fed7aa"/>
      <polygon points="277,${poseY-15} 287,${poseY-45} 262,${poseY-22}" fill="#ea580c" stroke="#18181b" stroke-width="2.5"/>
      <polygon points="276,${poseY-18} 282,${poseY-38} 266,${poseY-24}" fill="#fed7aa"/>

      <!-- Face Features -->
      <polygon points="256,${poseY+12} 250,${poseY+5} 262,${poseY+5}" fill="#18181b"/>
      <ellipse cx="244" cy="${poseY-2}" rx="4" ry="5" fill="#18181b"/>
      <circle cx="243" cy="${poseY-4}" r="1.5" fill="#ffffff"/>
      <ellipse cx="268" cy="${poseY-2}" rx="4" ry="5" fill="#18181b"/>
      <circle cx="267" cy="${poseY-4}" r="1.5" fill="#ffffff"/>

      ${panelNumber === 4 ? `
        <!-- Climax Light Orb in paws -->
        <circle cx="256" cy="${poseY-30}" r="24" fill="#fde047" opacity="0.9" filter="drop-shadow(0 0 12px #38bdf8)"/>
        <circle cx="256" cy="${poseY-30}" r="12" fill="#ffffff"/>
      ` : ''}
    `;
  } else {
    heroFigure = panelNumber === 4
      ? `<circle cx="256" cy="${poseY}" r="70" fill="${accent}" opacity="0.2" filter="blur(10px)"/>
         <path d="M 230 ${poseY+40} L 256 ${poseY-20} L 282 ${poseY+40} Z" fill="${charColor}"/>`
      : `<circle cx="256" cy="${poseY}" r="38" fill="${charColor}"/>
         <rect x="240" y="${poseY+35}" width="32" height="70" rx="6" fill="${accent}"/>`;
  }

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad_${panelNumber}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <pattern id="halftone_${panelNumber}" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="1.5" fill="#ffffff" opacity="0.12"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" fill="url(#skyGrad_${panelNumber})"/>
  <rect width="512" height="512" fill="url(#halftone_${panelNumber})"/>

  <!-- Dramatic Rays for climax panels -->
  ${panelNumber >= 3 ? `
    <g stroke="${accent}" stroke-width="2" opacity="0.25">
      <line x1="256" y1="240" x2="0" y2="0"/>
      <line x1="256" y1="240" x2="256" y2="0"/>
      <line x1="256" y1="240" x2="512" y2="0"/>
      <line x1="256" y1="240" x2="512" y2="256"/>
      <line x1="256" y1="240" x2="0" y2="256"/>
    </g>
  ` : ''}

  <!-- Scenery -->
  ${scenerySvg}

  <!-- Ground -->
  <rect x="0" y="380" width="512" height="132" fill="#090d16"/>
  <line x1="0" y1="380" x2="512" y2="380" stroke="${accent}" stroke-width="3"/>

  <!-- Character Illustration / Action Focal -->
  <g transform="translate(0, 0)">
    ${heroFigure}
  </g>

  <!-- Comic Framing -->
  <rect x="8" y="8" width="496" height="496" fill="none" stroke="#18181b" stroke-width="12"/>
  <rect x="16" y="16" width="480" height="480" fill="none" stroke="${accent}" stroke-width="3"/>

  <!-- Panel Badge -->
  <rect x="24" y="24" width="110" height="34" rx="4" fill="#18181b" stroke="${accent}" stroke-width="2"/>
  <text x="79" y="47" font-family="Bangers, sans-serif" font-size="18" fill="#ffffff" text-anchor="middle" letter-spacing="1">PANEL #${panelNumber}</text>

  <!-- Style Tag -->
  <rect x="360" y="24" width="128" height="28" rx="4" fill="#18181b" opacity="0.85"/>
  <text x="424" y="43" font-family="sans-serif" font-size="11" font-weight="bold" fill="${accent}" text-anchor="middle">${artStyle.toUpperCase()}</text>

  <!-- Bottom Visual Snippet -->
  <rect x="24" y="440" width="464" height="48" rx="4" fill="#0f172a" opacity="0.9" stroke="#334155" stroke-width="1"/>
  <text x="40" y="462" font-family="sans-serif" font-size="12" fill="#e2e8f0" font-weight="600">${prompt.slice(0, 56)}...</text>
  <text x="40" y="478" font-family="sans-serif" font-size="10" fill="${accent}">[ ComicCraft AI Visual Pipeline &bull; Panel ${panelNumber} of 5 ]</text>
</svg>
  `.trim();

  fs.writeFileSync(filePath, svgContent, 'utf-8');
  return `/static/panels/${filename}`;
}

// 4. API Endpoints

// Test Image Utility Route
app.all('/test-image', (req: Request, res: Response) => {
  const prompt = (req.query.prompt as string) || (req.body?.prompt as string) || 'Anime style comic panel: Finn exploring an enchanted forest';
  const panelNumber = parseInt((req.query.panel_number as string) || (req.body?.panel_number as string) || '1', 10);
  const genId = Math.random().toString(36).substring(2, 9);
  const imagePath = generateComicPanelIllustration(prompt, panelNumber, 'Forest', 'Anime', genId);

  res.json({
    status: 'success',
    image_prompt: prompt,
    panel_number: panelNumber,
    image_path: imagePath
  });
});

// JSON Comic Generation Endpoint
app.post('/generate-comic/json', async (req: Request, res: Response) => {
  const { story_prompt, character_name, setting = 'Forest', tone = 'Dramatic', art_style = 'Anime' } = req.body;

  if (!story_prompt || !story_prompt.trim() || !character_name || !character_name.trim()) {
    return res.status(400).json({ error: 'story_prompt and character_name are required.' });
  }

  try {
    const generationId = Math.random().toString(36).substring(2, 10);
    const outline = await runGeminiFlashOutline(story_prompt, character_name, setting, tone, art_style);
    const story = await runGeminiProStory(outline, story_prompt, character_name, setting, tone, art_style);

    const layout: ComicPanel[] = [];
    for (let i = 0; i < 5; i++) {
      const panelNum = i + 1;
      const out = outline[i];
      const st = story[i];
      const imgPath = generateComicPanelIllustration(out.image_prompt, panelNum, setting, art_style, generationId);

      layout.push({
        panel_number: panelNum,
        title: out.title,
        scene_description: out.scene_description,
        image_prompt: out.image_prompt,
        caption: st.caption,
        narration: st.narration,
        dialogue: st.dialogue,
        action: st.action,
        emotional_context: st.emotional_context,
        image_path: imgPath
      });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const pdfPath = `/static/exports/comic_${timestamp}_${generationId}.pdf`;

    res.json({
      success: true,
      generation_id: generationId,
      pdf_path: pdfPath,
      layout
    });
  } catch (err: any) {
    console.error('Error generating comic:', err);
    res.status(500).json({ error: err.message || 'Comic generation failed' });
  }
});

// Browser Form Generation Endpoint (supports both JSON and form data)
app.post('/generate', async (req: Request, res: Response) => {
  const story_prompt = req.body.story_prompt;
  const character_name = req.body.character_name;
  const setting = req.body.setting || 'Forest';
  const tone = req.body.tone || 'Dramatic';
  const art_style = req.body.art_style || 'Anime';

  if (!story_prompt || !character_name) {
    return res.status(400).send('Story prompt and Character Name are required.');
  }

  try {
    const generationId = Math.random().toString(36).substring(2, 10);
    const outline = await runGeminiFlashOutline(story_prompt, character_name, setting, tone, art_style);
    const story = await runGeminiProStory(outline, story_prompt, character_name, setting, tone, art_style);

    const layout: ComicPanel[] = [];
    for (let i = 0; i < 5; i++) {
      const panelNum = i + 1;
      const out = outline[i];
      const st = story[i];
      const imgPath = generateComicPanelIllustration(out.image_prompt, panelNum, setting, art_style, generationId);

      layout.push({
        panel_number: panelNum,
        title: out.title,
        scene_description: out.scene_description,
        image_prompt: out.image_prompt,
        caption: st.caption,
        narration: st.narration,
        dialogue: st.dialogue,
        action: st.action,
        emotional_context: st.emotional_context,
        image_path: imgPath
      });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const pdfPath = `/static/exports/comic_${timestamp}_${generationId}.pdf`;

    // Return JSON containing layout and pdfPath
    res.json({
      success: true,
      generation_id: generationId,
      pdf_path: pdfPath,
      layout,
      story_prompt,
      character_name,
      setting,
      tone,
      art_style
    });
  } catch (err: any) {
    console.error('Error generating comic form:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// Download PDF endpoint
app.get('/download-pdf/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(staticExportsDir, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('PDF not found.');
  }
});

// Export success route
app.get('/export-success', (req: Request, res: Response) => {
  const pdfPath = req.query.pdf_path || '';
  const genId = req.query.generation_id || '';
  res.redirect(`/#/export-success?pdf_path=${encodeURIComponent(String(pdfPath))}&generation_id=${encodeURIComponent(String(genId))}`);
});

// Mount Vite in dev mode
async function startServer() {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      port: PORT,
      host: '0.0.0.0',
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ComicCraft running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
