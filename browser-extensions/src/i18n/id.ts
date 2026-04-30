// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Translations } from "./types";

const id: Translations = {
  "_lang": "id",

  // Brand
  "brand.name": "shrtnr",
  "brand.tagline": "Pemendek URL self-hosted",

  // Popup — generic
  "popup.loading": "Memendekkan...",
  "popup.shortUrlLabel": "URL Pendek",
  "popup.copy": "Salin",
  "popup.copyAgain": "Salin lagi",
  "popup.copied": "Disalin",
  "popup.qrShow": "Tampilkan QR",
  "popup.qrHide": "Sembunyikan QR",
  "popup.qrLoading": "Membuat QR...",
  "popup.viewInAdmin": "Lihat di admin",
  "popup.openSettings": "Pengaturan",
  "popup.retry": "Coba lagi",
  "popup.openAdmin": "Buka admin",

  // Popup — not configured
  "popup.notConfigured.heading": "Siapkan shrtnr",
  "popup.notConfigured.body": "shrtnr bersifat self-hosted. Arahkan ekstensi ini ke server Anda untuk mulai memendekkan.",

  // Form
  "form.baseUrl.label": "URL Server",
  "form.baseUrl.placeholder": "https://shrtnr-anda.example.com",
  "form.baseUrl.help": "Domain tempat Worker shrtnr Anda di-deploy.",
  "form.apiKey.label": "Kunci API",
  "form.apiKey.placeholder": "sk_...",
  "form.apiKey.help": "Buat satu di dasbor admin pada bagian Kunci API.",
  "form.test": "Uji koneksi",
  "form.save": "Simpan",
  "form.cancel": "Batal",
  "form.testing": "Menguji...",
  "form.testOk": "Terhubung",
  "form.saving": "Menyimpan...",
  "form.saved": "Tersimpan",

  // CTA
  "cta.heading": "Belum punya shrtnr?",
  "cta.body": "Deploy instans gratis di Cloudflare dengan satu klik. Tier gratis, tanpa kartu kredit.",
  "cta.button": "Deploy gratis",

  // Errors (visible to users)
  "error.internalPage": "shrtnr tidak dapat memendekkan halaman internal browser.",
  "error.unparseable": "Tidak dapat membaca URL tab ini.",
  "error.network": "Tidak dapat menjangkau shrtnr Anda di {host}. Periksa URL atau jaringan Anda.",
  "error.unauthorized": "Kunci API Anda ditolak. Perbarui di pengaturan.",
  "error.forbidden": "Kunci API ini tidak diizinkan membuat tautan.",
  "error.notFound": "API shrtnr tidak ditemukan di {host}. Apakah host salah ketik?",
  "error.rateLimited": "Terlalu banyak permintaan. Coba lagi sebentar.",
  "error.server": "Server shrtnr Anda mengembalikan kesalahan.",
  "error.validation": "{message}",
  "error.clipboard": "Penyalinan gagal. Pilih tautan di atas untuk menyalinnya.",
  "error.permissionDenied": "shrtnr memerlukan izin untuk berkomunikasi dengan {host}. Klik Simpan lagi dan setujui.",
  "error.tabUnknown": "Tidak dapat membaca tab aktif.",

  // Options page
  "options.title": "Pengaturan shrtnr",
  "options.subtitle": "Hubungkan ekstensi ini ke deployment shrtnr Anda.",
  "options.section.connection": "Koneksi",
  "options.section.connection.body": "Nilai-nilai ini disimpan di pengaturan tersinkronisasi browser Anda dan tidak pernah dikirim ke Oddbit.",
  "options.section.about": "Tentang",
  "options.section.about.body": "shrtnr bersumber terbuka dan self-hosted. Sumber: github.com/oddbit/shrtnr.",
  "options.section.about.website": "oddbit.id",
  "options.section.about.version": "Versi {version}",

  // Footer
  "footer.poweredBy": "Didukung oleh shrtnr dari Oddbit",
};

export default id;
