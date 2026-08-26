// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/preact";
import { setStorageItem } from "./setup";
import { ExtensionError } from "../src/errors";

let mockedTest: ReturnType<typeof vi.fn<(config: { baseUrl: string; apiKey: string }) => Promise<void>>>;

type ConfigArg = { baseUrl: string; apiKey: string };

vi.mock("../src/api", async () => {
  return {
    isShortenable: () => true,
    shortenUrl: vi.fn(),
    getQrSvg: vi.fn(),
    testConnection: (config: ConfigArg) => mockedTest(config),
  };
});

beforeEach(() => {
  mockedTest = vi.fn(async () => undefined);
  cleanup();
});

async function renderOptions() {
  const { Options } = await import("../src/options/Options");
  render(<Options />);
}

describe("Options — banner visibility", () => {
  it("renders the deploy CTA banner when no config saved", async () => {
    await renderOptions();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /deploy/i }) as HTMLAnchorElement;
      expect(link.href).toContain("oddb.it/shrtnr-deploy-ext");
    });
  });

  it("does NOT render the deploy CTA when a config is saved", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    await renderOptions();
    await waitFor(() => screen.getByRole("button", { name: /save/i }));
    expect(screen.queryByRole("link", { name: /deploy/i })).toBeNull();
  });
});

describe("Options — Test connection", () => {
  it("shows connected status on success", async () => {
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeTruthy();
    });
  });

  it("requests host permission before testing", async () => {
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(chrome.permissions.request).toHaveBeenCalledWith({
        origins: ["https://x.com/*"],
      });
    });
    await waitFor(() => {
      expect(mockedTest).toHaveBeenCalledWith({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    });
  });

  it("normalizes a server URL with a path to its origin before testing", async () => {
    // A URL copied from the address bar (with a path) must resolve the same
    // way handleSave does, or a server that will work fine once saved tests
    // as unreachable.
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com/_/admin" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(mockedTest).toHaveBeenCalledWith({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    });
  });

  it("shows a permission error and does not call testConnection when permission is denied", async () => {
    chrome.permissions.request = vi.fn(async () => false);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(screen.getByText(/needs permission/i)).toBeTruthy();
    });
    expect(mockedTest).not.toHaveBeenCalled();
  });

  it("shows a localized invalid-URL error and skips the permission request", async () => {
    // error.validation is a "{message}" passthrough, so feeding it an English
    // literal leaks English into id/sv installs.
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "not a url" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(screen.getByText(/not a valid url/i)).toBeTruthy();
    });
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(mockedTest).not.toHaveBeenCalled();
  });

  it("shows the auth error message on 401", async () => {
    mockedTest.mockRejectedValue(new ExtensionError("unauthorized", "bad", 401));
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test/i }));
    await waitFor(() => {
      expect(screen.getByText(/api key was rejected/i)).toBeTruthy();
    });
  });
});

describe("Options — Save", () => {
  it("requests host permission and persists when granted", async () => {
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com/admin" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "  sk_abc  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(chrome.permissions.request).toHaveBeenCalledWith({
        origins: ["https://x.com/*"],
      });
    });
    await waitFor(async () => {
      const { getConfig } = await import("../src/storage");
      const c = await getConfig();
      expect(c).toEqual({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    });
  });

  it("shows error and does not persist when permission denied", async () => {
    chrome.permissions.request = vi.fn(async () => false);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByText(/needs permission/i)).toBeTruthy();
    });
    const { getConfig } = await import("../src/storage");
    expect(await getConfig()).toBeNull();
  });

  it("shows a localized invalid-URL error and does not persist", async () => {
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "not a url" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByText(/not a valid url/i)).toBeTruthy();
    });
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    const { getConfig } = await import("../src/storage");
    expect(await getConfig()).toBeNull();
  });

  it("shows a localized message when the browser rejects the write with an Error", async () => {
    // chrome.storage error strings are English-only browser internals, so
    // surfacing err.message leaks English into id/sv installs.
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    chrome.storage.sync.set = vi.fn(async () => {
      throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
    });
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByText(/couldn't save your settings/i)).toBeTruthy();
    });
    expect(screen.queryByText(/QUOTA_BYTES_PER_ITEM/)).toBeNull();
  });

  it("shows the same localized message when the write rejects with a non-Error", async () => {
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    chrome.storage.sync.set = vi.fn(async () => {
      throw "boom";
    });
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByText(/couldn't save your settings/i)).toBeTruthy();
    });
  });

  it("Save button is disabled when fields empty", async () => {
    await renderOptions();
    await waitFor(() => screen.getByRole("button", { name: /^save$/i }));
    const saveBtn = screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("hides the deploy CTA after first successful save", async () => {
    chrome.permissions.request = vi.fn(async () => true);
    await renderOptions();
    await waitFor(() => screen.getByLabelText(/server url/i));
    expect(screen.getByRole("link", { name: /deploy/i })).toBeTruthy();
    fireEvent.input(screen.getByLabelText(/server url/i), {
      target: { value: "https://x.com" },
    });
    fireEvent.input(screen.getByLabelText(/api key/i), {
      target: { value: "sk_abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /deploy/i })).toBeNull();
    });
  });
});
