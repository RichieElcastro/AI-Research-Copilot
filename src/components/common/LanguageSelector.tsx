import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage, SupportedLanguage } from '../../context/LanguageContext';

interface LanguageSelectorProps {
  variant?: 'compact' | 'pill' | 'dropdown';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages: { code: SupportedLanguage; label: string; subLabel: string; flag: string }[] = [
    { code: 'id', label: 'Bahasa Indonesia', subLabel: 'Indonesian', flag: '🇮🇩' },
    { code: 'en', label: 'English', subLabel: 'Inggris', flag: '🇬🇧' },
  ];

  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold ${className}`}>
        <button
          type="button"
          onClick={() => setLanguage('id')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
            language === 'id'
              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Pilih Bahasa Indonesia"
        >
          <span>🇮🇩</span>
          <span>ID</span>
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
            language === 'en'
              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Switch to English"
        >
          <span>🇬🇧</span>
          <span>EN</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="btn-language-selector"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
        title={t.navbar.switchLanguage}
        aria-expanded={isOpen}
      >
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <span className="font-bold text-slate-900">
          {language === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div
          id="language-selector-popover"
          className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {t.navbar.language}
          </div>
          {languages.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLanguage(l.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                language === l.code
                  ? 'bg-indigo-50/80 text-indigo-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{l.flag}</span>
                <div>
                  <div className="font-medium text-slate-900">{l.label}</div>
                  <div className="text-[10px] text-slate-400">{l.subLabel}</div>
                </div>
              </div>
              {language === l.code && <Check className="w-3.5 h-3.5 text-indigo-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
