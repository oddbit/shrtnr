import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

const AUTH_HEADER = { "Cf-Access-Jwt-Assertion": makeJwt("test@example.com") };

function authed(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, {
    ...init,
    headers: { ...AUTH_HEADER, ...(init?.headers ?? {}) },
  });
}

// Seeds an api_keys row for the requesting identity so the table renders a row.
async function seedApiKey(identity = "test@example.com"): Promise<string> {
  const raw = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = raw.slice(0, 7);
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await env.DB.prepare(
    "INSERT INTO api_keys (identity, title, key_prefix, key_hash, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(identity, "Test key", prefix, hash, "create", Math.floor(Date.now() / 1000))
    .run();
  return raw;
}

beforeAll(applyMigrations);
beforeEach(resetData);

async function fetchKeysHtml(): Promise<string> {
  const res = await SELF.fetch(authed("/_/admin/keys"));
  expect(res.status).toBe(200);
  return res.text();
}

describe("Keys page header", () => {
  it("renders the New key action wired to the create modal", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain("New key");
    expect(html).toContain("showCreateKeyModal()");
  });

  it("drops the standalone count line and toolbar", async () => {
    const html = await fetchKeysHtml();
    expect(html).not.toContain('class="toolbar-count"');
    expect(html).not.toContain('class="toolbar"');
  });
});

describe("Keys page auth banner", () => {
  it("renders the auth guidance with an inline Authorization code element", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain("Authenticate requests with a key");
    expect(html).toContain("<code>Authorization</code>");
  });

  it("links to the API documentation", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain('href="/_/api/docs"');
  });
});

describe("Keys page quick start", () => {
  it("renders a copyable curl example against the live request origin", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain("https://shrtnr.test/_/api/links");
    expect(html).toContain("Bearer");
  });

  it("wires the code block to the clipboard copy helper", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain('id="quickstart-curl"');
    // Hono escapes the single quotes in the onclick attribute to &#39;; the
    // browser decodes them, so the assertion tolerates either form.
    expect(html).toMatch(/copyCodeBlock\((?:'|&#39;)quickstart-curl(?:'|&#39;)\)/);
  });
});

describe("Keys page SDK card", () => {
  it("lists the three published SDKs with package coordinates", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain("@oddbit/shrtnr");
    expect(html).toContain("PyPI: shrtnr");
    expect(html).toContain("pub.dev: shrtnr");
  });

  it("links each SDK to its registry page", async () => {
    const html = await fetchKeysHtml();
    expect(html).toContain("shrtnr-npm-app");
    expect(html).toContain("shrtnr-pypi-app");
    expect(html).toContain("shrtnr-pub-app");
  });
});

describe("Keys page table", () => {
  it("masks the key prefix with bullets instead of a bare truncation", async () => {
    const raw = await seedApiKey();
    const prefix = raw.slice(0, 7);
    const html = await fetchKeysHtml();
    expect(html).toContain(`${prefix}••••••`);
    expect(html).not.toContain(`${prefix}&hellip;`);
  });

  it("translates the scope badge instead of rendering the raw scope token", async () => {
    await seedApiKey();
    const html = await fetchKeysHtml();
    expect(html).toMatch(/class="scope-badge create"[^>]*>Create</);
    expect(html).not.toMatch(/class="scope-badge create"[^>]*>create</);
  });

  it("localizes the scope badge for a non-English locale", async () => {
    await seedApiKey();
    const res = await SELF.fetch(authed("/_/admin/keys", { headers: { Cookie: "lang=id" } }));
    const html = await res.text();
    expect(html).toMatch(/class="scope-badge create"[^>]*>Buat</);
  });

  it("keeps the delete action for each key", async () => {
    await seedApiKey();
    const html = await fetchKeysHtml();
    // The delete action rides on data-* attributes read by a delegated handler
    // rather than an inline onclick, so a key title cannot break out into
    // executable script. The title is carried verbatim on data-delete-key-title.
    expect(html).toMatch(/data-delete-key="\d+"/);
    expect(html).toContain('data-delete-key-title=');
    // The vulnerable inline onclick handler must be gone from the markup. The
    // client script still defines deleteKey(), so target the attribute form.
    expect(html).not.toContain('onclick="deleteKey(');
  });
});
