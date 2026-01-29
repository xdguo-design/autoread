import { useI18n } from '../i18n/i18n';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} AutoRead. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
