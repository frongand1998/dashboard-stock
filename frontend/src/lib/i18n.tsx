import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { enDictionary } from "./i18n/en";
import { flattenDictionary } from "./i18n/helpers";
import { idDictionary } from "./i18n/id";
import { thDictionary } from "./i18n/th";
import type { Dict, InterpolateVars } from "./i18n/types";

export type Locale = "en" | "id" | "th";

const dictionaries: Record<Locale, Dict> = {
  en: flattenDictionary(enDictionary),
  id: flattenDictionary(idDictionary),
  th: flattenDictionary(thDictionary),
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: InterpolateVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: InterpolateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = vars[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem("dashboard-locale");
    return stored === "id" || stored === "th" ? stored : "en";
  });

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: InterpolateVars) => {
      const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
      return interpolate(template, vars);
    };

    return {
      locale,
      setLocale: (nextLocale: Locale) => {
        setLocaleState(nextLocale);
        localStorage.setItem("dashboard-locale", nextLocale);
      },
      t,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return value;
}
