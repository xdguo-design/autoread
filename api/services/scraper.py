import os
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import uuid
import asyncio
from urllib.parse import urljoin, urlparse
import requests

class ScraperService:
    def __init__(self, storage_dir="storage"):
        self.storage_dir = storage_dir
        self.screenshots_dir = os.path.join(storage_dir, "screenshots")
        self.images_dir = os.path.join(storage_dir, "images")
        os.makedirs(self.screenshots_dir, exist_ok=True)
        os.makedirs(self.images_dir, exist_ok=True)

    async def get_chapters(self, url: str):
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                # Set language to Chinese to prefer Chinese content
                context = await browser.new_context(
                    locale="zh-CN",
                    extra_http_headers={"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"}
                )
                page = await context.new_page()
                try:
                    await page.goto(url, wait_until="networkidle", timeout=60000)
                    
                    # Try to find and click Chinese language toggle if page seems to be in English
                    # Common patterns for Chinese language buttons
                    await self._try_switch_to_chinese(page)
                    
                    content = await page.content()
                    soup = BeautifulSoup(content, 'html.parser')
                    
                    # Remove noise
                    for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                        script.decompose()

                    chapters = []
                    # Look for headings as potential chapters
                    for tag in soup.find_all(['h1', 'h2', 'h3']):
                        text = tag.get_text(strip=True)
                        if text and len(text) > 2:
                            chapters.append({
                                "id": str(uuid.uuid4()),
                                "text": text,
                                "level": int(tag.name[1])
                            })
                    
                    # If no headings found, try to find paragraphs that look like headings
                    if not chapters:
                        for p_tag in soup.find_all('p'):
                            text = p_tag.get_text(strip=True)
                            if 2 < len(text) < 100 and any(c.isdigit() for c in text[:3]):
                                chapters.append({
                                    "id": str(uuid.uuid4()),
                                    "text": text,
                                    "level": 4
                                })

                    return {
                        "title": await page.title(),
                        "chapters": chapters[:20] # Limit to 20 chapters
                    }
                finally:
                    await browser.close()
        except Exception as e:
            print(f"Failed to get chapters: {e}")
            return {"title": url, "chapters": []}

    async def scrape_url(self, url: str, task_id: str):
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                # Set language to Chinese to prefer Chinese content
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    locale="zh-CN",
                    extra_http_headers={"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"}
                )
                page = await context.new_page()
                
                try:
                    await page.goto(url, wait_until="networkidle", timeout=60000)
                    
                    # Try to find and click Chinese language toggle if page seems to be in English
                    await self._try_switch_to_chinese(page)
                    
                    title = await page.title()
                    
                    screenshot_paths = []
                    task_screenshot_dir = os.path.join(self.screenshots_dir, task_id)
                    os.makedirs(task_screenshot_dir, exist_ok=True)
                    
                    path1 = os.path.join(task_screenshot_dir, "screenshot_1.png")
                    await page.screenshot(path=path1)
                    screenshot_paths.append(path1)
                    
                    # Scroll multiple times to trigger lazy loading
                    for _ in range(3):
                        await page.evaluate("window.scrollBy(0, window.innerHeight)")
                        await asyncio.sleep(0.5)
                    
                    path2 = os.path.join(task_screenshot_dir, "screenshot_2.png")
                    await page.screenshot(path=path2)
                    screenshot_paths.append(path2)
    
                    task_images_dir = os.path.join(self.images_dir, task_id)
                    os.makedirs(task_images_dir, exist_ok=True)
                    image_paths: list[str] = []
    
                    image_candidates = await page.evaluate(
                        """() => {
                          const selectors = ['article img', 'main img', 'img'];
                          const seen = new Set();
                          const out = [];
                          for (const selector of selectors) {
                            const nodes = document.querySelectorAll(selector);
                            for (const img of nodes) {
                              // Check multiple attributes for the real image URL (lazy loading)
                              const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('lazy-src');
                              if (!src) continue;
                              if (src.startsWith('data:')) continue;
                              if (seen.has(src)) continue;
                              
                              // Basic filter for small icons/tracking pixels
                              const w = img.naturalWidth || img.width || 0;
                              const h = img.naturalHeight || img.height || 0;
                              // Don't filter if we don't know dimensions yet, but skip if we know they are tiny
                              if (w > 0 && h > 0 && (w * h) < 10000) continue; 
                              
                              seen.add(src);
                              out.push({ src, w, h });
                              if (out.length >= 20) return out; // Increased limit
                            }
                            if (out.length >= 20) return out;
                          }
                          return out;
                        }"""
                    )
    
                    for idx, item in enumerate(image_candidates or []):
                        try:
                            raw_src = item.get("src")
                            if not raw_src:
                                continue
                            resolved = urljoin(page.url, raw_src)
                            if resolved.startswith("data:"):
                                continue
                            response = await context.request.get(resolved, timeout=20000)
                            if not response.ok:
                                continue
                            content_type = response.headers.get("content-type")
                            if content_type and not content_type.lower().startswith("image/"):
                                continue
                            ext = self._infer_extension(resolved, content_type)
                            img_path = os.path.join(task_images_dir, f"image_{idx + 1}{ext}")
                            body = await response.body()
                            with open(img_path, "wb") as f:
                                f.write(body)
                            image_paths.append(img_path)
                        except Exception:
                            continue
     
                    content = await page.content()
                    soup = BeautifulSoup(content, 'html.parser')
                    for script in soup(["script", "style", "nav", "footer", "header"]):
                        script.decompose()
                    text = soup.get_text(separator=' ', strip=True)
                    
                    return {
                        "title": title,
                        "content": text[:10000],
                        "screenshots": screenshot_paths,
                        "images": image_paths
                    }
                    
                finally:
                    await browser.close()
        except Exception:
            return await asyncio.to_thread(self._scrape_via_requests, url, task_id)

    async def _try_switch_to_chinese(self, page):
        """Attempts to find and click a Chinese language toggle if the page is not in Chinese."""
        try:
            # Check if page is already in Chinese (simplified or traditional)
            lang = await page.get_attribute('html', 'lang')
            if lang and ('zh' in lang.lower()):
                return

            # Common selectors for language switchers
            # We look for text like "中文", "简体", "CN", "CHS"
            selectors = [
                "text='中文'", "text='简体中文'", "text='简体'", 
                "a:has-text('中文')", "button:has-text('中文')",
                ".lang-switch", "#lang-switch", "[data-lang='zh-CN']"
            ]
            
            for selector in selectors:
                try:
                    element = await page.wait_for_selector(selector, timeout=2000)
                    if element and await element.is_visible():
                        await element.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        break
                except Exception:
                    continue
        except Exception as e:
            print(f"Error switching language: {e}")

    def _infer_extension(self, url: str, content_type: str | None):
        if content_type:
            ct = content_type.split(";")[0].strip().lower()
            if ct == "image/jpeg":
                return ".jpg"
            if ct == "image/png":
                return ".png"
            if ct == "image/webp":
                return ".webp"
            if ct == "image/gif":
                return ".gif"
        path = urlparse(url).path.lower()
        for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            if path.endswith(ext):
                return ".jpg" if ext == ".jpeg" else ext
        return ".jpg"

    def _scrape_via_requests(self, url: str, task_id: str):
        headers = {
            "User-Agent": "Mozilla/5.0 AutoRead/1.0",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        }
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.get_text(strip=True) if soup.title else url

        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()

        text = soup.get_text(separator=" ", strip=True)

        task_images_dir = os.path.join(self.images_dir, task_id)
        os.makedirs(task_images_dir, exist_ok=True)
        image_paths: list[str] = []
        img_tags = soup.select("article img, main img, img")
        seen: set[str] = set()
        for idx, img in enumerate(img_tags):
            if len(image_paths) >= 20:
                break
            src = img.get("src") or img.get("data-src") or img.get("data-original") or img.get("lazy-src")
            if not src:
                continue
            if src.startswith("data:"):
                continue
            resolved = urljoin(url, src)
            if resolved in seen:
                continue
            seen.add(resolved)
            try:
                r = requests.get(resolved, headers=headers, timeout=20)
                if r.status_code != 200:
                    continue
                content_type = r.headers.get("content-type")
                if content_type and not content_type.lower().startswith("image/"):
                    continue
                ext = self._infer_extension(resolved, content_type)
                img_path = os.path.join(task_images_dir, f"image_{idx + 1}{ext}")
                with open(img_path, "wb") as f:
                    f.write(r.content)
                image_paths.append(img_path)
            except Exception:
                continue

        return {
            "title": title,
            "content": text[:10000],
            "screenshots": [],
            "images": image_paths
        }
