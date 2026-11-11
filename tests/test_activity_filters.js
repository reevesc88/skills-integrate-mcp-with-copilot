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

assert.strictEqual(sandbox.escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
assert.strictEqual(sandbox.escapeHtml("Chess Club"), "Chess Club");

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createHarness(fetchImpl) {
  const elements = {};

  function makeElement(id) {
    const el = {
      id,
      value: "",
      className: "",
      textContent: "",
      children: [],
      listeners: {},
      dataset: {},
      reset() {},
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      addEventListener(type, fn) {
        (this.listeners[type] ||= []).push(fn);
      },
    };
    let html = "";
    Object.defineProperty(el, "innerHTML", {
      get() {
        return html;
      },
      set(value) {
        html = String(value);
        el.children = [];
      },
    });
    el.classList = {
      add(className) {
        el.classes.add(className);
      },
      remove(className) {
        el.classes.delete(className);
      },
      contains(className) {
        return el.classes.has(className);
      },
    };
    el.classes = new Set();
    return el;
  }

  for (const id of [
    "activities-list",
    "activities-count",
    "activity",
    "signup-form",
    "message",
    "activity-search",
    "category-filter",
    "sort-by",
    "email",
  ]) {
    elements[id] = makeElement(id);
  }

  const doc = {
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return makeElement(null);
    },
    querySelectorAll() {
      return [];
    },
  };

  const timers = new Map();
  let nextTimerId = 1;
  let clock = 0;
  const uiSandbox = {
    document: doc,
    console,
    fetch: fetchImpl,
    setTimeout(fn, ms) {
      const id = nextTimerId++;
      timers.set(id, { fn, at: clock + ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  vm.createContext(uiSandbox);
  vm.runInContext(code, uiSandbox);
  doc.listeners.DOMContentLoaded.forEach((fn) => fn());

  return {
    elements,
    advance(ms) {
      clock += ms;
      while (true) {
        let next = null;
        for (const [id, timer] of timers) {
          if (timer.at <= clock && (!next || timer.at < next.at)) {
            next = { id, timer };
          }
        }
        if (!next) {
          break;
        }
        timers.delete(next.id);
        next.timer.fn();
      }
    },
  };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

const chessClub = {
  description: "Learn strategies and compete in chess tournaments",
  schedule: "Fridays, 3:30 PM - 5:00 PM",
  date: "2025-01-10T15:30:00",
  category: "Academic",
  max_participants: 12,
  participants: ["michael@mergington.edu"],
};

async function testMessageTimer() {
  let signupCount = 0;
  const harness = createHarness(async (url) => {
    if (String(url).includes("/signup")) {
      signupCount += 1;
      return jsonResponse({ message: `message ${signupCount}` });
    }
    return jsonResponse({ "Chess Club": chessClub });
  });

  await settle();
  harness.elements.email.value = "student@mergington.edu";
  harness.elements.activity.value = "Chess Club";

  const submit = harness.elements["signup-form"].listeners.submit[0];
  const event = { preventDefault() {} };
  await submit(event);
  assert.strictEqual(harness.elements.message.textContent, "message 1");
  assert.strictEqual(harness.elements.message.classList.contains("hidden"), false);

  harness.advance(1000);
  await submit(event);
  await settle();
  assert.strictEqual(harness.elements.message.textContent, "message 2");

  harness.advance(4000);
  assert.strictEqual(harness.elements.message.classList.contains("hidden"), false);
  assert.strictEqual(harness.elements.message.textContent, "message 2");

  harness.advance(1000);
  assert.strictEqual(harness.elements.message.classList.contains("hidden"), true);
}

async function testActivityMarkupIsEscaped() {
  const malicious = {
    "<img src=x onerror=alert(1)>": {
      description: '<script>alert("desc")</script>',
      schedule: '"><img src=x onerror=alert(1)>',
      date: "2025-01-10T15:30:00",
      category: "<b>Arts</b>",
      max_participants: 5,
      participants: [
        "<script>alert(1)</script>@x.edu",
        'a" onmouseover="alert(1)',
      ],
    },
  };
  const harness = createHarness(async () => jsonResponse(malicious));
  await settle();

  const card = harness.elements["activities-list"].children[0];
  assert.ok(card, "activity card should render");
  const html = card.innerHTML;
  assert.ok(html.includes('<button class="delete-btn"'));
  assert.ok(html.includes('<span class="participant-email">'));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;@x.edu"));
  assert.ok(html.includes("a&quot; onmouseover=&quot;alert(1)"));
  assert.ok(html.includes("&lt;b&gt;Arts&lt;/b&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("<b>"), false);
  assert.equal(html.includes('onmouseover="alert(1)"'), false);
}

async function testFailedActivitiesResponseKeepsPreviousState() {
  let activityCalls = 0;
  const harness = createHarness(async (url) => {
    if (String(url).includes("/signup")) {
      return jsonResponse({ message: "signed up" });
    }
    activityCalls += 1;
    if (activityCalls === 1) {
      return jsonResponse({ "Chess Club": chessClub });
    }
    return jsonResponse({ detail: "nope" }, 500);
  });

  await settle();
  assert.ok(
    harness.elements["activities-list"].children[0].innerHTML.includes("Chess Club")
  );

  harness.elements.email.value = "student@mergington.edu";
  harness.elements.activity.value = "Chess Club";
  await harness.elements["signup-form"].listeners.submit[0]({
    preventDefault() {},
  });
  await settle();

  assert.strictEqual(
    harness.elements["activities-list"].innerHTML,
    "<p>Failed to load activities. Please try again later.</p>"
  );

  harness.elements["activity-search"].listeners.input.forEach((fn) => fn());
  const card = harness.elements["activities-list"].children[0];
  assert.ok(card.innerHTML.includes("Chess Club"));
  assert.ok(card.innerHTML.includes("michael@mergington.edu"));
}

Promise.all([
  testMessageTimer(),
  testActivityMarkupIsEscaped(),
  testFailedActivitiesResponseKeepsPreviousState(),
])
  .then(() => {
    console.log("activity filter tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
