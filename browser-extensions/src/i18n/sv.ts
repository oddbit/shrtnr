// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Translations } from "./types";

const sv: Translations = {
  "_lang": "sv",

  // Brand
  "brand.name": "shrtnr",
  "brand.tagline": "Egenhostad URL-förkortare",

  // Popup — generic
  "popup.loading": "Förkortar...",
  "popup.shortUrlLabel": "Kort URL",
  "popup.copy": "Kopiera",
  "popup.copyAgain": "Kopiera igen",
  "popup.copied": "Kopierad",
  "popup.qrShow": "Visa QR",
  "popup.qrHide": "Dölj QR",
  "popup.qrLoading": "Genererar QR...",
  "popup.viewInAdmin": "Visa i admin",
  "popup.openSettings": "Inställningar",
  "popup.retry": "Försök igen",
  "popup.openAdmin": "Öppna admin",

  // Popup — not configured
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
  "error.rateLimited": "För många förfrågningar. Försök igen om en stund.",
  "error.server": "Din shrtnr-server returnerade ett fel.",
  "error.validation": "{message}",
  "error.clipboard": "Kopiering misslyckades. Markera länken ovan för att kopiera den.",
  "error.permissionDenied": "shrtnr behöver tillstånd att kommunicera med {host}. Klicka på Spara igen och godkänn.",
  "error.tabUnknown": "Kunde inte läsa den aktiva fliken.",

  // Options page
  "options.title": "shrtnr-inställningar",
  "options.subtitle": "Anslut denna tillägg till din shrtnr-deployment.",
  "options.section.connection": "Anslutning",
  "options.section.connection.body": "Dessa värden lagras i webbläsarens synkade inställningar och skickas aldrig till Oddbit.",
  "options.section.about": "Om",
  "options.section.about.body": "shrtnr är öppen källkod och egenhostad. Källa: github.com/oddbit/shrtnr.",
  "options.section.about.website": "oddbit.id",
  "options.section.about.version": "Version {version}",

  // Footer
  "footer.poweredBy": "Drivs av shrtnr från Oddbit",
};

export default sv;
