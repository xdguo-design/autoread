import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CheckSquare, Square, Volume2, Play } from 'lucide-react';
import { useI18n } from '../i18n/i18n';
import clsx from 'clsx';

type LlmConfig = {
  base_url: string;
  model: string;
  api_key: string;
};

type Chapter = {
  id: string;
  text: string;
  level: number;
};

type Voice = {
  id: string;
  name: string;
  lang: string;
};

const LLM_STORAGE_KEY = 'autoread_llm';
const VOICE_STORAGE_KEY = 'autoread_voice';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [showChapterSelection, setShowChapterSelection] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [wordCountOption, setWordCountOption] = useState<string>('1000');
  const [customWordCount, setCustomWordCount] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem(VOICE_STORAGE_KEY) || 'zh-CN-XiaoxiaoNeural';
  });
  
  const navigate = useNavigate();
  const { t } = useI18n();
  
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const resp = await axios.get('/api/tts/voices');
        setVoices(resp.data);
      } catch (err) {
        console.error('Failed to fetch voices:', err);
      }
    };
    fetchVoices();
  }, []);
  const [llm, setLlm] = useState<LlmConfig>(() => {
    const raw = localStorage.getItem(LLM_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<LlmConfig>;
        return {
          base_url: parsed.base_url || 'https://api.deepseek.com/v1',
          model: parsed.model || 'deepseek-chat',
          api_key: parsed.api_key || '',
        };
      } catch {
        return { base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', api_key: '' };
      }
    }
    return { base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', api_key: '' };
  });

  const handleStart = async () => {
    if (!url) return;
    
    try {
      setIsExtracting(true);
      setError('');
      
      const response = await axios.post('/api/extract-chapters', { url });
      const extractedChapters = response.data.chapters as Chapter[];
      
      if (extractedChapters && extractedChapters.length > 0) {
        setChapters(extractedChapters);
        setSelectedChapterIds(new Set(extractedChapters.map(c => c.id)));
        setShowChapterSelection(true);
      } else {
        // No chapters found, proceed directly
        await handleConfirmProcess([]);
      }
    } catch (err) {
      console.error(err);
      setError(t('home.errorStartTask'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmProcess = async (selectedTexts?: string[]) => {
    try {
      setIsLoading(true);
      setError('');
      
      const payload: Record<string, unknown> = { 
        url,
        voice: selectedVoice,
        word_count: wordCountOption === 'custom' ? parseInt(customWordCount) || 1000 : parseInt(wordCountOption)
      };
      const apiKey = llm.api_key.trim();
      payload.llm = {
        base_url: llm.base_url.trim(),
        model: llm.model.trim(),
        ...(apiKey ? { api_key: apiKey } : {}),
      };
      
      if (selectedTexts && selectedTexts.length > 0) {
        payload.chapters = selectedTexts;
      }
      
      localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(llm));
      localStorage.setItem(VOICE_STORAGE_KEY, selectedVoice);

      const response = await axios.post('/api/process', payload);
      const { task_id } = response.data;
      
      // Save to local history
      const history = JSON.parse(localStorage.getItem('autoread_history') || '[]');
      history.unshift({ task_id, url, date: new Date().toISOString() });
      localStorage.setItem('autoread_history', JSON.stringify(history));
      
      navigate(`/generate?task_id=${task_id}`);
    } catch (err) {
      console.error(err);
      setError(t('home.errorStartTask'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    try {
      setIsPreviewing(voiceId);
      const response = await axios.post('/api/tts/preview', { voice: voiceId }, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const audio = new Audio(url);
      audio.onended = () => setIsPreviewing(null);
      await audio.play();
    } catch (err) {
      console.error('Preview failed:', err);
      setIsPreviewing(null);
    }
  };

  const toggleChapter = (id: string) => {
    const next = new Set(selectedChapterIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedChapterIds(next);
  };

  const toggleAll = () => {
    if (selectedChapterIds.size === chapters.length) {
      setSelectedChapterIds(new Set());
    } else {
      setSelectedChapterIds(new Set(chapters.map(c => c.id)));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('home.title')}</h1>
      <p className="text-xl text-gray-600 mb-8 text-center max-w-2xl">
        {t('home.subtitle')}
      </p>
      
      <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-lg border border-gray-100">
        {!showChapterSelection ? (
          <>
            <div className="flex gap-4">
              <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('home.urlPlaceholder')}
                className="flex-1 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                disabled={isLoading || isExtracting}
              />
              <button 
                onClick={handleStart}
                disabled={isLoading || isExtracting || !url}
                className="px-8 py-4 bg-primary text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isExtracting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {isExtracting ? t('home.chapters.extracting') : t('home.start')}
              </button>
            </div>
            {error && <p className="text-red-500 mt-4">{error}</p>}

            <div className="mt-6 flex flex-col gap-4">
              <details className="group">
                <summary className="cursor-pointer select-none text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center">
                  <Volume2 className="w-4 h-4 mr-2" />
                  {t('home.voiceSettings')}
                </summary>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('home.voiceSelect')}</label>
                  <div className="space-y-2">
                    {voices.map((v) => (
                      <div 
                        key={v.id} 
                        className={clsx(
                          "flex items-center justify-between p-3 rounded-md border transition-all cursor-pointer",
                          selectedVoice === v.id ? "bg-white border-primary shadow-sm" : "bg-transparent border-transparent hover:bg-white/50"
                        )}
                        onClick={() => setSelectedVoice(v.id)}
                      >
                        <div className="flex items-center">
                          <div className={clsx(
                            "w-4 h-4 rounded-full border mr-3 flex items-center justify-center",
                            selectedVoice === v.id ? "border-primary" : "border-gray-300"
                          )}>
                            {selectedVoice === v.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{v.name}</div>
                            <div className="text-xs text-gray-500">{v.lang}</div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewVoice(v.id);
                          }}
                          disabled={isPreviewing !== null}
                          className="p-2 text-gray-400 hover:text-primary transition-colors disabled:opacity-50"
                          title={t('home.voicePreview')}
                        >
                          {isPreviewing === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('home.wordCount')}</label>
                <div className="flex gap-4 items-center">
                  <select 
                    value={wordCountOption}
                    onChange={(e) => {
                      setWordCountOption(e.target.value);
                      if (e.target.value !== 'custom') setCustomWordCount('');
                    }}
                    className="flex-1 p-2 border border-gray-300 rounded-lg outline-none"
                  >
                    <option value="1000">1000</option>
                    <option value="2000">2000</option>
                    <option value="3000">3000</option>
                    <option value="custom">{t('home.wordCountCustom')}</option>
                  </select>
                  {wordCountOption === 'custom' && (
                    <input 
                      type="number"
                      placeholder={t('home.wordCountCustom')}
                      value={customWordCount}
                      onChange={(e) => setCustomWordCount(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg outline-none"
                    />
                  )}
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer select-none text-sm font-medium text-gray-700 hover:text-gray-900">
                  {t('home.aiSettings')}
                </summary>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('home.aiBaseUrl')}</label>
                    <input
                      type="text"
                      value={llm.base_url}
                      onChange={(e) => setLlm((prev) => ({ ...prev, base_url: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('home.aiModel')}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={llm.model}
                        onChange={(e) => setLlm((prev) => ({ ...prev, model: e.target.value }))}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        disabled={isLoading}
                      />
                      <select 
                        className="p-3 border border-gray-300 rounded-lg outline-none bg-gray-50 text-sm"
                        onChange={(e) => setLlm((prev) => ({ ...prev, model: e.target.value }))}
                        value=""
                      >
                        <option value="" disabled>常用模型</option>
                        <option value="deepseek-chat">DeepSeek Chat</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                        <option value="glm-4">GLM-4</option>
                        <option value="glm-4-0520">GLM-4-0520</option>
                        <option value="glm-4-air">GLM-4-Air</option>
                        <option value="glm-4-plus">GLM-4-Plus</option>
                        <option value="glm-4-flash">GLM-4-Flash</option>
                        <option value="glm-4-flashx">GLM-4-FlashX</option>
                        <option value="glm-4.7">GLM-4.7</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('home.aiApiKey')}</label>
                    <input
                      type="password"
                      value={llm.api_key}
                      onChange={(e) => setLlm((prev) => ({ ...prev, api_key: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500 mt-2">{t('home.aiApiKeyHint')}</p>
                  </div>
                </div>
              </details>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('home.chapters.title')}</h2>
              <p className="text-gray-600 mt-2">{t('home.chapters.subtitle')}</p>
            </div>

            <div className="flex justify-end">
               <button 
                onClick={toggleAll}
                className="text-sm text-primary hover:underline font-medium"
               >
                 {selectedChapterIds.size === chapters.length ? t('home.chapters.deselectAll') : t('home.chapters.selectAll')}
               </button>
            </div>

            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {chapters.map((chapter) => (
                <div 
                  key={chapter.id}
                  onClick={() => toggleChapter(chapter.id)}
                  className={clsx(
                    "flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedChapterIds.has(chapter.id) ? "bg-blue-50/30" : ""
                  )}
                >
                  <div className="mr-3 text-primary">
                    {selectedChapterIds.has(chapter.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </div>
                  <div className={clsx(
                    "flex-1 text-gray-900",
                    chapter.level === 1 ? "font-bold" : chapter.level === 2 ? "font-semibold pl-4" : "pl-8"
                  )}>
                    {chapter.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
                <button 
                 onClick={() => setShowChapterSelection(false)}
                 className="flex-1 py-4 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('home.chapters.back')}
                </button>
               <button 
                onClick={() => {
                  const selectedTexts = chapters
                    .filter(c => selectedChapterIds.has(c.id))
                    .map(c => c.text);
                  handleConfirmProcess(selectedTexts);
                }}
                disabled={isLoading || selectedChapterIds.size === 0}
                className="flex-2 px-12 py-4 bg-primary text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {t('home.chapters.confirm')}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Feature Highlights */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-4">
        {[
          { title: t('home.feature1.title'), desc: t('home.feature1.desc') },
          { title: t('home.feature2.title'), desc: t('home.feature2.desc') },
          { title: t('home.feature3.title'), desc: t('home.feature3.desc') }
        ].map((feature, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
