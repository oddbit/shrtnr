// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Translations } from "./types";

const sv: Translations = {
  "_lang": "sv",

  // Brand
  "brand.name": "shrtnr",
  "brand.tagline": "Egenhostad URL-förkortare",

  // Popup: generic
  "popup.loading": "Förkortar...",
  "popup.shortUrlLabel": "Kort URL",
  "popup.copy": "Kopiera",
  "popup.copied": "Kopierad",
  "popup.qrShow": "Visa QR",
  "popup.qrHide": "Dölj QR",
  "popup.qrLoading": "Genererar QR...",
  "popup.qrAlt": "QR-kod för den korta URL:en",
  "popup.slug.label": "Egen slug",
  "popup.slug.placeholder": "min-lank",
  "popup.slug.add": "Lägg till slug",
  "popup.slug.adding": "Lägger till...",
  "popup.slug.help": "Valfritt. Bokstäver, siffror och bindestreck. Tillagda sluggar kopieras direkt.",
  "popup.recent.heading": "Senaste från den här webbläsaren",
  "popup.viewInAdmin": "Visa i admin",
  "popup.openSettings": "Inställningar",
  "popup.retry": "Försök igen",

  // Popup: not configured
  "popup.notConfigured.heading": "Konfigurera shrtnr",
  "popup.notConfigured.body": "shrtnr är egenhostad. Peka ut din server för denna tillägg för att börja förkorta.",

  // Form
  "form.baseUrl.label": "Server-URL",
  "form.baseUrl.placeholder": "https://din-shrtnr.example.com",
  "form.baseUrl.help": "Domänen där din shrtnr-Worker är deployad.",
  "form.apiKey.label": "API-nyckel",
  "form.apiKey.placeholder": "sk_...",
  "form.apiKey.help": "Skapa en i admin-panelen under API-nycklar.",
  "form.test": "Testa anslutning",
  "form.save": "Spara",
  "form.cancel": "Avbryt",
  "form.testing": "Testar...",
  "form.testOk": "Ansluten",
  "form.testOkCreateOnly": "Ansluten. Nyckeln kan skapa länkar men inte läsa dem, så QR-koder kräver en nyckel med read-behörighet.",
  "form.saving": "Sparar...",
  "form.saved": "Sparad",

  // CTA
  "cta.heading": "Har du ingen shrtnr ännu?",
  "cta.body": "Deploya en gratis instans på Cloudflare med ett klick. Gratisnivå, inget kreditkort.",
  "cta.button": "Deploya gratis",

  // Errors (visible to users)
  "error.internalPage": "shrtnr kan inte förkorta webbläsarens interna sidor.",
  "error.unparseable": "Kunde inte läsa denna fliks URL.",
  "error.network": "Når inte din shrtnr på {host}. Kontrollera URL:en eller ditt nätverk.",
  "error.unauthorized": "Din API-nyckel avvisades. Uppdatera den i inställningarna.",
  "error.forbidden": "Denna API-nyckel får inte skapa länkar.",
  "error.notFound": "shrtnr-API hittades inte på {host}. Skrev du fel värd?",
  "error.conflict": "Den sluggen är redan upptagen. Prova en annan.",
  "error.slugInvalid": "Sluggar består av bokstäver, siffror och bindestreck, och får inte börja eller sluta med bindestreck.",
  "error.qrForbidden": "Den här API-nyckeln kan inte läsa länkar och kan därför inte hämta QR-koden. Använd en nyckel med read-behörighet.",
  "error.qrFailed": "Kunde inte hämta QR-koden. Försök igen.",
  "error.rateLimited": "För många förfrågningar. Försök igen om en stund.",
  "error.server": "Din shrtnr-server returnerade ett fel.",
  "error.validation": "{message}",
  "error.invalidUrl": "Ogiltig URL. Använd hela adressen, till exempel https://din-shrtnr.example.com.",
  "error.saveFailed": "Det gick inte att spara inställningarna. Försök igen.",
  "error.clipboard": "Kopiering misslyckades. Markera länken ovan för att kopiera den.",
  "error.permissionDenied": "shrtnr behöver tillstånd att kommunicera med {host}. Klicka på Spara igen och godkänn.",
  "error.permissionDeniedTest": "shrtnr behöver tillstånd att kommunicera med {host}. Klicka på Testa igen och godkänn.",

  // Options page
  "options.title": "shrtnr-inställningar",
  "options.subtitle": "Anslut denna tillägg till din shrtnr-deployment.",
  "options.section.connection": "Anslutning",
  "options.section.connection.body": "Dessa värden lagras i webbläsarens synkade inställningar och skickas aldrig till Oddbit.",
  "options.section.connection.scope": "En nyckel med create-behörighet räcker för att förkorta. Lägg till read-behörighet om du vill ha QR-koder.",
  "options.section.shortcut": "Tangentbordsgenväg",
  "options.section.shortcut.body": "Alt+Skift+L öppnar popupen och förkortar aktuell flik. Ändra den på webbläsarens sida för tilläggsgenvägar.",
  "options.section.about": "Om",
  "options.section.about.body": "shrtnr är öppen källkod och egenhostad. Källa: github.com/oddbit/shrtnr.",
  "options.section.about.website": "oddbit.id",
  "options.section.about.version": "Version {version}",

  // Footer
};

export default sv;
