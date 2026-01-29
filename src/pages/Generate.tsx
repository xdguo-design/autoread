import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, FileText, Video, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '../i18n/i18n';
import MarkdownPreview from '../components/MarkdownPreview';
import AssetsPreview from '../components/AssetsPreview';

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  has_article: boolean;
  has_video: boolean;
  has_source?: boolean;
  image_count?: number;
  screenshot_count?: number;
  visual_count?: number;
}

type MarkdownResponse = {
  task_id: string;
  kind: 'source' | 'article';
  markdown: string;
};

type AssetItem = {
  name: string;
  url: string;
};

type AssetsResponse = {
  task_id: string;
  images: AssetItem[];
  screenshots: AssetItem[];
  visuals_used: string[];
};

export default function Generate() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('task_id');
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [error, setError] = useState('');
  const { t } = useI18n();
  const [sourceMd, setSourceMd] = useState<string>('');
  const [articleMd, setArticleMd] = useState<string>('');
  const [assets, setAssets] = useState<AssetsResponse | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const pollStatus = async () => {
      try {
        const response = await axios.get(`/api/status/${taskId}`);
        setStatus(response.data);
        
        if (response.data.status === 'completed' || response.data.status === 'failed') {
          return true; // Stop polling
        }
        return false;
      } catch (err) {
        console.error(err);
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setError(t('generate.errorNotFound'));
        } else {
          setError(t('generate.errorFetch'));
        }
        return true; // Stop polling on error
      }
    };

    let intervalId: number;
    
    // Initial check
    pollStatus().then(shouldStop => {
      if (!shouldStop) {
        intervalId = window.setInterval(async () => {
          const shouldStop = await pollStatus();
          if (shouldStop) clearInterval(intervalId);
        }, 2000);
      }
    });

    return () => clearInterval(intervalId);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    if (!status) return;

    const fetchSource = async () => {
      if (!status.has_source) return;
      if (sourceMd) return;
      const resp = await axios.get<MarkdownResponse>(`/api/task/${taskId}/markdown/source`);
      setSourceMd(resp.data.markdown);
    };

    const fetchArticle = async () => {
      if (!status.has_article) return;
      if (articleMd) return;
      const resp = await axios.get<MarkdownResponse>(`/api/task/${taskId}/markdown/article`);
      setArticleMd(resp.data.markdown);
    };

    const fetchAssets = async () => {
      if (!assets && (status.image_count || status.screenshot_count || status.visual_count)) {
        const resp = await axios.get<AssetsResponse>(`/api/task/${taskId}/assets`);
        setAssets(resp.data);
        return;
      }
      if (status.status === 'completed') {
        const resp = await axios.get<AssetsResponse>(`/api/task/${taskId}/assets`);
        setAssets(resp.data);
      }
    };

    fetchSource().catch(() => undefined);
    fetchArticle().catch(() => undefined);
    fetchAssets().catch(() => undefined);
  }, [taskId, status, sourceMd, articleMd, assets]);

  if (!taskId) {
    return <div className="text-center py-12">{t('generate.noTask')}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {status?.status === 'completed' ? t('generate.title.completed') : t('generate.title.processing')}
        </h2>
        {status?.status === 'processing' && (
           <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
             {t('generate.badge.processing')}
           </span>
        )}
      </div>

      {error && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
          <div className="flex justify-center">
            <Link to="/" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
              {t('home.back')}
            </Link>
          </div>
        </div>
      )}

      {status?.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {t('generate.taskFailed', { message: status.message })}
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="mb-4 flex justify-between text-sm font-medium text-gray-700">
          <span>{t('generate.progress')}</span>
          <span>{status?.progress || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${status?.progress || 0}%` }}
          ></div>
        </div>
        <p className="text-gray-600 text-center font-medium">{status?.message || t('generate.initializing')}</p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: t('generate.step.scrape'), done: (status?.progress || 0) >= 10 },
          { label: t('generate.step.ai'), done: (status?.progress || 0) >= 40 },
          { label: t('generate.step.video'), done: (status?.progress || 0) >= 70 },
        ].map((step, i) => (
          <div key={i} className={clsx(
            "p-4 rounded-lg border flex items-center justify-center transition-colors",
            step.done 
              ? "bg-green-50 border-green-200 text-green-700" 
              : "bg-gray-50 border-gray-200 text-gray-400"
          )}>
            {step.done ? <CheckCircle className="w-5 h-5 mr-2" /> : <div className="w-5 h-5 mr-2 rounded-full border-2 border-current opacity-40"></div>}
            <span className="font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Results */}
      {status?.status === 'completed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {status.has_article && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t('generate.result.articleTitle')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('generate.result.articleDesc')}</p>
              <a 
                href={`/api/download/article/${taskId}`} 
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                {t('generate.result.downloadMd')}
              </a>
            </div>
          )}
          
          {status.has_video && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t('generate.result.videoTitle')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('generate.result.videoDesc')}</p>
              <a 
                href={`/api/download/video/${taskId}`} 
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
              >
                {t('generate.result.downloadVideo')}
              </a>
            </div>
          )}
        </div>
      )}

      {(status?.has_source || status?.has_article) && (
        <div className="space-y-6">
          {status?.has_source && sourceMd && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">{t('generate.section.source')}</h3>
              <MarkdownPreview markdown={sourceMd} />
            </div>
          )}

          {status?.has_article && articleMd && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">{t('generate.section.article')}</h3>
              <MarkdownPreview markdown={articleMd} />
            </div>
          )}
        </div>
      )}

      {assets && (assets.images.length || assets.screenshots.length) ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{t('generate.section.assets')}</h3>
          </div>
          <AssetsPreview title={t('generate.assets.images')} items={assets.images} usedNames={assets.visuals_used} />
          <AssetsPreview title={t('generate.assets.screenshots')} items={assets.screenshots} usedNames={assets.visuals_used} />
        </div>
      ) : null}
      
      {status?.status === 'completed' && (
        <div className="flex justify-center pt-8">
            <Link to="/" className="text-primary hover:underline font-medium">
                {t('generate.another')}
            </Link>
        </div>
      )}
    </div>
  );
}
