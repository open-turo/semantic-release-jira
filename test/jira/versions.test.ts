import { describe, expect, it } from "vitest";

import { generateVersionName } from "~/jira/client.js";

describe("generateVersionName", () => {
  const serviceName = "my-service";

  it.each([
    {
      description: "repo name prefix",
      expected: "my-service-v1.2.3",
      version: "1.2.3",
    },
    {
      description: "prerelease versions",
      expected: "my-service-v1.2.3-beta.1",
      version: "1.2.3-beta.1",
    },
    {
      description: "version with build metadata",
      expected: "my-service-v1.2.3+20230101",
      version: "1.2.3+20230101",
    },
  ])(
    "should generate version name with $description",
    ({ expected, version }) => {
      const versionName = generateVersionName(serviceName, version);
      expect(versionName).toBe(expected);
    },
  );

  it("should generate version name with custom prefix", () => {
    const versionName = generateVersionName(
      serviceName,
      "1.2.3",
      "CustomService",
    );
    expect(versionName).toBe("CustomService-v1.2.3");
  });
});
