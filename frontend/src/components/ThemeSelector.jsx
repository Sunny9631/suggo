import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeSelector = () => {
  const { theme, currentTheme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const getThemePreview = (themeName) => {
    const colors = themes[themeName].colors;
    return {
      bg: colors.background,
      primary: colors.primary,
      border: colors.border
    };
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg ${theme.colors.surface} ${theme.colors.surfaceHover} ${theme.colors.border} border transition-all duration-200`}
        title="Change Theme"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-56 rounded-lg shadow-lg ${theme.colors.surface} ${theme.colors.border} border z-50`}>
          <div className="p-2">
            <div className={`text-sm font-medium ${theme.colors.textSecondary} mb-2`}>
              Select Theme
            </div>
            <div className="space-y-1">
              {Object.entries(themes).map(([key, themeOption]) => {
                const preview = getThemePreview(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setTheme(key);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg ${preview.bg} ${theme.colors.surfaceHover} transition-colors duration-200 ${currentTheme === key ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex gap-1">
                      <div className={`w-4 h-4 rounded ${preview.primary}`}></div>
                      <div className={`w-4 h-4 rounded ${preview.border} border`}></div>
                    </div>
                    <span className={theme.colors.text}>
                      {themeOption.name}
                    </span>
                    {currentTheme === key && (
                      <svg className="w-4 h-4 ml-auto text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;