import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Two tiers in one run: the unit and integration tests beside the code, and the scenarios in
    // features, which drive a reader request all the way to the page that comes back.
    include: ["src/**/*.test.ts", "features/**/*.feature.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
