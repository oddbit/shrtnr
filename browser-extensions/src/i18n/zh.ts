// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Translations } from "./types";

const zh: Translations = {
  "_lang": "zh",

  // Brand
  "brand.name": "shrtnr",
  "brand.tagline": "自托管短链接服务",

  // Popup: generic
  "popup.loading": "正在缩短...",
  "popup.shortUrlLabel": "短链接",
  "popup.copy": "复制",
  "popup.copied": "已复制",
  "popup.qrShow": "显示二维码",
  "popup.qrHide": "隐藏二维码",
  "popup.qrLoading": "正在生成二维码...",
  "popup.qrAlt": "短链接的二维码",
  "popup.slug.label": "自定义短码",
  "popup.slug.placeholder": "wo-de-lianjie",
  "popup.slug.add": "添加短码",
  "popup.slug.adding": "正在添加...",
  "popup.slug.help": "可选。只能使用字母、数字和连字符。添加后的短码会立即复制。",
  "popup.recent.heading": "此浏览器的最近记录",
  "popup.viewInAdmin": "在管理后台查看",
  "popup.openSettings": "设置",
  "popup.retry": "重试",

  // Popup: not configured
  "popup.notConfigured.heading": "设置 shrtnr",
  "popup.notConfigured.body": "shrtnr 需要自托管。将此扩展指向你的服务器即可开始缩短链接。",

  // Form
  "form.baseUrl.label": "服务器地址",
  "form.baseUrl.placeholder": "https://shrtnr.example.com",
  "form.baseUrl.help": "部署 shrtnr Worker 的域名。",
  "form.apiKey.label": "API 密钥",
  "form.apiKey.placeholder": "sk_...",
  "form.apiKey.help": "在管理后台的 API 密钥页面创建一个。",
  "form.test": "测试连接",
  "form.save": "保存",
  "form.cancel": "取消",
  "form.testing": "正在测试...",
  "form.testOk": "已连接",
  "form.testOkCreateOnly": "已连接。该密钥只能创建链接、不能读取链接，因此二维码需要具备读取权限的密钥。",
  "form.saving": "正在保存...",
  "form.saved": "已保存",

  // CTA
  "cta.heading": "还没有自己的 shrtnr？",
  "cta.body": "在 Cloudflare 上一键部署免费实例。免费套餐，无需信用卡。",
  "cta.button": "免费部署",

  // Errors (visible to users)
  "error.internalPage": "shrtnr 无法缩短浏览器内部页面。",
  "error.unparseable": "无法读取此标签页的网址。",
  "error.network": "无法连接 {host} 上的 shrtnr。请检查地址或网络。",
  "error.unauthorized": "你的 API 密钥被拒绝。请在设置中更新。",
  "error.forbidden": "该 API 密钥不允许创建链接。",
  "error.notFound": "在 {host} 上找不到 shrtnr API。是不是域名写错了？",
  "error.conflict": "该短码已被占用。换一个试试。",
  "error.slugInvalid": "短码只能使用字母、数字和连字符，且不能以连字符开头或结尾。",
  "error.qrForbidden": "该 API 密钥无法读取链接，因此无法获取二维码。请使用具备读取权限的密钥。",
  "error.qrFailed": "无法获取二维码。请重试。",
  "error.rateLimited": "请求过于频繁。请稍后重试。",
  "error.server": "你的 shrtnr 服务器返回了错误。",
  "error.validation": "{message}",
  "error.invalidUrl": "这不是有效的网址。请使用完整地址，例如 https://shrtnr.example.com。",
  "error.saveFailed": "无法保存设置。请重试。",
  "error.clipboard": "复制失败。请选中上方链接手动复制。",
  "error.permissionDenied": "shrtnr 需要访问 {host} 的权限。请再次点击保存并允许。",
  "error.permissionDeniedTest": "shrtnr 需要访问 {host} 的权限。请再次点击测试并允许。",

  // Options page
  "options.title": "shrtnr 设置",
  "options.subtitle": "将此扩展连接到你的 shrtnr 部署。",
  "options.section.connection": "连接",
  "options.section.connection.body": "这些值保存在浏览器的同步设置中，绝不会发送给 Oddbit。",
  "options.section.connection.scope": "只有创建权限的密钥就足以缩短链接。需要二维码时再加上读取权限。",
  "options.section.shortcut": "键盘快捷键",
  "options.section.shortcut.body": "{shortcut} 会打开弹窗并缩短当前标签页。可在浏览器的扩展快捷键页面修改。",
  "options.section.shortcut.unassigned": "尚未分配快捷键。建议的组合可能已被其他扩展占用。请在浏览器的扩展快捷键页面分配。",
  "options.section.about": "关于",
  "options.section.about.body": "shrtnr 是开源且自托管的项目。源码：github.com/oddbit/shrtnr。",
  "options.section.about.website": "oddbit.id",
  "options.section.about.version": "版本 {version}",

  // Footer
};

export default zh;
