// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/preact";
import { setStorageItem, getClipboardMock } from "./setup";
import { ExtensionError } from "../src/errors";

let mockedShorten: ReturnType<typeof vi.fn<(url: string) => Promise<unknown>>>;
let mockedQr: ReturnType<typeof vi.fn<(id: number, slug?: string) => Promise<string>>>;
let mockedAddSlug: ReturnType<typeof vi.fn<(id: number, slug: string) => Promise<unknown>>>;

vi.mock("../src/api", async () => {
  const actual = await vi.importActual<typeof import("../src/api")>("../src/api");
  return {
    isShortenable: actual.isShortenable,
    isValidSlug: actual.isValidSlug,
    shortenUrl: (url: string) => mockedShorten(url),
    getQrSvg: (id: number, slug?: string) => mockedQr(id, slug),
    addCustomSlug: (id: number, slug: string) => mockedAddSlug(id, slug),
    testConnection: vi.fn(async () => undefined),
  };
});

let local: Record<string, unknown>;

function installLocalArea(): void {
  local = {};
  (chrome.storage as unknown as Record<string, unknown>).local = {
    get: vi.fn(async (key: string) => (key in local ? { [key]: local[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(local, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete local[key];
    }),
  };
}

beforeEach(() => {
  mockedShorten = vi.fn();
  mockedQr = vi.fn();
  mockedAddSlug = vi.fn();
  installLocalArea();
  setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
  mockedShorten.mockResolvedValue({ id: 42, slug: "abc", shortUrl: "https://x.com/abc" });
  cleanup();
});

async function renderPopup() {
  const { Popup } = await import("../src/popup/Popup");
  render(<Popup />);
}

const slugInput = () => screen.getByLabelText(/custom slug/i) as HTMLInputElement;
const addButton = () => screen.getByRole("button", { name: /add slug/i }) as HTMLButtonElement;

describe("Popup: custom slug", () => {
  it("disables Add until a slug is typed", async () => {
    await renderPopup();
    await waitFor(() => slugInput());
    expect(addButton().disabled).toBe(true);
    fireEvent.input(slugInput(), { target: { value: "my-link" } });
    expect(addButton().disabled).toBe(false);
  });

  it("adds the slug, shows and copies the new short URL, and resets the QR cache", async () => {
    mockedAddSlug.mockResolvedValue({ id: 42, slug: "my-link", shortUrl: "https://x.com/my-link" });
    mockedQr.mockResolvedValue("<svg/>");
    const clipboard = getClipboardMock();
    await renderPopup();
    await waitFor(() => slugInput());
    fireEvent.input(slugInput(), { target: { value: "my-link" } });
    fireEvent.click(addButton());
    await waitFor(() => {
      expect(screen.getByText("https://x.com/my-link")).toBeTruthy();
    });
    expect(mockedAddSlug).toHaveBeenCalledWith(42, "my-link");
    expect(clipboard.writeText).toHaveBeenCalledWith("https://x.com/my-link");
    expect(screen.queryByText("https://x.com/abc")).toBeNull();

    // The QR now has to encode the custom slug, not the primary one.
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => {
      expect(mockedQr).toHaveBeenCalledWith(42, "my-link");
    });
  });

  it("submits on Enter inside the slug field", async () => {
    mockedAddSlug.mockResolvedValue({ id: 42, slug: "enter", shortUrl: "https://x.com/enter" });
    await renderPopup();
    await waitFor(() => slugInput());
    fireEvent.input(slugInput(), { target: { value: "enter" } });
    fireEvent.submit(slugInput().closest("form")!);
    await waitFor(() => {
      expect(mockedAddSlug).toHaveBeenCalledWith(42, "enter");
    });
  });

  it("shows the conflict message on 409 and keeps the original short URL", async () => {
    mockedAddSlug.mockRejectedValue(new ExtensionError("conflict", "Slug already exists", 409));
    await renderPopup();
    await waitFor(() => slugInput());
    fireEvent.input(slugInput(), { target: { value: "taken" } });
    fireEvent.click(addButton());
    await waitFor(() => {
      expect(screen.getByText(/already taken/i)).toBeTruthy();
    });
    expect(screen.getByText("https://x.com/abc")).toBeTruthy();
  });

  it("shows the slug rule when the slug is invalid", async () => {
    mockedAddSlug.mockRejectedValue(new ExtensionError("slug-invalid"));
    await renderPopup();
    await waitFor(() => slugInput());
    fireEvent.input(slugInput(), { target: { value: "-bad-" } });
    fireEvent.click(addButton());
    await waitFor(() => {
      expect(screen.getByText(/letters, numbers and hyphens/i)).toBeTruthy();
    });
  });

  it("passes the server's validation message through on 400", async () => {
    mockedAddSlug.mockRejectedValue(new ExtensionError("validation", "Slug too long", 400));
    await renderPopup();
    await waitFor(() => slugInput());
    fireEvent.input(slugInput(), { target: { value: "x" } });
    fireEvent.click(addButton());
    await waitFor(() => {
      expect(screen.getByText("Slug too long")).toBeTruthy();
    });
  });

  it("clears the error once the user edits the slug again", async () => {
    mockedAddSlug.mockRejectedValue(new ExtensionError("conflict", "Slug already exists", 409));
    await renderPopup();
    await waitFor(() => slugInput());
    fireEvent.input(slugInput(), { target: { value: "taken" } });
    fireEvent.click(addButton());
    await waitFor(() => screen.getByText(/already taken/i));
    fireEvent.input(slugInput(), { target: { value: "taken-2" } });
    await waitFor(() => {
      expect(screen.queryByText(/already taken/i)).toBeNull();
    });
  });
});

describe("Popup: QR errors are visible", () => {
  it("names the read scope when the QR fetch is forbidden", async () => {
    mockedQr.mockRejectedValue(new ExtensionError("forbidden", "Forbidden", 403));
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => {
      expect(screen.getByText(/read scope/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /show qr/i })).toBeTruthy();
  });

  it("shows a generic QR message for other failures", async () => {
    mockedQr.mockRejectedValue(new ExtensionError("server", "boom", 500));
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => {
      expect(screen.getByText(/couldn't fetch the qr code/i)).toBeTruthy();
    });
  });
});

describe("Popup: recent links", () => {
  it("records the shortened link locally and hides the list while it is the only entry", async () => {
    await renderPopup();
    await waitFor(() => screen.getByText("https://x.com/abc"));
    await waitFor(() => {
      expect(local.recent).toEqual([expect.objectContaining({ id: 42, slug: "abc" })]);
    });
    expect(screen.queryByText(/recent from this browser/i)).toBeNull();
  });

  it("lists earlier links from this browser, excluding the current one", async () => {
    local.recent = [
      { id: 7, slug: "older", shortUrl: "https://x.com/older", url: "https://news.example.com/story", createdAt: 1 },
    ];
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText(/recent from this browser/i)).toBeTruthy();
    });
    const link = screen.getByRole("link", { name: "/older" }) as HTMLAnchorElement;
    expect(link.href).toBe("https://x.com/older");
    expect(screen.getByText("news.example.com")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "/abc" })).toBeNull();
  });

  it("still shortens when the local storage area is missing", async () => {
    delete (chrome.storage as unknown as Record<string, unknown>).local;
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText("https://x.com/abc")).toBeTruthy();
    });
  });
});
