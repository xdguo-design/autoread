import os
from openai import AsyncOpenAI

class AnalyzerService:
    def __init__(self):
        self.default_base_url = os.getenv("OPENAI_BASE_URL") or "https://api.deepseek.com/v1"
        self.default_model = os.getenv("OPENAI_MODEL") or "deepseek-chat"

    async def analyze_content(self, text: str, llm: dict | None = None, chapters: list[str] | None = None, word_count: int = 1000):
        llm = llm or {}
        base_url = (llm.get("base_url") or self.default_base_url).strip()
        model = (llm.get("model") or self.default_model).strip()
        api_key = (llm.get("api_key") or os.getenv("OPENAI_API_KEY") or "").strip()

        # Simple language detection (checking for Chinese characters)
        is_chinese = any('\u4e00' <= char <= '\u9fff' for char in text[:1000])
        language_instruction = "Respond in the same language as the content (Chinese if content is Chinese)."
        
        chapters_context = ""
        if chapters:
            if is_chinese:
                chapters_context = "用户选择了以下章节/主题进行重点分析：\n" + "\n".join([f"- {c}" for c in chapters]) + "\n\n"
            else:
                chapters_context = "The user has selected the following chapters/topics to focus on:\n" + "\n".join([f"- {c}" for c in chapters]) + "\n\n"

        if is_chinese:
            prompt = f"""
            你是一位专业的文案编辑。
            分析以下网页内容，并创作一篇约 {word_count} 字的文章，适用于视频旁白。
            {chapters_context}
            要求：
            1) 按章节/部分组织内容，并带有清晰的标题。
            2) 对于每个章节：总结核心观点，并加入合理的扩充/背景知识以提高可读性。
            3) 输出适合口播的文案，语气自然、流畅。
            4) 必须使用中文回答。
            
            内容：
            {text[:8000]}
            """
        else:
            prompt = f"""
            You are a professional content editor. 
            Analyze the following web content and produce an approximately {word_count}-word article suitable for video narration.
            {chapters_context}
            Requirements:
            1) Organize content by chapters/sections with clear headings.
            2) For each chapter: summarize the core points and add reasonable expansions/background to improve readability.
            3) Output narration-friendly text, natural and smooth.
            4) Respond in English.
            
            Content:
            {text[:8000]}
            """
        
        try:
            if not api_key:
                return (
                    f"这是一个模拟摘要：当前未配置 API Key，因此未调用 AI。配置后会根据网页内容按章节生成约 {word_count} 字文章，并做适度扩展。" if is_chinese else f"This is a mock summary: API Key not configured. AI will generate a ~{word_count} word article based on web content after configuration.",
                    {"enabled": False, "base_url": base_url, "model": model}
                )

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)
            system_msg = "你是一个专门负责网页内容摘要的助手。" if is_chinese else "You are a helpful assistant that summarizes web content."
            
            # Adjust max_tokens based on word count (approx 2 tokens per word for safety)
            max_tokens = max(2000, word_count * 2)
            
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens
            )
            return response.choices[0].message.content, {"enabled": True, "base_url": base_url, "model": model}
        except Exception as e:
            print(f"AI Analysis failed: {e}")
            return (
                f"AI Analysis failed. Original text preview: {text[:500]}...",
                {"enabled": False, "base_url": base_url, "model": model, "error": str(e)}
            )
