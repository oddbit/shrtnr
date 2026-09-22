// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/preact";
import { setStorageItem } from "./setup";
import { ExtensionError } from "../src/errors";

let mockedTest: ReturnType<typeof vi.fn<(config: { baseUrl: string; apiKey: string }) => Promise<void>>>;

vi.mock("../src/api", async () => {
  return {
    isShortenable: () => true,
    isValidSlug: () => true,
    shortenUrl: vi.fn(),
    getQrSvg: vi.fn(),
    addCustomSlug: vi.fn(),
    testConnection: (config: { baseUrl: string; apiKey: string }) => mockedTest(config),
  };
});

beforeEach(() => {
  mockedTest = vi.fn(async () => undefined);
  delete (chrome.permissions as unknown as Record<string, unknown>).getAll;
  delete (chrome as unknown as Record<string, unknown>).commands;
  cleanup();
});

function installCommands(shortcut: string): void {
  (chrome as unknown as Record<string, unknown>).commands = {
    getAll: vi.fn(async () => [
      { name: "_execute_action", description: "Shorten the current tab with shrtnr", shortcut },
    ]),
  };
}

async function renderOptions() {
  const { Options } = await import("../src/options/Options");
  render(<Options />);
}

async function fillForm(baseUrl: string, apiKey = "sk_abc") {
  await waitFor(() => screen.getByLabelText(/server url/i));
  fireEvent.input(screen.getByLabelText(/server url/i), { target: { value: baseUrl } });
  fireEvent.input(screen.getByLabelText(/api key/i), { target: { value: apiKey } });
}

describe("Options: create-only keys", () => {
  it("reports a 403 on the read probe as connected with a scope note, not as an error", async () => {
    mockedTest.mockRejectedValue(new ExtensionError("forbidden", "Forbidden", 403));
    await renderOptions();
    await fillForm("https://x.com");
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/connected/i);
    });
    expect(screen.getByRole("status").textContent).toMatch(/read scope/i);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains the scope choice next to the form", async () => {
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    expect(screen.getByText(/create scope is enough/i)).toBeTruthy();
  });
});

describe("Options: host permission hygiene", () => {
  it("revokes the previous origin's permission when the server URL changes", async () => {
    setStorageItem("config", { baseUrl: "https://old.example", apiKey: "sk_old" });
    chrome.permissions.request = vi.fn(async () => true);
    const remove = vi.fn(async () => true);
    (chrome.permissions as unknown as { remove: unknown }).remove = remove;
    // What the browser holds once the save has requested the new origin.
    (chrome.permissions as unknown as { getAll: unknown }).getAll = vi.fn(async () => ({
      permissions: ["storage"],
      origins: ["https://old.example/*", "https://new.example/*"],
    }));
    await renderOptions();
    await fillForm("https://new.example/admin", "sk_new");
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({ origins: ["https://old.example/*"] });
    });
    const { getConfig } = await import("../src/storage");
    expect(await getConfig()).toEqual({ baseUrl: "https://new.example", apiKey: "sk_new" });
  });

  it("keeps the permission when only the API key changes", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_old" });
    chrome.permissions.request = vi.fn(async () => true);
    const remove = vi.fn(async () => true);
    (chrome.permissions as unknown as { remove: unknown }).remove = remove;
    await renderOptions();
    await fillForm("https://x.com", "sk_new");
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(async () => {
      const { getConfig } = await import("../src/storage");
      expect((await getConfig())?.apiKey).toBe("sk_new");
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("drops an origin the connection test granted but the user never saved", async () => {
    // Test grants whatever is in the field at the time. Editing the field
    // and saving leaves that origin granted unless the save reads the
    // grants back rather than the previous config.
    setStorageItem("config", { baseUrl: "https://old.example", apiKey: "sk_old" });
    chrome.permissions.request = vi.fn(async () => true);
    const remove = vi.fn(async () => true);
    (chrome.permissions as unknown as { remove: unknown }).remove = remove;
    (chrome.permissions as unknown as { getAll: unknown }).getAll = vi.fn(async () => ({
      permissions: ["storage"],
      origins: ["https://old.example/*", "https://a.example/*", "https://b.example/*"],
    }));
    await renderOptions();
    await fillForm("https://a.example", "sk_new");
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => expect(mockedTest).toHaveBeenCalled());
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://b.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith({
      origins: ["https://old.example/*", "https://a.example/*"],
    });
  });

  it("saves even when the browser has no permissions.remove", async () => {
    setStorageItem("config", { baseUrl: "https://old.example", apiKey: "sk_old" });
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await fillForm("https://new.example");
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(async () => {
      const { getConfig } = await import("../src/storage");
      expect((await getConfig())?.baseUrl).toBe("https://new.example");
    });
  });
});

describe("Options: about section", () => {
  it("shows the installed version when the runtime exposes the manifest", async () => {
    (chrome.runtime as unknown as { getManifest: unknown }).getManifest = () => ({ version: "9.9.9" });
    await renderOptions();
    await waitFor(() => {
      expect(screen.getByText(/version 9\.9\.9/i)).toBeTruthy();
    });
  });
});

describe("Options: keyboard shortcut", () => {
  it("names the binding the browser actually assigned", async () => {
    // suggested_key in the manifest is a request. Read the live binding so a
    // rebound or browser-reassigned combination is the one on screen.
    installCommands("Ctrl+Shift+K");
    await renderOptions();
    await waitFor(() => {
      expect(screen.getByText(/ctrl\+shift\+k/i)).toBeTruthy();
    });
  });

  it("says so when the browser left the command unassigned", async () => {
    installCommands("");
    await renderOptions();
    await waitFor(() => {
      expect(screen.getByText(/no shortcut is assigned/i)).toBeTruthy();
    });
  });

  it("renders no shortcut line when the browser exposes no commands API", async () => {
    await renderOptions();
    await waitFor(() => screen.getByText(/keyboard shortcut/i));
    expect(screen.queryByText(/opens the popup/i)).toBeNull();
    expect(screen.queryByText(/no shortcut is assigned/i)).toBeNull();
  });
});
