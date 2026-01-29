import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';

type TranslateVars = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: TranslateVars) => string;
};

const STORAGE_KEY = 'autoread_locale';

const translations: Record<Locale, Record<string, string>> = {
  zh: {
    'nav.home': '首页',
    'nav.generate': '生成',
    'nav.history': '历史',
    'nav.language': '语言',
    'nav.toggle': '中 / EN',

    'home.title': '把网页内容变成视频',
    'home.subtitle': 'AutoRead 会从任意网址抓取内容，使用 AI 生成约 1000 字的文章，并自动配音生成视频。',
    'home.urlPlaceholder': '粘贴文章链接…',
    'home.start': '开始生成',
    'home.starting': '启动中…',
    'home.errorStartTask': '启动任务失败，请重试。',
    'home.back': '返回首页',
    'home.feature1.title': '智能抓取',
    'home.feature1.desc': '自动识别并提取网页主体内容，减少无关干扰。',
    'home.feature2.title': 'AI 总结',
    'home.feature2.desc': '将长文浓缩成适合配音的讲稿，并补充扩展重点。',
    'home.feature3.title': '视频生成',
    'home.feature3.desc': '一键生成带配音与画面的 MP4 视频。',
    'home.aiSettings': 'AI 设置',
    'home.aiBaseUrl': 'API 地址',
    'home.aiModel': '模型',
    'home.aiApiKey': 'API Key',
    'home.aiApiKeyHint': '留空则使用模拟模式',
    'home.voiceSettings': '声音设置',
    'home.voiceSelect': '选择配音音色',
    'home.voicePreview': '试听',
    'home.wordCount': '生成字数',
    'home.wordCountCustom': '自定义字数',
    'home.chapters.title': '选择要生成的章节',
    'home.chapters.subtitle': '我们为您提取了以下章节，请选择您感兴趣的内容。',
    'home.chapters.confirm': '确认并开始生成',
    'home.chapters.extracting': '正在提取章节...',
    'home.chapters.noChapters': '未检测到明显章节，将处理全文。',
    'home.chapters.selectAll': '全选',
    'home.chapters.deselectAll': '取消全选',
    'home.chapters.back': '返回',

    'generate.noTask': '未提供任务 ID。',
    'generate.title.processing': '正在生成内容',
    'generate.title.completed': '生成完成',
    'generate.badge.processing': '处理中',
    'generate.errorFetch': '获取任务状态失败',
    'generate.errorNotFound': '任务不存在或已过期（可能由于服务器重启导致）。',
    'generate.taskFailed': '任务失败：{message}',
    'generate.progress': '进度',
    'generate.initializing': '初始化中…',
    'generate.step.scrape': '网页抓取',
    'generate.step.ai': 'AI 分析',
    'generate.step.video': '视频生成',
    'generate.result.articleTitle': '文章摘要',
    'generate.result.articleDesc': 'AI 生成的内容总结。',
    'generate.result.downloadMd': '下载 Markdown',
    'generate.result.videoTitle': '生成的视频',
    'generate.result.videoDesc': '包含配音与画面的视频。',
    'generate.result.downloadVideo': '下载视频',
    'generate.another': '再生成一个',
    'generate.section.ai': '模型与 API',
    'generate.section.source': '抓取内容（Markdown）',
    'generate.section.article': '生成内容（Markdown）',
    'generate.section.assets': '背景素材',
    'generate.assets.images': '网页图片',
    'generate.assets.screenshots': '网页截图',
    'generate.ai.model': '模型',
    'generate.ai.baseUrl': 'API 地址',
    'generate.ai.enabled': '已配置 API Key',
    'generate.ai.disabled': '未配置 API Key（使用模拟结果）',

    'history.title': '历史记录',
    'history.clear': '清空记录',
    'history.confirmClear': '确定要清空历史记录吗？',
    'history.empty': '暂无历史记录。',
    'history.startFirst': '开始第一次生成',

    'footer.rights': '版权所有。',
  },
  en: {
    'nav.home': 'Home',
    'nav.generate': 'Generate',
    'nav.history': 'History',
    'nav.language': 'Language',
    'nav.toggle': '中 / EN',

    'home.title': 'Turn Web Content into Videos',
    'home.subtitle': 'AutoRead extracts content from any URL, summarizes it with AI into ~1000 words, and generates a narrated video.',
    'home.urlPlaceholder': 'Paste article URL here…',
    'home.start': 'Start Generating',
    'home.starting': 'Starting…',
    'home.errorStartTask': 'Failed to start task. Please try again.',
    'home.back': 'Back to Home',
    'home.feature1.title': 'Smart Extraction',
    'home.feature1.desc': 'Automatically extracts the main content and reduces noise.',
    'home.feature2.title': 'AI Summarization',
    'home.feature2.desc': 'Creates a narration-friendly script with key expansions.',
    'home.feature3.title': 'Video Generation',
    'home.feature3.desc': 'Generates an MP4 video with voiceover and visuals.',
    'home.aiSettings': 'AI Settings',
    'home.aiBaseUrl': 'API Base URL',
    'home.aiModel': 'Model',
    'home.aiApiKey': 'API Key',
    'home.aiApiKeyHint': 'Leave blank for mock mode',
    'home.voiceSettings': 'Voice Settings',
    'home.voiceSelect': 'Select Voice',
    'home.voicePreview': 'Preview',
    'home.wordCount': 'Word Count',
    'home.wordCountCustom': 'Custom Count',
    'home.chapters.title': 'Select Chapters',
    'home.chapters.subtitle': 'We extracted the following chapters. Please select what you want to include.',
    'home.chapters.confirm': 'Confirm and Start',
    'home.chapters.extracting': 'Extracting chapters...',
    'home.chapters.noChapters': 'No distinct chapters found. Processing full text.',
    'home.chapters.selectAll': 'Select All',
    'home.chapters.deselectAll': 'Deselect All',
    'home.chapters.back': 'Back',

    'generate.noTask': 'No task ID provided.',
    'generate.title.processing': 'Generating Content',
    'generate.title.completed': 'Generation Complete',
    'generate.badge.processing': 'Processing',
    'generate.errorFetch': 'Failed to fetch task status',
    'generate.errorNotFound': 'Task not found or expired (may be due to server restart).',
    'generate.taskFailed': 'Task Failed: {message}',
    'generate.progress': 'Progress',
    'generate.initializing': 'Initializing…',
    'generate.step.scrape': 'Web Scraping',
    'generate.step.ai': 'AI Analysis',
    'generate.step.video': 'Video Generation',
    'generate.result.articleTitle': 'Summary Article',
    'generate.result.articleDesc': 'AI-generated summary of the content.',
    'generate.result.downloadMd': 'Download Markdown',
    'generate.result.videoTitle': 'Generated Video',
    'generate.result.videoDesc': 'Video with voiceover and visuals.',
    'generate.result.downloadVideo': 'Download Video',
    'generate.another': 'Generate Another Video',
    'generate.section.ai': 'Model & API',
    'generate.section.source': 'Scraped Content (Markdown)',
    'generate.section.article': 'Generated Content (Markdown)',
    'generate.section.assets': 'Background Assets',
    'generate.assets.images': 'Page Images',
    'generate.assets.screenshots': 'Page Screenshots',
    'generate.ai.model': 'Model',
    'generate.ai.baseUrl': 'API Base URL',
    'generate.ai.enabled': 'API Key configured',
    'generate.ai.disabled': 'API Key not configured (mock result)',

    'history.title': 'Your History',
    'history.clear': 'Clear History',
    'history.confirmClear': 'Are you sure you want to clear your history?',
    'history.empty': 'No history items found.',
    'history.startFirst': 'Start your first generation',

    'footer.rights': 'All rights reserved.',
  },
};

function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'zh' ? saved : 'zh';
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh' ? 'en' : 'zh');
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string, vars?: TranslateVars) => {
      const value = translations[locale][key] ?? translations.zh[key] ?? key;
      return interpolate(value, vars);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, toggleLocale, t }), [locale, setLocale, toggleLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
