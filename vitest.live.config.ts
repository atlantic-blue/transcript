import { defineConfig } from "vitest/config";

// The live suite talks to the real platform, so it is not part of the gates. It is the check that
// the whole path still works, and it is run by hand.
export default defineConfig({
  test: { include: ["src/**/*.livetest.ts"], environment: "node", passWithNoTests: false },
});
