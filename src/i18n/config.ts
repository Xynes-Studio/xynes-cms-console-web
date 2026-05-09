import { negotiateLocale, normalizeLocale, type Locale } from "@xynes/i18n";
import enUsContent from "../../messages/en-US/cms.content.json";
import enUsIntegrations from "../../messages/en-US/cms.integrations.json";
import enUsShell from "../../messages/en-US/cms.shell.json";
import enXaContent from "../../messages/en-XA/cms.content.json";
import enXaIntegrations from "../../messages/en-XA/cms.integrations.json";
import enXaShell from "../../messages/en-XA/cms.shell.json";

export const CMS_LOCALE_COOKIE = "xynes_locale";

export type CmsMessages = {
  cms: {
    shell: typeof enUsShell;
    content: typeof enUsContent;
    integrations: typeof enUsIntegrations;
  };
};

export type CmsLocaleResolutionInput = {
  explicitLocale?: unknown;
  cookieLocale?: unknown;
  acceptLanguage?: unknown;
};

const CMS_MESSAGES_BY_LOCALE: Record<Locale, CmsMessages> = {
  "en-US": {
    cms: {
      shell: enUsShell,
      content: enUsContent,
      integrations: enUsIntegrations,
    },
  },
  "en-XA": {
    cms: {
      shell: enXaShell,
      content: enXaContent,
      integrations: enXaIntegrations,
    },
  },
};

export function resolveCmsLocale(input: CmsLocaleResolutionInput = {}): Locale {
  return negotiateLocale(input);
}

export function getCmsMessages(locale: unknown): CmsMessages {
  return CMS_MESSAGES_BY_LOCALE[normalizeLocale(locale)];
}
