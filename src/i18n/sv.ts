// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Translations } from "./types";

const sv: Translations = {
  // Language code (used by client-side Intl APIs)
  "_lang": "sv",
  // Navigation
  "nav.dashboard": "Översikt",
  "nav.links": "Länkar",
  "nav.apiKeys": "API-nycklar",
  "nav.settings": "Inställningar",
  "nav.signOut": "Logga ut",
  "nav.openNavigation": "Öppna navigering",

  // Dashboard
  "dashboard.title": "Översikt",
  "dashboard.subtitle": "Sammanfattning av dina kortlänkar",
  "dashboard.urlPlaceholder": "Klistra in en lång URL för att förkorta...",
  "dashboard.shorten": "Förkorta",
  "dashboard.totalLinks": "Totalt antal länkar",
  "dashboard.totalClicks": "Totalt antal klick",
  "dashboard.topCountries": "Toppländer",
  "dashboard.noData": "Ingen data ännu",
  "dashboard.recentLinks": "Senaste länkar",
  "dashboard.noLinks": "Inga länkar ännu",
  "dashboard.topSources": "Toppkällor",
  "dashboard.mostClicked": "Mest klickade",
  "dashboard.clickToCopy": "Klicka för att kopiera",

  // Links
  "links.title": "Länkar",
  "links.subtitle": "Hantera alla dina kortlänkar",
  "links.count": "{count} länk",
  "links.countPlural": "{count} länkar",
  "links.recent": "Senaste",
  "links.popular": "Populära",
  "links.showDisabled": "Visa inaktiverade",
  "links.newLink": "Ny länk",
  "links.allDisabled":
    'Alla länkar är inaktiverade. Växla "Visa inaktiverade" för att se dem.',
  "links.empty":
    "Inga länkar ännu. Använd knappen + Ny länk ovan för att komma igång.",
  "links.disabled": "Inaktiverad",
  "links.clicks": "klick",
  "links.clickToCopy": "Klicka för att kopiera",
  "links.show": "Visa",

  // Link Detail
  "linkDetail.title": "Länkdetaljer",
  "linkDetail.enable": "Aktivera",
  "linkDetail.disable": "Inaktivera",
  "linkDetail.disabled": "Inaktiverad",
  "linkDetail.copy": "Kopiera",
  "linkDetail.qr": "QR",
  "linkDetail.or": "eller",
  "linkDetail.vanitySlug": "Anpassad slug",
  "linkDetail.add": "Lägg till",
  "linkDetail.expiresAt": "Förfaller",
  "linkDetail.clear": "Rensa",
  "linkDetail.save": "Spara",
  "linkDetail.clicksOverTime": "Klick över tid",
  "linkDetail.noClickData": "Ingen klickdata ännu",
  "linkDetail.performance": "Prestanda",
  "linkDetail.totalClicks": "totalt antal klick",
  "linkDetail.countries": "Länder",
  "linkDetail.sources": "Källor",
  "linkDetail.devices": "Enheter",
  "linkDetail.browsers": "Webbläsare",
  "linkDetail.noData": "Ingen data ännu",
  "linkDetail.clickToCopy": "Klicka för att kopiera",

  // API Keys
  "keys.title": "API-nycklar",
  "keys.subtitle": "Hantera programmatisk åtkomst till förkortnings-API:et",
  "keys.count": "{count} nyckel",
  "keys.countPlural": "{count} nycklar",
  "keys.newKey": "Ny nyckel",
  "keys.empty":
    "Inga API-nycklar ännu. Använd knappen + Ny nyckel ovan för att aktivera programmatisk åtkomst.",
  "keys.colTitle": "Titel",
  "keys.colKey": "Nyckel",
  "keys.colScope": "Omfattning",
  "keys.colCreated": "Skapad",
  "keys.colLastUsed": "Senast använd",
  "keys.never": "Aldrig",

  // Settings
  "settings.title": "Inställningar",
  "settings.subtitle": "Konfigurera din URL-förkortare",
  "settings.language": "Språk",
  "settings.theme": "Tema",
  "settings.themeOddbit": "Oddbit",
  "settings.themeDark": "Mörkt",
  "settings.themeLight": "Ljust",
  "settings.slugLength": "Standard slug-längd",
  "settings.save": "Spara",
  "settings.combos": "{count} möjliga kombinationer",
  "settings.minLength": "Minsta längd är 3 tecken",
  "settings.version": "Version",
  "settings.checkingUpdates": "Söker efter uppdateringar...",
  "settings.integrations": "Integrationer",
  "settings.sdkTitle": "TypeScript SDK",
  "settings.sdkDesc":
    "Hantera länkar från din egen kod. Skapa, uppdatera, inaktivera och läs klickanalys programmatiskt.",
  "settings.mcpTitle": "MCP Server",
  "settings.mcpDesc":
    "Ge AI-assistenter åtkomst till dina länkar. Fungerar med Claude Desktop och GitHub Copilot i VS Code.",

  // 404
  "notFound.label": "Hittades inte",

  // Client-side strings
  "client.copied": "{url} kopierad",
  "client.themeUpdated": "Tema uppdaterat",
  "client.themeError": "Kunde inte spara tema",
  "client.languageUpdated": "Språk uppdaterat",
  "client.languageError": "Kunde inte spara språk",
  "client.pasteUrl": "Klistra in en URL först",
  "client.linkCreatedCopied": "Länk skapad & kopierad!",
  "client.linkCreated": "Länk skapad",
  "client.createLinkError": "Kunde inte skapa länk",
  "client.modalNewLink": "Ny länk",
  "client.destinationUrl": "Mål-URL *",
  "client.labelOptional": "Etikett (valfritt)",
  "client.slugLength": "Slug-längd",
  "client.vanityOptional": "Anpassad slug (valfritt)",
  "client.expiresOptional": "Förfaller (valfritt)",
  "client.cancel": "Avbryt",
  "client.create": "Skapa",
  "client.urlRequired": "URL krävs",
  "client.createApiKey": "Skapa API-nyckel",
  "client.keyTitleLabel": "Titel *",
  "client.keyScopeLabel": "Omfattning *",
  "client.scopeCreate": "Skapa",
  "client.scopeCreateDesc": "kan förkorta URL:er",
  "client.scopeRead": "Läsa",
  "client.scopeReadDesc": "kan lista länkar och analys",
  "client.scopeCreateRead": "Skapa + Läsa",
  "client.scopeCreateReadDesc": "fullständig API-åtkomst",
  "client.createKey": "Skapa nyckel",
  "client.titleRequired": "Titel krävs",
  "client.selectScope": "Välj omfattning",
  "client.createKeyError": "Kunde inte skapa nyckel",
  "client.keyCreated": "Nyckel skapad",
  "client.keyCreatedDesc":
    "Kopiera din API-nyckel nu. Den visas inte igen.",
  "client.keyWarning":
    "Spara denna nyckel säkert. Du kan inte hämta den senare.",
  "client.copy": "Kopiera",
  "client.done": "Klar",
  "client.apiKeyCopied": "API-nyckel kopierad",
  "client.confirmDeleteKey":
    'Ta bort API-nyckel "{title}"? Detta kan inte ångras.',
  "client.keyDeleted": "Nyckel borttagen",
  "client.keyDeleteError": "Kunde inte ta bort nyckel",
  "client.confirmDisable":
    "Inaktivera denna länk? Omdirigeringen upphör omedelbart.",
  "client.linkDisabled": "Länk inaktiverad",
  "client.disableError": "Kunde inte inaktivera",
  "client.linkEnabled": "Länk aktiverad",
  "client.enableError": "Kunde inte aktivera",
  "client.vanityAdded": "Anpassad slug tillagd",
  "client.vanityError": "Kunde inte lägga till anpassad slug",
  "client.expiryUpdated": "Förfallodatum uppdaterat",
  "client.expiryError": "Kunde inte uppdatera",
  "client.expiryCleared": "Förfallodatum rensat",
  "client.expiryClearError": "Kunde inte rensa förfallodatum",
  "client.qrCode": "QR-kod",
  "client.close": "Stäng",
  "client.qrFailed": "QR-generering misslyckades",
  "client.minSlugLength": "Minsta slug-längd är 3",
  "client.settingsSaved": "Inställningar sparade",
  "client.settingsError": "Kunde inte spara inställningar",
  "client.combos": "{count} möjliga kombinationer",
  "client.minLength": "Minsta längd är 3 tecken",
  "client.updateAvailable": "tillgänglig",
  "client.releaseNotes": "Versionsanteckningar",
  "client.viewRepo": "Visa repo",
  "client.updateHint":
    "För att uppdatera: synka din fork på GitHub, så deployas den automatiskt.",
  "client.upToDate": "Uppdaterad",
  "client.updateCheckFailed": "Kunde inte söka efter uppdateringar",

  // Language names (displayed in their own language)
  "lang.en": "English",
  "lang.id": "Bahasa Indonesia",
  "lang.sv": "Svenska",

  // Language names (translated into this locale)
  "langLocal.en": "Engelska",
  "langLocal.id": "Indonesiska",
  "langLocal.sv": "Svenska",
};

export default sv;
