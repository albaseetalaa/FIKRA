export const deterministicFixtureTemplate = {
  projectId: "proj_fixture",
  projectIdea: "Describe a deterministic project idea here.",
  projectContext: {
    businessName: "Template Co",
    businessDescription: "Template business description",
    country: "Jordan",
    businessVertical: "generic_other",
    currentDate: "2026-07-28T00:00:00.000Z",
    projectCreatedAt: "2026-07-28T00:00:00.000Z",
  },
  expected: {
    outputType: "ProjectSummary",
    deterministicAssertions: [
      "Top-level required fields exist",
      "No prohibited placeholders",
    ],
  },
};
