import { expect, it } from "vitest";

// A scenario reads as one sentence per step. When a step fails, the report names the step and the
// whole scenario, so a failure says what the reader was supposed to get rather than a line number.

export interface World {
  answer: { statusCode: number; headers: Record<string, string>; body: string } | null;
  log: Record<string, unknown>[];
}

type Step = (world: World) => Promise<void> | void;

export interface Steps {
  given(text: string, step: Step): void;
  when(text: string, step: Step): void;
  then(text: string, step: Step): void;
  and(text: string, step: Step): void;
}

export function scenario(title: string, build: (steps: Steps) => void): void {
  const steps: { word: string; text: string; step: Step }[] = [];
  const add = (word: string) => (text: string, step: Step) => {
    steps.push({ word, text, step });
  };

  build({ given: add("Given"), when: add("When"), then: add("Then"), and: add("And") });

  if (steps.length === 0) throw new Error(`the scenario "${title}" declares no step`);

  it(title, async () => {
    const world: World = { answer: null, log: [] };
    for (const { word, text, step } of steps) {
      try {
        await step(world);
      } catch (failure) {
        const why = failure instanceof Error ? failure.message : String(failure);
        expect.fail(`${word} ${text}\n\n${why}`);
      }
    }
  });
}

export function theAnswer(world: World): { statusCode: number; headers: Record<string, string>; body: string } {
  if (world.answer === null) throw new Error("no page was asked for yet");
  return world.answer;
}
