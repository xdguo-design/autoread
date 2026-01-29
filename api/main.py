from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import uuid
import asyncio
from dotenv import load_dotenv

# Import services
from .services.scraper import ScraperService
from .services.analyzer import AnalyzerService
from .services.video_generator import VideoGeneratorService

# Load environment variables
load_dotenv(dotenv_path="../.env")

app = FastAPI(title="AutoRead API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
tasks = {}

# Models
class LLMConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None

class ProcessRequest(BaseModel):
    url: str
    user_id: str | None = None
    llm: LLMConfig | None = None
    chapters: list[str] | None = None
    voice: str | None = None
    word_count: int | None = 1000

class ExtractChaptersRequest(BaseModel):
    url: str

class VoicePreviewRequest(BaseModel):
    voice: str
    text: str | None = None

# Services initialization
scraper_service = ScraperService()
analyzer_service = AnalyzerService()
video_generator_service = VideoGeneratorService()

async def process_task(task_id: str, url: str, llm: dict | None, chapters: list[str] | None = None, voice: str | None = None, word_count: int = 1000):
    try:
        # 1. Scraping
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 10
        tasks[task_id]["message"] = "Scraping web content..."
        
        scrape_result = await scraper_service.scrape_url(url, task_id)

        source_path = os.path.join("storage", "articles", f"{task_id}.source.md")
        os.makedirs(os.path.dirname(source_path), exist_ok=True)
        with open(source_path, "w", encoding="utf-8") as f:
            f.write(f"# {scrape_result['title']}\n\n## Extracted Content\n\n{scrape_result['content']}\n")
        tasks[task_id]["result"]["source_path"] = source_path
        tasks[task_id]["result"]["images"] = scrape_result.get("images") or []
        tasks[task_id]["result"]["screenshots"] = scrape_result.get("screenshots") or []
        
        # 2. Analyzing
        tasks[task_id]["progress"] = 40
        tasks[task_id]["message"] = "Analyzing content with AI..."
        
        summary_text, llm_meta = await analyzer_service.analyze_content(scrape_result["content"], llm=llm, chapters=chapters, word_count=word_count)
        tasks[task_id]["meta"]["llm"] = llm_meta
        
        # Save article
        article_path = os.path.join("storage", "articles", f"{task_id}.md")
        os.makedirs(os.path.dirname(article_path), exist_ok=True)
        with open(article_path, "w", encoding="utf-8") as f:
            f.write(f"# {scrape_result['title']}\n\n{summary_text}")
            
        tasks[task_id]["result"]["article_path"] = article_path
        
        # 3. Generating Video
        tasks[task_id]["progress"] = 70
        tasks[task_id]["message"] = "Generating video..."
        
        video_result = await video_generator_service.generate_video(
            summary_text, 
            scrape_result.get("images") or [],
            scrape_result["screenshots"], 
            task_id,
            voice=voice
        )
        
        tasks[task_id]["result"]["video_path"] = video_result["video_path"]
        tasks[task_id]["result"]["visuals_used"] = scrape_result.get("images") or scrape_result.get("screenshots") or []
        tasks[task_id]["meta"]["tts"] = {
            "voice": video_result.get("voice"),
            "audio_fallback": video_result.get("audio_fallback", False)
        }
        
        # Complete
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["message"] = "Task completed successfully!"
        
    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["message"] = f"Error: {str(e)}"
        print(f"Task {task_id} failed: {e}")

@app.get("/")
def read_root():
    return {"message": "Welcome to AutoRead API"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/extract-chapters")
async def extract_chapters(request: ExtractChaptersRequest):
    try:
        result = await scraper_service.get_chapters(request.url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tts/voices")
async def get_voices():
    return video_generator_service.get_available_voices()

@app.post("/api/tts/preview")
async def preview_voice(request: VoicePreviewRequest):
    try:
        text = request.text or "你好，这是 Auto Read 的试听片段。祝您使用愉快！"
        path = await video_generator_service.generate_preview(request.voice, text)
        return FileResponse(path, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process")
async def process_url(request: ProcessRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "id": task_id,
        "url": request.url,
        "status": "pending",
        "progress": 0,
        "message": "Task created",
        "meta": {
            "llm": None,
            "tts": None
        },
        "result": {
            "article_path": None,
            "video_path": None,
            "source_path": None,
            "images": [],
            "screenshots": [],
            "visuals_used": []
        }
    }
    
    llm = request.llm.model_dump() if request.llm else None
    if llm and not llm.get("api_key"):
        llm.pop("api_key", None)
    
    word_count = request.word_count or 1000
    background_tasks.add_task(process_task, task_id, request.url, llm, request.chapters, request.voice, word_count)
    
    return {"task_id": task_id, "status": "pending", "message": "Task started"}

@app.get("/api/status/{task_id}")
def get_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    return {
        "task_id": task["id"],
        "status": task["status"],
        "progress": task["progress"],
        "message": task["message"],
        "has_article": bool(task["result"]["article_path"]),
        "has_video": bool(task["result"]["video_path"]),
        "has_source": bool(task["result"].get("source_path")),
        "image_count": len(task["result"].get("images") or []),
        "screenshot_count": len(task["result"].get("screenshots") or []),
        "visual_count": len(task["result"].get("visuals_used") or []),
        "llm": task.get("meta", {}).get("llm"),
        "tts": task.get("meta", {}).get("tts")
    }

@app.get("/api/task/{task_id}/markdown/{kind}")
def get_markdown(task_id: str, kind: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]
    if kind == "source":
        path = task["result"].get("source_path")
    elif kind == "article":
        path = task["result"].get("article_path")
    else:
        raise HTTPException(status_code=400, detail="Invalid markdown kind")

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Markdown not found")

    with open(path, "r", encoding="utf-8") as f:
        return {"task_id": task_id, "kind": kind, "markdown": f.read()}

@app.get("/api/task/{task_id}/assets")
def get_assets(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]

    def to_urls(paths: list[str], asset_type: str):
        items = []
        for p in paths or []:
            name = os.path.basename(p)
            items.append({"name": name, "url": f"/api/task/{task_id}/asset/{asset_type}/{name}"})
        return items

    images = to_urls(task["result"].get("images") or [], "images")
    screenshots = to_urls(task["result"].get("screenshots") or [], "screenshots")
    visuals_used = sorted(set(os.path.basename(p) for p in (task["result"].get("visuals_used") or [])))

    return {
        "task_id": task_id,
        "images": images,
        "screenshots": screenshots,
        "visuals_used": visuals_used
    }

@app.get("/api/task/{task_id}/asset/{asset_type}/{filename}")
def get_asset(task_id: str, asset_type: str, filename: str):
    if asset_type not in {"images", "screenshots"}:
        raise HTTPException(status_code=400, detail="Invalid asset type")

    filename = os.path.basename(filename)
    base_dir = os.path.join("storage", asset_type, task_id)
    path = os.path.join(base_dir, filename)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Asset not found")

    return FileResponse(path)

@app.get("/api/download/{file_type}/{task_id}")
def download_file(file_type: str, task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task = tasks[task_id]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Task not completed yet")
        
    if file_type == "article":
        path = task["result"]["article_path"]
        media_type = "text/markdown"
        filename = "summary.md"
    elif file_type == "video":
        path = task["result"]["video_path"]
        media_type = "video/mp4"
        filename = "video.mp4"
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(path, media_type=media_type, filename=filename)
