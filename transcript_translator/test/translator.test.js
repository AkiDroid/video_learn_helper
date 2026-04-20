const test = require("node:test");
const assert = require("node:assert/strict");

const { mapWithConcurrency } = require("../src/translator");

test("mapWithConcurrency limits active workers and preserves item order", async () => {
  const items = [1, 2, 3, 4, 5];
  let activeCount = 0;
  let maxActiveCount = 0;

  const results = await mapWithConcurrency(items, 2, async (item) => {
    activeCount += 1;
    maxActiveCount = Math.max(maxActiveCount, activeCount);

    await new Promise((resolve) => setTimeout(resolve, 10));

    activeCount -= 1;
    return item * 10;
  });

  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(maxActiveCount, 2);
});
