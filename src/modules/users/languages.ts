export const SUPPORTED_LANGUAGE_CODES = [
  'en',
  'tr',
  'es',
  'it',
  'fr',
  'nb',
  'nl',
  'pt-BR',
  'de',
  'ar',
  'ja',
  'zh-Hans',
  'hi',
  'el',
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

const LANGUAGE_LABELS: Record<SupportedLanguageCode, string> = {
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  it: 'Italiano',
  fr: 'Français',
  nb: 'Norsk bokmål',
  nl: 'Nederlands',
  'pt-BR': 'Português (Brasil)',
  de: 'Deutsch',
  ar: 'العربية',
  ja: '日本語',
  'zh-Hans': '简体中文',
  hi: 'हिन्दी',
  el: 'Ελληνικά',
};

export const SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGE_CODES.map((code) => ({
  code,
  name: LANGUAGE_LABELS[code],
}));

export const isSupportedLanguageCode = (value: string): value is SupportedLanguageCode => {
  return (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value);
};
