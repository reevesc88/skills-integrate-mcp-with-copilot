const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(
  path.join(__dirname, "..", "src", "static", "app.js"),
  "utf8"
);

const sandbox = {
  document: {
    addEventListener() {},
    getElementById() {
      return null;
    },
  },
  console,
  fetch: async () => {
    throw new Error("fetch should not run while loading filter helpers");
  },
  setTimeout,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const filterAndSortActivities = sandbox.filterAndSortActivities;
assert.strictEqual(typeof filterAndSortActivities, "function");

const entries = [
  [
    "Chess Club",
    {
      description: "Learn strategies and compete in chess tournaments",
      schedule: "Fridays, 3:30 PM - 5:00 PM",
      date: "2025-01-10T15:30:00",
      category: "Academic",
    },
  ],
  [
    "Gym Class",
    {
      description: "Physical education and sports activities",
      schedule: "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
      date: "2025-01-06T14:00:00",
      category: "Sports",
    },
  ],
  [
    "Math Club",
    {
      description: "Solve challenging problems and participate in math competitions",
      schedule: "Tuesdays, 3:30 PM - 4:30 PM",
      date: "2025-01-07T15:30:00",
      category: "Academic",
    },
  ],
  [
    "Programming Class",
    {
      description: "Learn programming fundamentals and build software projects",
      schedule: "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
      date: "2025-01-07T15:30:00",
      category: "Academic",
    },
  ],
];

function names(options) {
  return filterAndSortActivities(entries, options).map(([name]) => name);
}

assert.deepStrictEqual(names({ query: "", category: "", sort: "name" }), [
  "Chess Club",
  "Gym Class",
  "Math Club",
  "Programming Class",
]);

assert.deepStrictEqual(names({ query: "", category: "", sort: "time" }), [
  "Gym Class",
  "Math Club",
  "Programming Class",
  "Chess Club",
]);

assert.deepStrictEqual(
  names({ query: "tournament", category: "", sort: "name" }),
  ["Chess Club"]
);

assert.deepStrictEqual(names({ query: "  TUESDAY ", category: "", sort: "name" }), [
  "Math Club",
  "Programming Class",
]);

assert.deepStrictEqual(names({ query: "sports", category: "", sort: "name" }), [
  "Gym Class",
]);

assert.deepStrictEqual(
  names({ query: "club", category: "Academic", sort: "time" }),
  ["Math Club", "Chess Club"]
);

assert.deepStrictEqual(names({ query: "chess", category: "Sports", sort: "name" }), []);

console.log("activity filter tests passed");
