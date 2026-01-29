import { Link, useLocation } from 'react-router-dom';
import { BookOpen, History, PlusCircle } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '../i18n/i18n';

export default function Navbar() {
  const location = useLocation();
  const { t, toggleLocale } = useI18n();

  const navItems = [
    { name: t('nav.home'), path: '/', icon: BookOpen },
    { name: t('nav.generate'), path: '/generate', icon: PlusCircle },
    { name: t('nav.history'), path: '/history', icon: History },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-primary">AutoRead</span>
            </Link>
          </div>
          <div className="flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={clsx(
                    'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200',
                    isActive
                      ? 'border-primary text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  )}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={toggleLocale}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label={t('nav.language')}
              title={t('nav.language')}
            >
              {t('nav.toggle')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
