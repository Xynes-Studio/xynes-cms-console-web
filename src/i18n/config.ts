import { negotiateLocale, normalizeLocale, type Locale } from "@xynes/i18n";
import enUsContentIntegrations from "../../messages/en-US/cms.content-integrations.json";
import enXaContentIntegrations from "../../messages/en-XA/cms.content-integrations.json";
import enUsContent from "../../messages/en-US/cms.content.json";
import enUsIntegrations from "../../messages/en-US/cms.integrations.json";
import enUsLanding from "../../messages/en-US/cms.landing.json";
import enUsShell from "../../messages/en-US/cms.shell.json";
import enXaContent from "../../messages/en-XA/cms.content.json";
import enXaIntegrations from "../../messages/en-XA/cms.integrations.json";
import enXaLanding from "../../messages/en-XA/cms.landing.json";
import enXaShell from "../../messages/en-XA/cms.shell.json";

export const CMS_LOCALE_COOKIE = "xynes_locale";

export type CmsMessages = {
  cms: {
    shell: typeof enUsShell;
    content: typeof enUsContent;
    contentIntegrations: typeof enUsContentIntegrations;
    integrations: typeof enUsIntegrations;
    landing: typeof enUsLanding;
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
      contentIntegrations: enUsContentIntegrations,
      integrations: enUsIntegrations,
      landing: enUsLanding,
    },
  },
  "en-XA": {
    cms: {
      shell: enXaShell,
      content: enXaContent,
      contentIntegrations: enXaContentIntegrations,
      integrations: enXaIntegrations,
      landing: enXaLanding,
    },
  },
};

export function resolveCmsLocale(input: CmsLocaleResolutionInput = {}): Locale {
  return negotiateLocale(input);
}

export function getCmsMessages(locale: unknown): CmsMessages {
  return CMS_MESSAGES_BY_LOCALE[normalizeLocale(locale)];
}
