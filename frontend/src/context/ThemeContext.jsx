import React, { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  dark: {
    name: 'Dark',
    colors: {
      background: 'bg-slate-900',
      surface: 'bg-slate-800',
      surfaceHover: 'hover:bg-slate-700',
      border: 'border-slate-700',
      borderLight: 'border-slate-600',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      primary: 'bg-indigo-600',
      primaryHover: 'hover:bg-indigo-700',
      accent: 'text-indigo-400',
      accentHover: 'hover:text-indigo-300',
      success: 'text-green-400',
      error: 'text-red-400',
      warning: 'text-yellow-400',
      online: 'bg-green-500',
      offline: 'bg-slate-500',
      messageSent: 'bg-indigo-600',
      messageReceived: 'bg-slate-700',
      input: 'bg-slate-700',
      inputFocus: 'focus:bg-slate-600',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      buttonSecondary: 'bg-slate-700 hover:bg-slate-600',
    }
  },
  light: {
    name: 'Light',
    colors: {
      background: 'bg-gray-50',
      surface: 'bg-white',
      surfaceHover: 'hover:bg-gray-100',
      border: 'border-gray-200',
      borderLight: 'border-gray-300',
      text: 'text-gray-900',
      textSecondary: 'text-gray-600',
      textMuted: 'text-gray-500',
      primary: 'bg-blue-600',
      primaryHover: 'hover:bg-blue-700',
      accent: 'text-blue-600',
      accentHover: 'hover:text-blue-700',
      success: 'text-green-600',
      error: 'text-red-600',
      warning: 'text-yellow-600',
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      messageSent: 'bg-blue-600',
      messageReceived: 'bg-gray-100',
      input: 'bg-gray-100',
      inputFocus: 'focus:bg-white',
      button: 'bg-blue-600 hover:bg-blue-700',
      buttonSecondary: 'bg-gray-200 hover:bg-gray-300',
    }
  },
  ocean: {
    name: 'Ocean',
    colors: {
      background: 'bg-cyan-950',
      surface: 'bg-cyan-900',
      surfaceHover: 'hover:bg-cyan-800',
      border: 'border-cyan-800',
      borderLight: 'border-cyan-700',
      text: 'text-cyan-50',
      textSecondary: 'text-cyan-200',
      textMuted: 'text-cyan-300',
      primary: 'bg-teal-600',
      primaryHover: 'hover:bg-teal-700',
      accent: 'text-teal-400',
      accentHover: 'hover:text-teal-300',
      success: 'text-green-400',
      error: 'text-red-400',
      warning: 'text-yellow-400',
      online: 'bg-green-500',
      offline: 'bg-cyan-600',
      messageSent: 'bg-teal-600',
      messageReceived: 'bg-cyan-800',
      input: 'bg-cyan-800',
      inputFocus: 'focus:bg-cyan-700',
      button: 'bg-teal-600 hover:bg-teal-700',
      buttonSecondary: 'bg-cyan-800 hover:bg-cyan-700',
    }
  },
  sunset: {
    name: 'Sunset',
    colors: {
      background: 'bg-orange-950',
      surface: 'bg-orange-900',
      surfaceHover: 'hover:bg-orange-800',
      border: 'border-orange-800',
      borderLight: 'border-orange-700',
      text: 'text-orange-50',
      textSecondary: 'text-orange-200',
      textMuted: 'text-orange-300',
      primary: 'bg-rose-600',
      primaryHover: 'hover:bg-rose-700',
      accent: 'text-rose-400',
      accentHover: 'hover:text-rose-300',
      success: 'text-green-400',
      error: 'text-red-400',
      warning: 'text-yellow-400',
      online: 'bg-green-500',
      offline: 'bg-orange-600',
      messageSent: 'bg-rose-600',
      messageReceived: 'bg-orange-800',
      input: 'bg-orange-800',
      inputFocus: 'focus:bg-orange-700',
      button: 'bg-rose-600 hover:bg-rose-700',
      buttonSecondary: 'bg-orange-800 hover:bg-orange-700',
    }
  },
  forest: {
    name: 'Forest',
    colors: {
      background: 'bg-emerald-950',
      surface: 'bg-emerald-900',
      surfaceHover: 'hover:bg-emerald-800',
      border: 'border-emerald-800',
      borderLight: 'border-emerald-700',
      text: 'text-emerald-50',
      textSecondary: 'text-emerald-200',
      textMuted: 'text-emerald-300',
      primary: 'bg-green-600',
      primaryHover: 'hover:bg-green-700',
      accent: 'text-green-400',
      accentHover: 'hover:text-green-300',
      success: 'text-green-400',
      error: 'text-red-400',
      warning: 'text-yellow-400',
      online: 'bg-green-500',
      offline: 'bg-emerald-600',
      messageSent: 'bg-green-600',
      messageReceived: 'bg-emerald-800',
      input: 'bg-emerald-800',
      inputFocus: 'focus:bg-emerald-700',
      button: 'bg-green-600 hover:bg-green-700',
      buttonSecondary: 'bg-emerald-800 hover:bg-emerald-700',
    }
  }
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved && themes[saved] ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', currentTheme);
  }, [currentTheme]);

  const theme = themes[currentTheme];
  const setTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
    }
  };

  const cycleTheme = () => {
    const themeNames = Object.keys(themes);
    const currentIndex = themeNames.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    setTheme(themeNames[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme, cycleTheme, themes }}>
      <div className={`min-h-screen ${theme.colors.background} ${theme.colors.text} transition-colors duration-300`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
