import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/i18n';

interface HistoryItem {
  task_id: string;
  url: string;
  date: string;
}

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    const stored = localStorage.getItem('autoread_history');
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  const clearHistory = () => {
    if (confirm(t('history.confirmClear'))) {
      localStorage.removeItem('autoread_history');
      setHistory([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('history.title')}</h2>
        {history.length > 0 && (
          <button 
            onClick={clearHistory}
            className="flex items-center text-red-600 hover:text-red-800 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t('history.clear')}
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">{t('history.empty')}</p>
          <Link to="/" className="text-primary hover:underline mt-2 inline-block">
            {t('history.startFirst')}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {history.map((item) => (
              <li key={item.task_id} className="hover:bg-gray-50 transition-colors">
                <Link to={`/generate?task_id=${item.task_id}`} className="block p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-primary truncate mb-1">
                        {item.url}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.date).toLocaleString()}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
