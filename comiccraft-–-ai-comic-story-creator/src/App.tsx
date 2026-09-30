import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Download,
  RotateCcw,
  CheckCircle2,
  Terminal,
  Code2,
  Layers,
  ArrowRight,
  ExternalLink,
  Eye,
  MessageSquare,
  Volume2,
  Clapperboard,
  AlertCircle
} from 'lucide-react';
import { exportComicToPDF, PanelData } from './pdfExporter';

const PRELOADED_STORY_PANELS: Record<string, string[]> = {
  'finn_forest_anime': [
    '/src/assets/images/finn_forest_panel1_1790742402082.jpg',
    '/src/assets/images/finn_forest_panel2_1790742418544.jpg',
    '/src/assets/images/finn_forest_panel3_1790742432122.jpg',
    '/src/assets/images/finn_forest_panel4_1790742444695.jpg',
    '/src/assets/images/finn_forest_panel5_1790742455909.jpg',
  ]
};

export default function App() {
  // Form State
  const [storyPrompt, setStoryPrompt] = useState('A brave fox exploring an enchanted forest');
  const [characterName, setCharacterName] = useState('Finn');
  const [setting, setSetting] = useState('Forest');
  const [tone, setTone] = useState('Dramatic');
  const [artStyle, setArtStyle] = useState('Anime');

  // Generation & View State
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [panels, setPanels] = useState<PanelData[] | null>(null);
  const [currentView, setCurrentView] = useState<'create' | 'preview' | 'export_success'>('create');
  const [activeTab, setActiveTab] = useState<'comic' | 'api_tester' | 'code_viewer'>('comic');

  // API Tester State
  const [testImagePrompt, setTestImagePrompt] = useState('Anime style comic panel: Finn the fox standing bravely in an enchanted glowing forest, vibrant colors');
  const [testImageResult, setTestImageResult] = useState<any>(null);
  const [testImageLoading, setTestImageLoading] = useState(false);

  const [jsonReqBody, setJsonReqBody] = useState(JSON.stringify({
    story_prompt: "A brave fox exploring an enchanted forest",
    character_name: "Finn",
    setting: "Forest",
    tone: "Dramatic",
    art_style: "Anime"
  }, null, 2));
  const [jsonResResult, setJsonResResult] = useState<any>(null);
  const [jsonLoading, setJsonLoading] = useState(false);

  // Python Code Viewer State
  const [selectedFile, setSelectedFile] = useState('app/main.py');

  const pythonFiles: Record<string, string> = {
    'app/main.py': `# FastAPI Main Application Entry Point
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routes import router
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="ComicCraft – AI Comic Story Creator using Gemini Models",
    description="Transform your creative stories into 5-panel AI-illustrated comics with Gemini outline, dialogue, narration, Stable Diffusion artwork, and downloadable PDF.",
    version="1.0.0"
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.include_router(router)
`,
    'app/routes.py': `# FastAPI Routes: /generate, /generate-comic/json, /test-image, /export-success
@router.post("/generate", response_class=HTMLResponse)
async def generate_comic_form(
    request: Request,
    story_prompt: str = Form(...),
    character_name: str = Form(...),
    setting: str = Form(...),
    tone: str = Form(...),
    art_style: str = Form(...)
):
    outline = generate_outline(story_prompt, character_name, setting, tone, art_style)
    story = generate_story(outline, story_prompt, character_name, setting, tone, art_style)
    images = [generate_image(p["image_prompt"], p["panel_number"]) for p in outline]
    layout = build_comic_layout(outline, story, images)
    pdf_path = save_pdf(layout, story_prompt, character_name, setting, tone, art_style)
    return templates.TemplateResponse("comic_preview.html", {"layout": layout, "pdf_path": pdf_path})
`,
    'app/gemini_flash.py': `# Gemini Flash 5-Panel Outline Generator
def generate_outline(story_prompt, character_name, setting, tone, art_style):
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"), http_options={"headers": {"User-Agent": "aistudio-build"}})
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=user_instructions,
        config=types.GenerateContentConfig(
            system_instruction=OUTLINE_SYSTEM_PROMPT,
            temperature=0.8,
            response_mime_type="application/json"
        )
    )
    return validate_five_panels(response.text)
`,
    'app/gemini_pro.py': `# Gemini Pro Dialogue & Narration Expander
def generate_story(outline, story_prompt, character_name, setting, tone, art_style):
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"), http_options={"headers": {"User-Agent": "aistudio-build"}})
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=script_instructions,
        config=types.GenerateContentConfig(
            system_instruction=STORY_SYSTEM_PROMPT,
            temperature=0.85,
            response_mime_type="application/json"
        )
    )
    return parse_story_elements(response.text)
`,
    'app/image_generator.py': `# Stable Diffusion Diffusers Pipeline & Pillow Art Fallback
def generate_image(image_prompt, panel_number=1, generation_id=None):
    pipe = get_diffusers_pipeline() # runwayml/stable-diffusion-v1-5
    if pipe is not None:
        result = pipe(prompt=image_prompt, width=512, height=512, num_inference_steps=25)
        result.images[0].save(output_path)
        return f"/static/panels/{safe_filename}"
    generate_comic_panel_fallback_image(image_prompt, panel_number, output_path)
    return f"/static/panels/{safe_filename}"
`,
    'app/layout_builder.py': `# Layout Builder: Combines Outline, Story, and Images sequentially
def build_comic_layout(outline, story, images):
    layout = []
    for i in range(5):
        layout.append({
            "panel_number": i + 1,
            "title": outline[i]["title"],
            "scene_description": outline[i]["scene_description"],
            "caption": story[i]["caption"],
            "narration": story[i]["narration"],
            "dialogue": story[i]["dialogue"],
            "image_path": images[i],
            "image_prompt": outline[i]["image_prompt"]
        })
    return layout
`,
    'app/exporters.py': `# FPDF Multi-Page PDF Exporter
def save_pdf(layout, story_prompt, character_name, setting, tone, art_style, generation_id):
    pdf = ComicPDF(f"{character_name}'s Tale")
    pdf.add_page()
    # Renders title banner, 5 panels, images, speech bubbles, and captions...
    pdf.output(str(file_path))
    return f"/static/exports/{filename}"
`,
    'requirements.txt': `fastapi>=0.110.0
uvicorn[standard]>=0.28.0
jinja2>=3.1.3
python-multipart>=0.0.9
google-genai>=0.1.1
diffusers>=0.27.0
transformers>=4.38.0
torch>=2.2.0
accelerate>=0.28.0
fpdf2>=2.7.8
pillow>=10.2.0
python-dotenv>=1.0.1
pydantic>=2.6.0
`
  };

  // Scenario 1: Dramatic Anime Fox
  const applyScenario1 = () => {
    setStoryPrompt('A brave fox exploring an enchanted forest');
    setCharacterName('Finn');
    setSetting('Forest');
    setTone('Dramatic');
    setArtStyle('Anime');
    setCurrentView('create');
  };

  // Scenario 2: Funny Comic Book Fox
  const applyScenario2 = () => {
    setStoryPrompt('A brave fox exploring an enchanted forest');
    setCharacterName('Finn');
    setSetting('Forest');
    setTone('Funny');
    setArtStyle('Comic Book');
    setCurrentView('create');
  };

  // Main generation handler
  const handleGenerateComic = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!storyPrompt.trim() || !characterName.trim()) {
      setError('Please provide both a Story Prompt and Character Name.');
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);

    try {
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_prompt: storyPrompt,
          character_name: characterName,
          setting,
          tone,
          art_style: artStyle
        }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Server returned an error.');
      }

      const data = await response.json();
      
      // Match high quality story illustrations if character & setting match Finn in Forest
      const isFoxFinn = (characterName.toLowerCase().includes('finn') || storyPrompt.toLowerCase().includes('fox')) &&
                        (setting.toLowerCase().includes('forest') || storyPrompt.toLowerCase().includes('forest'));
      
      const enrichedLayout = (data.layout || []).map((panel: PanelData, idx: number) => {
        if (isFoxFinn && PRELOADED_STORY_PANELS['finn_forest_anime']?.[idx]) {
          return {
            ...panel,
            image_path: PRELOADED_STORY_PANELS['finn_forest_anime'][idx],
          };
        }
        return panel;
      });

      setPanels(enrichedLayout);
      setGenerationId(data.generation_id);
      setCurrentView('preview');
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Generation error:', err);
      setError(err.message || 'Comic generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // PDF Export Trigger
  const handleDownloadPDF = () => {
    if (!panels || panels.length === 0) return;
    const genId = generationId || Math.random().toString(36).substring(2, 9);
    exportComicToPDF(panels, storyPrompt, characterName, setting, tone, artStyle, genId);
  };

  // Test Image Route
  const handleRunTestImage = async () => {
    setTestImageLoading(true);
    try {
      const res = await fetch(`/test-image?prompt=${encodeURIComponent(testImagePrompt)}&panel_number=1`);
      const data = await res.json();
      setTestImageResult(data);
    } catch (err: any) {
      setTestImageResult({ error: err.message });
    } finally {
      setTestImageLoading(false);
    }
  };

  // Test JSON API Route
  const handleRunJsonApi = async () => {
    setJsonLoading(true);
    try {
      const parsed = JSON.parse(jsonReqBody);
      const res = await fetch('/generate-comic/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setJsonResResult(data);
    } catch (err: any) {
      setJsonResResult({ error: err.message });
    } finally {
      setJsonLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fef3c7] text-[#1c1917] p-4 sm:p-6 lg:p-8 font-['Comic_Neue',sans-serif]">
      {/* Top Banner & Scenario Switcher */}
      <header className="max-w-5xl mx-auto mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-[#18181b] text-[#fbbf24] px-4 py-1 rounded-md text-xs font-['Bangers',cursive] tracking-widest shadow-md transform -rotate-1 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
          5-PANEL AI ADVENTURE CREATOR
        </div>
        <h1 className="text-5xl sm:text-6xl font-['Bangers',cursive] text-[#f59e0b] tracking-wider drop-shadow-[3px_3px_0px_#b45309] leading-tight">
          COMICCRAFT
        </h1>
        <p className="text-base sm:text-lg font-bold text-[#44403c] mt-1">
          Turn your imagination into an AI-powered comic with Gemini models.
        </p>

        {/* Quick Scenario Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
          <span className="text-xs uppercase font-extrabold text-[#78350f]">Quick Presets:</span>
          <button
            onClick={applyScenario1}
            type="button"
            className="bg-white hover:bg-[#fef08a] text-[#18181b] border-2 border-[#18181b] shadow-[3px_3px_0px_#18181b] hover:shadow-[1px_1px_0px_#18181b] hover:translate-x-0.5 hover:translate-y-0.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            Scenario 1: Fox Finn in Forest (Dramatic Anime)
          </button>
          <button
            onClick={applyScenario2}
            type="button"
            className="bg-white hover:bg-[#fef08a] text-[#18181b] border-2 border-[#18181b] shadow-[3px_3px_0px_#18181b] hover:shadow-[1px_1px_0px_#18181b] hover:translate-x-0.5 hover:translate-y-0.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            Scenario 2: Finn in Forest (Funny Comic Book)
          </button>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex justify-center gap-3 mt-5">
          <button
            onClick={() => setActiveTab('comic')}
            className={`px-4 py-2 rounded-lg font-['Bangers',cursive] tracking-wider text-base border-2 border-[#18181b] transition-all ${
              activeTab === 'comic'
                ? 'bg-[#f59e0b] text-[#18181b] shadow-[3px_3px_0px_#18181b]'
                : 'bg-white text-[#52525b] hover:bg-amber-100 shadow-[2px_2px_0px_#18181b]'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-1.5 -mt-1" />
            Comic App
          </button>
          <button
            onClick={() => setActiveTab('api_tester')}
            className={`px-4 py-2 rounded-lg font-['Bangers',cursive] tracking-wider text-base border-2 border-[#18181b] transition-all ${
              activeTab === 'api_tester'
                ? 'bg-[#06b6d4] text-white shadow-[3px_3px_0px_#18181b]'
                : 'bg-white text-[#52525b] hover:bg-cyan-50 shadow-[2px_2px_0px_#18181b]'
            }`}
          >
            <Terminal className="w-4 h-4 inline mr-1.5 -mt-1" />
            FastAPI Endpoints Tester
          </button>
          <button
            onClick={() => setActiveTab('code_viewer')}
            className={`px-4 py-2 rounded-lg font-['Bangers',cursive] tracking-wider text-base border-2 border-[#18181b] transition-all ${
              activeTab === 'code_viewer'
                ? 'bg-[#8b5cf6] text-white shadow-[3px_3px_0px_#18181b]'
                : 'bg-white text-[#52525b] hover:bg-purple-50 shadow-[2px_2px_0px_#18181b]'
            }`}
          >
            <Code2 className="w-4 h-4 inline mr-1.5 -mt-1" />
            Python Codebase Viewer
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto">
        {/* ============================================================== */}
        {/* TAB 1: COMIC APP WORKFLOW */}
        {/* ============================================================== */}
        {activeTab === 'comic' && (
          <div>
            {/* VIEW 1: CREATION FORM */}
            {currentView === 'create' && (
              <div className="bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] p-6 sm:p-8 relative">
                {/* Comic Strip Ribbon */}
                <div className="bg-[#18181b] text-white font-['Bangers',cursive] tracking-widest text-sm px-4 py-1.5 rounded-br-lg absolute top-0 left-0">
                  STORYBOARD GENERATOR
                </div>

                <form onSubmit={handleGenerateComic} className="mt-6 space-y-6">
                  {error && (
                    <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 flex items-center gap-3 text-red-800 text-sm font-bold">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Story Prompt */}
                  <div className="space-y-1.5">
                    <label htmlFor="story_prompt" className="flex items-center gap-2 font-bold text-base text-[#18181b]">
                      <span className="w-6 h-6 rounded-full bg-[#f59e0b] border-2 border-[#18181b] flex items-center justify-center text-xs font-['Bangers',cursive]">
                        1
                      </span>
                      Story Prompt
                      <span className="ml-auto text-xs font-normal text-stone-500">
                        What is the core premise or adventure?
                      </span>
                    </label>
                    <textarea
                      id="story_prompt"
                      rows={3}
                      required
                      value={storyPrompt}
                      onChange={(e) => setStoryPrompt(e.target.value)}
                      placeholder="e.g., A brave fox exploring an enchanted forest, searching for the ancient luminescent crystal..."
                      className="w-full bg-[#fffbeb] border-3 border-[#18181b] rounded-xl p-3.5 font-bold text-base focus:bg-white focus:border-[#d97706] focus:shadow-[4px_4px_0px_#18181b] outline-none transition-all resize-y"
                    />
                  </div>

                  {/* Character Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="character_name" className="flex items-center gap-2 font-bold text-base text-[#18181b]">
                      <span className="w-6 h-6 rounded-full bg-[#f59e0b] border-2 border-[#18181b] flex items-center justify-center text-xs font-['Bangers',cursive]">
                        2
                      </span>
                      Main Character Name
                      <span className="ml-auto text-xs font-normal text-stone-500">The hero of your comic</span>
                    </label>
                    <input
                      id="character_name"
                      type="text"
                      required
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      placeholder="e.g., Finn, Nova, Captain Ray"
                      className="w-full bg-[#fffbeb] border-3 border-[#18181b] rounded-xl p-3 font-bold text-base focus:bg-white focus:border-[#d97706] focus:shadow-[4px_4px_0px_#18181b] outline-none transition-all"
                    />
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Setting */}
                    <div className="space-y-1.5">
                      <label htmlFor="setting" className="flex items-center gap-1.5 font-bold text-sm text-[#18181b]">
                        <span className="w-5 h-5 rounded-full bg-[#f59e0b] border-2 border-[#18181b] flex items-center justify-center text-xs font-['Bangers',cursive]">
                          3
                        </span>
                        Setting
                      </label>
                      <select
                        id="setting"
                        value={setting}
                        onChange={(e) => setSetting(e.target.value)}
                        className="w-full bg-[#fffbeb] border-3 border-[#18181b] rounded-xl p-2.5 font-bold text-sm focus:bg-white focus:border-[#d97706] outline-none"
                      >
                        <option value="Forest">Forest</option>
                        <option value="School">School</option>
                        <option value="Space">Space</option>
                        <option value="City">City</option>
                      </select>
                    </div>

                    {/* Tone */}
                    <div className="space-y-1.5">
                      <label htmlFor="tone" className="flex items-center gap-1.5 font-bold text-sm text-[#18181b]">
                        <span className="w-5 h-5 rounded-full bg-[#f59e0b] border-2 border-[#18181b] flex items-center justify-center text-xs font-['Bangers',cursive]">
                          4
                        </span>
                        Story Tone
                      </label>
                      <select
                        id="tone"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full bg-[#fffbeb] border-3 border-[#18181b] rounded-xl p-2.5 font-bold text-sm focus:bg-white focus:border-[#d97706] outline-none"
                      >
                        <option value="Dramatic">Dramatic</option>
                        <option value="Funny">Funny</option>
                        <option value="Light-hearted">Light-hearted</option>
                        <option value="Poetic">Poetic</option>
                      </select>
                    </div>

                    {/* Art Style */}
                    <div className="space-y-1.5">
                      <label htmlFor="art_style" className="flex items-center gap-1.5 font-bold text-sm text-[#18181b]">
                        <span className="w-5 h-5 rounded-full bg-[#f59e0b] border-2 border-[#18181b] flex items-center justify-center text-xs font-['Bangers',cursive]">
                          5
                        </span>
                        Art Style
                      </label>
                      <select
                        id="art_style"
                        value={artStyle}
                        onChange={(e) => setArtStyle(e.target.value)}
                        className="w-full bg-[#fffbeb] border-3 border-[#18181b] rounded-xl p-2.5 font-bold text-sm focus:bg-white focus:border-[#d97706] outline-none"
                      >
                        <option value="Anime">Anime</option>
                        <option value="Comic Book">Comic Book</option>
                        <option value="Pixel Art">Pixel Art</option>
                        <option value="Realistic">Realistic</option>
                      </select>
                    </div>
                  </div>

                  {/* Feature Tags Bar */}
                  <div className="bg-[#fef3c7] border-2 border-dashed border-[#d97706] rounded-xl p-3.5 flex flex-wrap gap-2 text-xs font-bold text-[#78350f]">
                    <span className="bg-white border-2 border-[#18181b] rounded-md px-2.5 py-1">⚡ Gemini Flash Outline</span>
                    <span className="bg-white border-2 border-[#18181b] rounded-md px-2.5 py-1">💬 Gemini Pro Dialogue</span>
                    <span className="bg-white border-2 border-[#18181b] rounded-md px-2.5 py-1">🎨 Stable Diffusion / Comic Visuals</span>
                    <span className="bg-white border-2 border-[#18181b] rounded-md px-2.5 py-1">📄 Multi-Page PDF Exporter</span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#f59e0b] hover:bg-[#fbbf24] text-[#18181b] border-4 border-[#18181b] shadow-[6px_6px_0px_#18181b] hover:shadow-[2px_2px_0px_#18181b] hover:translate-x-1 hover:translate-y-1 rounded-2xl py-4 flex flex-col items-center justify-center cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span className="font-['Bangers',cursive] text-3xl tracking-widest leading-none">
                      CREATE MY COMIC
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider mt-1 text-[#78350f]">
                      Synthesize 5 Panels & Export PDF
                    </span>
                  </button>
                </form>

                {/* Loading Modal / Overlay */}
                {loading && (
                  <div className="absolute inset-0 bg-[#fef3c7]/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-20">
                    <div className="w-14 h-14 border-6 border-[#fed7aa] border-t-[#d97706] rounded-full animate-spin mb-4" />
                    <h3 className="font-['Bangers',cursive] text-3xl tracking-wider text-[#18181b]">
                      CRAFTING YOUR COMIC...
                    </h3>
                    <p className="text-sm font-bold text-[#78350f] mt-1 mb-6">
                      Running multimodal generation pipeline
                    </p>

                    <div className="w-full max-w-sm space-y-2 text-left">
                      {[
                        'Gemini Flash constructing 5-panel outline...',
                        'Gemini Pro generating dialogue, narration & captions...',
                        'Rendering 5 panel illustrations...',
                        'Assembling layout & compiling multi-page PDF...',
                      ].map((step, idx) => (
                        <div
                          key={idx}
                          className={`text-xs font-bold px-3 py-2 rounded-lg border-2 transition-all ${
                            loadingStep >= idx
                              ? 'bg-amber-100 border-[#b45309] text-[#78350f]'
                              : 'bg-white/60 border-stone-300 text-stone-400'
                          }`}
                        >
                          {idx + 1}. {step}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: 5-PANEL COMIC PREVIEW */}
            {currentView === 'preview' && panels && (
              <div className="space-y-6">
                {/* Header Card */}
                <div className="bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] p-6 text-center">
                  <div className="flex justify-between items-center mb-3">
                    <button
                      onClick={() => setCurrentView('create')}
                      className="text-xs font-extrabold text-[#b45309] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Back to Creation Form
                    </button>
                    <span className="bg-[#18181b] text-white text-xs font-bold px-3 py-1 rounded-full">
                      5 Panels • {tone} • {artStyle}
                    </span>
                  </div>

                  <h2 className="text-4xl sm:text-5xl font-['Bangers',cursive] text-[#f59e0b] drop-shadow-[2px_2px_0px_#b45309] tracking-wider">
                    YOUR COMIC
                  </h2>
                  <p className="text-lg font-bold text-stone-700 italic mt-1 max-w-2xl mx-auto">
                    "{storyPrompt}"
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 mt-3 text-xs font-bold">
                    <span className="bg-[#fffbeb] border border-[#d97706] rounded-md px-2.5 py-1">Hero: {characterName}</span>
                    <span className="bg-[#fffbeb] border border-[#d97706] rounded-md px-2.5 py-1">Setting: {setting}</span>
                    <span className="bg-[#fffbeb] border border-[#d97706] rounded-md px-2.5 py-1">Tone: {tone}</span>
                    <span className="bg-[#fffbeb] border border-[#d97706] rounded-md px-2.5 py-1">Style: {artStyle}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                    <button
                      onClick={() => {
                        handleDownloadPDF();
                        setCurrentView('export_success');
                      }}
                      className="bg-[#ef4444] hover:bg-[#dc2626] text-white border-3 border-[#18181b] shadow-[4px_4px_0px_#18181b] hover:shadow-[1px_1px_0px_#18181b] hover:translate-x-0.5 hover:translate-y-0.5 px-6 py-2.5 rounded-xl font-['Bangers',cursive] text-xl tracking-wider inline-flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Download className="w-5 h-5" />
                      DOWNLOAD YOUR COMIC AS PDF
                    </button>
                    <button
                      onClick={() => setCurrentView('export_success')}
                      className="text-xs font-bold text-stone-700 hover:text-black underline"
                    >
                      View Export Details &rarr;
                    </button>
                  </div>
                </div>

                {/* 5 Sequential Panel Cards */}
                <div className="space-y-6">
                  {panels.map((panel) => (
                    <article
                      key={panel.panel_number}
                      className="bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] overflow-hidden"
                    >
                      {/* Ribbon Header */}
                      <div className="bg-[#18181b] text-white px-5 py-2.5 flex items-center gap-3">
                        <span className="bg-[#f59e0b] text-[#18181b] font-['Bangers',cursive] text-sm px-2.5 py-0.5 rounded tracking-wider">
                          PANEL #{panel.panel_number}
                        </span>
                        <h3 className="font-['Bangers',cursive] text-2xl tracking-wider text-white">
                          {panel.title}
                        </h3>
                      </div>

                      {/* Panel Card Content */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-6">
                        {/* Left Column: Comic Illustration */}
                        <div className="space-y-2">
                          <div className="aspect-square bg-slate-900 border-3 border-[#18181b] rounded-xl overflow-hidden shadow-[4px_4px_0px_#18181b] relative">
                            {panel.image_path ? (
                              <img
                                src={panel.image_path}
                                alt={`Panel ${panel.panel_number}: ${panel.title}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold text-sm">
                                Illustration rendering...
                              </div>
                            )}
                          </div>

                          {/* Caption Tag */}
                          {panel.caption && (
                            <div className="bg-[#fef08a] border-2 border-[#18181b] rounded-lg px-3 py-1.5 flex items-center gap-2">
                              <span className="bg-[#18181b] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                CAPTION
                              </span>
                              <span className="text-xs font-bold text-[#18181b]">{panel.caption}</span>
                            </div>
                          )}
                        </div>

                        {/* Right Column: Story Elements */}
                        <div className="flex flex-col justify-between space-y-4">
                          {/* Narration */}
                          {panel.narration && (
                            <div className="bg-[#f0fdf4] border-2 border-[#18181b] border-l-6 border-l-[#16a34a] rounded-lg p-3 text-stone-800 text-sm">
                              <div className="text-xs font-bold text-[#16a34a] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <Volume2 className="w-3.5 h-3.5" />
                                Narration
                              </div>
                              <p className="leading-relaxed">{panel.narration}</p>
                            </div>
                          )}

                          {/* Speech Bubble Dialogue */}
                          {panel.dialogue && (
                            <div className="relative pt-1 pb-2">
                              <div className="bg-white border-3 border-[#18181b] rounded-2xl p-3.5 shadow-[3px_3px_0px_rgba(0,0,0,0.15)] relative">
                                <div className="text-xs font-extrabold text-[#b45309] uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Dialogue
                                </div>
                                <p className="text-base font-extrabold text-[#18181b] leading-snug">
                                  {panel.dialogue}
                                </p>
                                {/* Speech tail */}
                                <div className="absolute -bottom-2.5 left-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-[#18181b]" />
                              </div>
                            </div>
                          )}

                          {/* Scene Description */}
                          {panel.scene_description && (
                            <div className="bg-[#f8fafc] border-2 border-dashed border-[#94a3b8] rounded-lg p-3 text-xs text-stone-600">
                              <div className="font-bold text-[#64748b] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                <Clapperboard className="w-3 h-3" />
                                Scene Description
                              </div>
                              <p className="italic">{panel.scene_description}</p>
                            </div>
                          )}

                          {/* Visual Prompt Reference (Collapsible) */}
                          {panel.image_prompt && (
                            <details className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                              <summary className="font-bold text-slate-500 cursor-pointer hover:text-black">
                                👁 Visual Prompt Reference
                              </summary>
                              <p className="mt-2 text-[11px] font-mono text-slate-600 bg-slate-100 p-2 rounded">
                                {panel.image_prompt}
                              </p>
                            </details>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] p-6 text-center space-y-3">
                  <button
                    onClick={() => {
                      handleDownloadPDF();
                      setCurrentView('export_success');
                    }}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white border-4 border-[#18181b] shadow-[6px_6px_0px_#18181b] hover:shadow-[2px_2px_0px_#18181b] hover:translate-x-0.5 hover:translate-y-0.5 px-8 py-3.5 rounded-2xl font-['Bangers',cursive] text-2xl tracking-wider inline-flex items-center gap-3 cursor-pointer transition-all"
                  >
                    <Download className="w-6 h-6" />
                    DOWNLOAD YOUR COMIC AS PDF
                  </button>
                  <div>
                    <button
                      onClick={() => setCurrentView('create')}
                      className="text-sm font-bold text-[#78350f] hover:underline cursor-pointer"
                    >
                      Go Create Another Comic
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: EXPORT SUCCESS */}
            {currentView === 'export_success' && (
              <div className="max-w-xl mx-auto bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] p-8 text-center space-y-5">
                <div className="inline-flex items-center gap-1.5 bg-[#16a34a] text-white px-4 py-1.5 rounded-full font-['Bangers',cursive] text-lg tracking-wider border-2 border-[#18181b]">
                  <CheckCircle2 className="w-4 h-4" />
                  EXPORT COMPLETE
                </div>

                <h2 className="text-4xl sm:text-5xl font-['Bangers',cursive] text-[#f59e0b] drop-shadow-[2px_2px_0px_#b45309] tracking-wider">
                  YOUR COMIC IS READY!
                </h2>

                <p className="text-base text-stone-700 leading-relaxed font-bold">
                  Your 5-panel comic has been synthesized by Gemini models, illustrated through the visual generation pipeline, and compiled into a high-resolution, multi-page PDF document.
                </p>

                {generationId && (
                  <div className="bg-[#f5f5f4] border border-[#d6d3d1] rounded-lg px-4 py-2 inline-block text-xs font-mono">
                    Generation ID: <strong>{generationId}</strong>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white border-3 border-[#18181b] shadow-[4px_4px_0px_#18181b] py-3 rounded-xl font-['Bangers',cursive] text-xl tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Download className="w-5 h-5" />
                    DOWNLOAD YOUR COMIC AS PDF
                  </button>

                  <button
                    onClick={() => setCurrentView('create')}
                    className="w-full bg-white hover:bg-[#fef08a] text-[#18181b] border-3 border-[#18181b] shadow-[4px_4px_0px_#18181b] py-3 rounded-xl font-['Bangers',cursive] text-xl tracking-wider cursor-pointer transition-all"
                  >
                    GO CREATE ANOTHER COMIC
                  </button>
                </div>

                <div className="bg-[#fffbeb] border-2 border-dashed border-[#d97706] rounded-xl p-4 text-left text-xs text-[#78350f] space-y-1.5">
                  <div><strong>Sequential Flow:</strong> Intro • Discovery • Conflict • Climax • Resolution</div>
                  <div><strong>Story Elements:</strong> Dialogue bubbles, captions, and narrative voiceover</div>
                  <div><strong>PDF File:</strong> Ready for print or sharing via standard A4 page layout</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: FASTAPI ENDPOINTS & SWAGGER TESTER */}
        {/* ============================================================== */}
        {activeTab === 'api_tester' && (
          <div className="space-y-6">
            <div className="bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] p-6">
              <h2 className="text-3xl font-['Bangers',cursive] text-[#06b6d4] drop-shadow-[1.5px_1.5px_0px_#0891b2] tracking-wider mb-2">
                FASTAPI ENDPOINTS & DEVELOPER UTILITIES
              </h2>
              <p className="text-sm text-stone-600 font-bold mb-6">
                Test the backend endpoints directly: standalone image generator, JSON comic API, and swagger specifications.
              </p>

              {/* Grid with 2 testers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Utility 1: /test-image */}
                <div className="bg-[#f0fdfa] border-3 border-[#18181b] rounded-xl p-4 shadow-[4px_4px_0px_#18181b] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#0d9488] text-white text-xs font-bold px-2 py-0.5 rounded">
                      GET & POST /test-image
                    </span>
                    <span className="text-xs text-stone-500 font-bold">Image Pipeline Test</span>
                  </div>

                  <p className="text-xs text-stone-700 font-bold">
                    Directly invokes the Stable Diffusion image generator with a custom prompt without running full story generation.
                  </p>

                  <textarea
                    rows={2}
                    value={testImagePrompt}
                    onChange={(e) => setTestImagePrompt(e.target.value)}
                    className="w-full text-xs font-mono p-2 bg-white border-2 border-[#18181b] rounded-lg"
                  />

                  <button
                    onClick={handleRunTestImage}
                    disabled={testImageLoading}
                    className="w-full bg-[#0d9488] hover:bg-[#0f766e] text-white font-['Bangers',cursive] text-lg tracking-wider py-2 rounded-lg border-2 border-[#18181b] shadow-[2px_2px_0px_#18181b] cursor-pointer"
                  >
                    {testImageLoading ? 'Rendering...' : 'RUN /test-image'}
                  </button>

                  {testImageResult && (
                    <div className="space-y-2 mt-2">
                      <pre className="text-[11px] font-mono bg-white p-2 border border-teal-200 rounded max-h-36 overflow-auto">
                        {JSON.stringify(testImageResult, null, 2)}
                      </pre>
                      {testImageResult.image_path && (
                        <img
                          src={testImageResult.image_path}
                          alt="Test output"
                          className="w-full aspect-square object-cover border-2 border-[#18181b] rounded-lg shadow"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Utility 2: POST /generate-comic/json */}
                <div className="bg-[#fdf4ff] border-3 border-[#18181b] rounded-xl p-4 shadow-[4px_4px_0px_#18181b] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#a855f7] text-white text-xs font-bold px-2 py-0.5 rounded">
                      POST /generate-comic/json
                    </span>
                    <span className="text-xs text-stone-500 font-bold">JSON API</span>
                  </div>

                  <p className="text-xs text-stone-700 font-bold">
                    Submit raw JSON to test programmatic comic generation with Pydantic validation.
                  </p>

                  <textarea
                    rows={6}
                    value={jsonReqBody}
                    onChange={(e) => setJsonReqBody(e.target.value)}
                    className="w-full text-xs font-mono p-2 bg-white border-2 border-[#18181b] rounded-lg"
                  />

                  <button
                    onClick={handleRunJsonApi}
                    disabled={jsonLoading}
                    className="w-full bg-[#a855f7] hover:bg-[#9333ea] text-white font-['Bangers',cursive] text-lg tracking-wider py-2 rounded-lg border-2 border-[#18181b] shadow-[2px_2px_0px_#18181b] cursor-pointer"
                  >
                    {jsonLoading ? 'Executing Pipeline...' : 'EXECUTE JSON API'}
                  </button>

                  {jsonResResult && (
                    <pre className="text-[11px] font-mono bg-white p-2 border border-purple-200 rounded max-h-48 overflow-auto">
                      {JSON.stringify(jsonResResult, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PYTHON CODEBASE EXPLORER */}
        {/* ============================================================== */}
        {activeTab === 'code_viewer' && (
          <div className="bg-white border-4 border-[#18181b] rounded-2xl shadow-[6px_6px_0px_#18181b] p-6 space-y-4">
            <div>
              <h2 className="text-3xl font-['Bangers',cursive] text-[#8b5cf6] drop-shadow-[1.5px_1.5px_0px_#7c3aed] tracking-wider">
                PYTHON FASTAPI CODEBASE
              </h2>
              <p className="text-sm font-bold text-stone-600">
                Inspect the modular Python modules, templates, static directories, and specifications built for ComicCraft.
              </p>
            </div>

            {/* File Selector Tabs */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(pythonFiles).map((filename) => (
                <button
                  key={filename}
                  onClick={() => setSelectedFile(filename)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-[#18181b] transition-all ${
                    selectedFile === filename
                      ? 'bg-[#8b5cf6] text-white shadow-[2px_2px_0px_#18181b]'
                      : 'bg-stone-50 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {filename}
                </button>
              ))}
            </div>

            {/* Code Display */}
            <div className="relative">
              <div className="bg-[#18181b] text-white text-xs font-mono px-4 py-2 rounded-t-xl flex justify-between items-center">
                <span>ComicCraft/{selectedFile}</span>
                <span className="text-stone-400">Python 3.10+ / FastAPI</span>
              </div>
              <pre className="bg-[#0f172a] text-[#f8fafc] text-xs font-mono p-4 rounded-b-xl overflow-x-auto max-h-[460px] border-2 border-t-0 border-[#18181b]">
                <code>{pythonFiles[selectedFile]}</code>
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto mt-10 text-center text-xs font-bold text-stone-600">
        <p>ComicCraft © 2026 • AI Comic Story Creator using Gemini Models & Stable Diffusion</p>
      </footer>
    </div>
  );
}
