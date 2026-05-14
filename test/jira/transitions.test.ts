import { describe, expect, it } from "vitest";

import type { JiraTransition } from "~/types/index.js";

import { findDoneTransition } from "~/jira/client.js";

function createTransition(
  id: string,
  name: string,
  toId?: string,
): JiraTransition {
  return {
    id,
    name,
    to: { id: toId ?? id + "0", name },
  };
}

function expectTransitionMatch(
  transition: JiraTransition | undefined,
  expectedName: string,
): void {
  expect(transition).toBeDefined();
  expect(transition?.name).toBe(expectedName);
}

describe("findDoneTransition", () => {
  const mockTransitions: JiraTransition[] = [
    createTransition("1", "To Do"),
    createTransition("2", "In Progress"),
    createTransition("3", "Done"),
  ];

  // eslint-disable-next-line vitest/expect-expect
  it("should find exact match when target status provided", () => {
    const transition = findDoneTransition(mockTransitions, "Done");
    expectTransitionMatch(transition, "Done");
  });

  // eslint-disable-next-line vitest/expect-expect
  it("should find case-insensitive exact match", () => {
    const transition = findDoneTransition(mockTransitions, "done");
    expectTransitionMatch(transition, "Done");
  });

  // eslint-disable-next-line vitest/expect-expect
  it.each([
    { name: "Mark Done", pattern: "done" },
    { name: "Closed", pattern: "closed" },
    { name: "Completed", pattern: "completed" },
    { name: "Resolved", pattern: "resolved" },
  ])("should fuzzy match against '$pattern' pattern", ({ name }) => {
    const transitions = [
      createTransition("1", "In Progress"),
      createTransition("2", name),
    ];
    const transition = findDoneTransition(transitions);
    expectTransitionMatch(transition, name);
  });

  it("should return undefined when no match found", () => {
    const transitions = [createTransition("1", "In Progress")];
    const transition = findDoneTransition(transitions);
    expect(transition).toBeUndefined();
  });

  // eslint-disable-next-line vitest/expect-expect
  it("should prefer exact match over fuzzy match", () => {
    const transitions = [
      createTransition("1", "Mark as Done", "10"),
      createTransition("2", "Complete"),
    ];
    const transition = findDoneTransition(transitions, "Complete");
    expectTransitionMatch(transition, "Complete");
  });
});
