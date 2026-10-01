import { AsyncLocalStorage } from "node:async_hooks";
import { setServerLanguageResolver } from "../i18n/translation";

const languages = new AsyncLocalStorage<string>();
setServerLanguageResolver(() => languages.getStore());

export function withRequestLanguage<T>(language: string, render: () => T): T {
  return languages.run(language, render);
}
