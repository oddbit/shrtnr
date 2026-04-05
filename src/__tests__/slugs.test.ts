import { describe, it, expect } from "vitest";
import {
  generateRandomSlug,
  validateRandomSlug,
  validateCustomSlug,
  validateSlugLength,
  RANDOM_CHARSET,
} from "../slugs";

const UNAMBIGUOUS_CHARSET = RANDOM_CHARSET;
const EXCLUDED_CHARS = ["I", "O", "l", "o", "0", "1"];

describe("generateRandomSlug", () => {
  it("should only contain characters from the unambiguous charset", () => {
    for (let i = 0; i < 100; i++) {
      const slug = generateRandomSlug(6);
      for (const char of slug) {
        expect(UNAMBIGUOUS_CHARSET).toContain(char);
      }
    }
  });

  it("should never contain excluded ambiguous characters", () => {
    for (let i = 0; i < 100; i++) {
      const slug = generateRandomSlug(6);
      for (const char of EXCLUDED_CHARS) {
        expect(slug).not.toContain(char);
      }
    }
  });

  it("should only produce lowercase characters and digits", () => {
    for (let i = 0; i < 100; i++) {
      const slug = generateRandomSlug(8);
      expect(slug).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("should match the requested length", () => {
    expect(generateRandomSlug(3)).toHaveLength(3);
    expect(generateRandomSlug(5)).toHaveLength(5);
    expect(generateRandomSlug(10)).toHaveLength(10);
  });
});

describe("validateRandomSlug", () => {
  it("should reject slugs shorter than 3 characters", () => {
    expect(validateRandomSlug("ab")).toBe("Slug must be at least 3 characters");
    expect(validateRandomSlug("a")).toBe("Slug must be at least 3 characters");
    expect(validateRandomSlug("")).toBe("Slug must be at least 3 characters");
  });

  it("should reject slugs starting with underscore", () => {
    expect(validateRandomSlug("_abc")).toBe("Slug must not start with underscore");
  });

  it("should reject slugs with non-alphanumeric characters", () => {
    expect(validateRandomSlug("ab-c")).toBe("Slug must contain only alphanumeric characters");
    expect(validateRandomSlug("ab c")).toBe("Slug must contain only alphanumeric characters");
    expect(validateRandomSlug("ab.c")).toBe("Slug must contain only alphanumeric characters");
  });

  it("should accept valid lowercase slugs", () => {
    expect(validateRandomSlug("abc")).toBeNull();
    expect(validateRandomSlug("abc123")).toBeNull();
    expect(validateRandomSlug("longslugvalue")).toBeNull();
  });

  it("should reject uppercase characters", () => {
    expect(validateRandomSlug("ABC123")).not.toBeNull();
    expect(validateRandomSlug("longSlugValue")).not.toBeNull();
  });
});

describe("validateCustomSlug", () => {
  it("should accept a single character", () => {
    expect(validateCustomSlug("a")).toBeNull();
    expect(validateCustomSlug("z")).toBeNull();
    expect(validateCustomSlug("5")).toBeNull();
  });

  it("should accept slugs with hyphens in the middle", () => {
    expect(validateCustomSlug("my-slug")).toBeNull();
    expect(validateCustomSlug("a-b-c")).toBeNull();
  });

  it("should reject slugs starting with a hyphen", () => {
    expect(validateCustomSlug("-slug")).toBe(
      "Custom slug must not start or end with a hyphen"
    );
  });

  it("should reject slugs ending with a hyphen", () => {
    expect(validateCustomSlug("slug-")).toBe(
      "Custom slug must not start or end with a hyphen"
    );
  });

  it("should reject slugs starting with underscore", () => {
    expect(validateCustomSlug("_slug")).toBe("Slug must not start with underscore");
  });

  it("should reject empty slugs", () => {
    expect(validateCustomSlug("")).toBe("Custom slug must not be empty");
  });
});

describe("validateSlugLength", () => {
  it("should reject lengths below 3", () => {
    expect(validateSlugLength(2)).toBe("Slug length must be an integer >= 3");
    expect(validateSlugLength(1)).toBe("Slug length must be an integer >= 3");
    expect(validateSlugLength(0)).toBe("Slug length must be an integer >= 3");
    expect(validateSlugLength(-1)).toBe("Slug length must be an integer >= 3");
  });

  it("should reject non-integer values", () => {
    expect(validateSlugLength(3.5)).toBe("Slug length must be an integer >= 3");
  });

  it("should reject lengths above 128", () => {
    expect(validateSlugLength(129)).toBe("Slug length must be an integer <= 128");
    expect(validateSlugLength(1000)).toBe("Slug length must be an integer <= 128");
  });

  it("should accept valid lengths", () => {
    expect(validateSlugLength(3)).toBeNull();
    expect(validateSlugLength(5)).toBeNull();
    expect(validateSlugLength(10)).toBeNull();
    expect(validateSlugLength(128)).toBeNull();
  });
});
