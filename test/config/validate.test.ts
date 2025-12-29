import { describe, expect, it } from "vitest";

import { getIssuePattern, validateConfig } from "~/config/validate.js";

import {
  DEFAULT_VALUES,
  MINIMAL_CONFIG,
  REDOS_PATTERNS,
  SAFE_PATTERNS,
} from "./test-helpers.js";

describe("validateConfig", () => {
  it("should validate minimal valid configuration", () => {
    const config = validateConfig(MINIMAL_CONFIG);

    expect(config.jiraServerUrl).toBe(MINIMAL_CONFIG.jiraServerUrl);
    expect(config.transitionIssues).toBe(DEFAULT_VALUES.transitionIssues);
    expect(config.createVersions).toBe(DEFAULT_VALUES.createVersions);
  });

  it("should validate full configuration", () => {
    const fullConfig = {
      createVersions: true,
      customIssuePattern: String.raw`[A-Z]+-\d+`,
      jiraApiToken: "token123",
      jiraServerUrl: "https://company.atlassian.net",
      jiraUsername: "user@example.com",
      transitionIssues: true,
      transitionToStatus: "Done",
      versionPrefix: "MyService",
    };
    const config = validateConfig(fullConfig);

    expect(config).toMatchObject(fullConfig);
  });

  it("should throw error if jiraServerUrl is missing", () => {
    expect(() => validateConfig({})).toThrow(
      "Missing required configuration: jiraServerUrl",
    );
  });

  it("should throw error if jiraServerUrl is invalid URL", () => {
    expect(() => validateConfig({ jiraServerUrl: "not-a-url" })).toThrow(
      "Invalid jiraServerUrl",
    );
  });

  it("should throw error if transitionIssues is true without credentials", () => {
    expect(() =>
      validateConfig({ ...MINIMAL_CONFIG, transitionIssues: true }),
    ).toThrow("Jira credentials");
  });

  it("should throw error if createVersions is true without credentials", () => {
    expect(() =>
      validateConfig({ ...MINIMAL_CONFIG, createVersions: true }),
    ).toThrow("Jira credentials");
  });

  it("should throw error if customIssuePattern is invalid regex", () => {
    expect(() =>
      validateConfig({
        ...MINIMAL_CONFIG,
        customIssuePattern: "[invalid(regex",
      }),
    ).toThrow("Invalid customIssuePattern");
  });

  describe("ReDoS protection", () => {
    it("should reject pattern with nested quantifiers (a+)+", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.nestedPlus,
        }),
      ).toThrow("ReDoS");
    });

    it("should reject pattern with nested stars (a*)*", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.nestedStar,
        }),
      ).toThrow("ReDoS");
    });

    it("should reject pattern with nested character class quantifiers", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.nestedCharClass,
        }),
      ).toThrow("ReDoS");
    });

    it("should reject pattern with multiple nested star groups", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.multipleNested,
        }),
      ).toThrow("ReDoS");
    });

    it("should reject pattern with deeply nested quantifiers", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.deeplyNested,
        }),
      ).toThrow("ReDoS");
    });

    it("should reject pattern with greedy quantifier and backtracking", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.greedyBacktrack,
        }),
      ).toThrow("ReDoS");
    });

    it("should accept safe simple pattern", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: SAFE_PATTERNS.simple,
        }),
      ).not.toThrow();
    });

    it("should accept safe alternation without quantifiers", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: SAFE_PATTERNS.alternation,
        }),
      ).not.toThrow();
    });

    it("should accept safe character class with quantifier", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: SAFE_PATTERNS.charClassQuantifier,
        }),
      ).not.toThrow();
    });

    it("should accept safe single-level quantifiers", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: SAFE_PATTERNS.singleLevel,
        }),
      ).not.toThrow();
    });

    it("should accept simple alternation with quantifier (not all alternation patterns are unsafe)", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: SAFE_PATTERNS.simpleAlternationQuantifier,
        }),
      ).not.toThrow();
    });

    it("should provide helpful error message for ReDoS", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.nestedPlus,
        }),
      ).toThrow(/ReDoS.*catastrophic backtracking.*safe-regex/s);
    });

    it("should explain what patterns to avoid", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: REDOS_PATTERNS.nestedStar,
        }),
      ).toThrow(/nested quantifiers.*\(a\+\)\+.*\(a\*\)\*/s);
    });

    it("should include pattern in error message for debugging", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: "([0-9]+)*x",
        }),
      ).toThrow(/\(\[0-9\]\+\)\*x/);
    });

    it("should provide link to safe-regex documentation", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          customIssuePattern: "(a*)*",
        }),
      ).toThrow(/https:\/\/github\.com\/substack\/safe-regex/);
    });
  });

  describe("numeric field validation", () => {
    it("should accept valid timeout", () => {
      const config = validateConfig({ ...MINIMAL_CONFIG, timeout: 60_000 });
      expect(config.timeout).toBe(60_000);
    });

    it.each([
      { error: "Invalid timeout", field: "timeout", value: -1000 },
      { error: "Invalid timeout", field: "timeout", value: 0 },
      { error: "Invalid retries", field: "retries", value: 15 },
      { error: "Invalid concurrency", field: "concurrency", value: 150 },
    ])("should reject invalid $field: $value", ({ error, field, value }) => {
      expect(() =>
        validateConfig({ ...MINIMAL_CONFIG, [field]: value }),
      ).toThrow(error);
    });

    it("should accept valid retries", () => {
      const config = validateConfig({ ...MINIMAL_CONFIG, retries: 5 });
      expect(config.retries).toBe(5);
    });

    it("should accept valid concurrency", () => {
      const config = validateConfig({ ...MINIMAL_CONFIG, concurrency: 20 });
      expect(config.concurrency).toBe(20);
    });
  });

  describe("boolean field validation", () => {
    it("should accept dryRun as boolean", () => {
      const config = validateConfig({ ...MINIMAL_CONFIG, dryRun: true });
      expect(config.dryRun).toBe(true);
    });

    it("should accept failOnJiraError as boolean", () => {
      const config = validateConfig({
        ...MINIMAL_CONFIG,
        failOnJiraError: true,
      });
      expect(config.failOnJiraError).toBe(true);
    });

    it("should accept rejectUnauthorized as boolean", () => {
      const config = validateConfig({
        ...MINIMAL_CONFIG,
        rejectUnauthorized: false,
      });
      expect(config.rejectUnauthorized).toBe(false);
    });

    it("should reject dryRun as non-boolean", () => {
      expect(() =>
        validateConfig({
          ...MINIMAL_CONFIG,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          dryRun: "true" as unknown as boolean,
        }),
      ).toThrow("Invalid dryRun");
    });
  });

  describe("default values", () => {
    it("should apply default timeout", () => {
      const config = validateConfig(MINIMAL_CONFIG);
      expect(config.timeout).toBe(DEFAULT_VALUES.timeout);
    });

    it("should apply default retries", () => {
      const config = validateConfig(MINIMAL_CONFIG);
      expect(config.retries).toBe(DEFAULT_VALUES.retries);
    });

    it("should apply default concurrency", () => {
      const config = validateConfig(MINIMAL_CONFIG);
      expect(config.concurrency).toBe(DEFAULT_VALUES.concurrency);
    });

    it("should apply default dryRun", () => {
      const config = validateConfig(MINIMAL_CONFIG);
      expect(config.dryRun).toBe(DEFAULT_VALUES.dryRun);
    });

    it("should apply default rejectUnauthorized", () => {
      const config = validateConfig(MINIMAL_CONFIG);
      expect(config.rejectUnauthorized).toBe(DEFAULT_VALUES.rejectUnauthorized);
    });
  });
});

describe("getIssuePattern", () => {
  it("should return default pattern", () => {
    const config = validateConfig(MINIMAL_CONFIG);
    const pattern = getIssuePattern(config);

    expect(pattern.source).toBe(String.raw`[A-Z][A-Z0-9]+-\d+`);
    expect(pattern.flags).toBe("g");
  });

  it("should return custom pattern", () => {
    const config = validateConfig({
      ...MINIMAL_CONFIG,
      customIssuePattern: SAFE_PATTERNS.simple,
    });
    const pattern = getIssuePattern(config);

    expect(pattern.source).toBe(SAFE_PATTERNS.simple);
  });

  it("should match valid Jira issue keys", () => {
    const config = validateConfig(MINIMAL_CONFIG);
    const pattern = getIssuePattern(config);
    const text = "Fix PROJECT-123 and TEAM-456";
    const matches = [...text.matchAll(pattern)];

    expect(matches).toHaveLength(2);
    expect(matches[0][0]).toBe("PROJECT-123");
    expect(matches[1][0]).toBe("TEAM-456");
  });

  it("should not match invalid issue keys", () => {
    const config = validateConfig(MINIMAL_CONFIG);
    const pattern = getIssuePattern(config);
    const text = "Fix project-123 lowercase only";
    const matches = [...text.matchAll(pattern)];

    expect(matches).toHaveLength(0);
  });
});

describe("ReDoS vulnerability demonstration", () => {
  it.each([
    {
      description: "CPU exhaustion from nested quantifiers",
      pattern: REDOS_PATTERNS.nestedPlus,
    },
    {
      description: "catastrophic backtracking from nested character classes",
      pattern: REDOS_PATTERNS.nestedCharClass,
    },
    {
      description: "exponential time complexity from nested star quantifiers",
      pattern: REDOS_PATTERNS.nestedStar,
    },
  ])("should prevent $description", ({ pattern }) => {
    expect(() =>
      validateConfig({
        ...MINIMAL_CONFIG,
        customIssuePattern: pattern,
      }),
    ).toThrow("ReDoS");
  });
});
