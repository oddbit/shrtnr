import { describe, it, expect } from "vitest";
import { parseDeviceType, parseBrowser, parseOS, isBot } from "../../ua";

describe("parseDeviceType", () => {
  it("should detect Mobile Safari as mobile", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("mobile");
  });

  it("should detect Android phone as mobile", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("mobile");
  });

  it("should detect Chrome desktop as desktop", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("desktop");
  });

  it("should detect iPad as tablet", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1"
      )
    ).toBe("tablet");
  });

  it("should detect Android tablet as tablet", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("tablet");
  });

  it("should default to desktop for empty UA", () => {
    expect(parseDeviceType("")).toBe("desktop");
  });
});

describe("parseBrowser", () => {
  it("should detect Chrome", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("Chrome");
  });

  it("should detect Safari", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("Safari");
  });

  it("should detect Firefox", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0"
      )
    ).toBe("Firefox");
  });

  it("should detect Edge (not Chrome)", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
      )
    ).toBe("Edge");
  });

  it("should detect Opera", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0"
      )
    ).toBe("Opera");
  });

  it("should return Other for empty UA", () => {
    expect(parseBrowser("")).toBe("Other");
  });

  it("should return Other for unknown UA", () => {
    expect(parseBrowser("curl/7.68.0")).toBe("Other");
  });
});

describe("parseOS", () => {
  it("should detect iOS from iPhone UA", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("ios");
  });

  it("should detect iOS from iPad UA", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1"
      )
    ).toBe("ios");
  });

  it("should detect Android", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("android");
  });

  it("should detect Windows", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("windows");
  });

  it("should detect macOS", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("macos");
  });

  it("should detect Linux (not Android)", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("linux");
  });

  it("should detect ChromeOS", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("chromeos");
  });

  it("should return other for empty UA", () => {
    expect(parseOS("")).toBe("other");
  });

  it("should return other for unknown UA", () => {
    expect(parseOS("curl/7.68.0")).toBe("other");
  });
});

describe("isBot", () => {
  it("flags empty UA as bot", () => {
    expect(isBot("")).toBe(true);
  });

  it("flags whitespace-only UA as bot", () => {
    expect(isBot("   ")).toBe(true);
  });

  it("flags Googlebot as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      )
    ).toBe(true);
  });

  it("flags Bingbot as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
      )
    ).toBe(true);
  });

  it("flags DuckDuckBot as bot", () => {
    expect(isBot("DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)")).toBe(true);
  });

  it("flags YandexBot as bot", () => {
    expect(
      isBot("Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)")
    ).toBe(true);
  });

  it("flags Baiduspider as bot", () => {
    expect(
      isBot("Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)")
    ).toBe(true);
  });

  it("flags Yahoo Slurp as bot", () => {
    expect(
      isBot("Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)")
    ).toBe(true);
  });

  it("flags facebookexternalhit link previewer as bot", () => {
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
  });

  it("flags Slackbot link expander as bot", () => {
    expect(isBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
  });

  it("flags Twitterbot as bot", () => {
    expect(isBot("Twitterbot/1.0")).toBe(true);
  });

  it("flags LinkedInBot as bot", () => {
    expect(
      isBot("LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)")
    ).toBe(true);
  });

  it("flags Discordbot as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).toBe(true);
  });

  it("flags TelegramBot as bot", () => {
    expect(isBot("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("flags WhatsApp link preview as bot", () => {
    expect(isBot("WhatsApp/2.23.20.0 A")).toBe(true);
  });

  it("flags SkypeUriPreview as bot", () => {
    expect(isBot("Mozilla/5.0 (Windows NT 10.0; WOW64) SkypeUriPreview Preview/0.5")).toBe(true);
  });

  it("flags Applebot as bot", () => {
    expect(
      isBot("Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)")
    ).toBe(true);
  });

  it("flags GPTBot as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)")).toBe(true);
  });

  it("flags ClaudeBot as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")).toBe(true);
  });

  it("flags PerplexityBot as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)")).toBe(true);
  });

  it("flags CCBot (Common Crawl) as bot", () => {
    expect(isBot("CCBot/2.0 (https://commoncrawl.org/faq/)")).toBe(true);
  });

  it("flags Bytespider (ByteDance) as bot", () => {
    expect(
      isBot("Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)")
    ).toBe(true);
  });

  it("flags AhrefsBot as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)")).toBe(true);
  });

  it("flags SemrushBot as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)")).toBe(true);
  });

  it("flags UptimeRobot monitor as bot", () => {
    expect(isBot("Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)")).toBe(true);
  });

  it("flags curl as bot", () => {
    expect(isBot("curl/7.88.1")).toBe(true);
  });

  it("flags wget as bot", () => {
    expect(isBot("Wget/1.21.3")).toBe(true);
  });

  it("flags python-requests as bot", () => {
    expect(isBot("python-requests/2.31.0")).toBe(true);
  });

  it("flags Go-http-client as bot", () => {
    expect(isBot("Go-http-client/1.1")).toBe(true);
  });

  it("flags Java http client as bot", () => {
    expect(isBot("Java/17.0.2")).toBe(true);
  });

  it("flags headless Chrome as bot", () => {
    expect(
      isBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36")
    ).toBe(true);
  });

  it("does not flag desktop Chrome as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe(false);
  });

  it("does not flag iPhone Safari as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
  });

  it("does not flag macOS Safari as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe(false);
  });

  it("does not flag Firefox as bot", () => {
    expect(
      isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0")
    ).toBe(false);
  });

  it("does not flag Android Chrome as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe(false);
  });

  it("does not flag Edge as bot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
      )
    ).toBe(false);
  });
});
