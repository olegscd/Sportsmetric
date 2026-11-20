import assert from "node:assert/strict";
import { test } from "node:test";
import { mapWithConcurrency } from "@/lib/game-sync/sources";

test("mapWithConcurrency keeps input order and never exceeds the limit", async () => {
  let inFlight = 0;
  let peak = 0;
  const delays = [30, 5, 20, 1, 15, 10, 2];
  const results = await mapWithConcurrency(delays, 3, async (ms, index) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, ms));
    inFlight--;
    return index * 10;
  });
  assert.deepEqual(results, [0, 10, 20, 30, 40, 50, 60]);
  assert.equal(peak, 3);
});

test("mapWithConcurrency handles empty input and limits above the item count", async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
  assert.deepEqual(await mapWithConcurrency(["a", "b"], 10, async s => s.toUpperCase()), ["A", "B"]);
});
