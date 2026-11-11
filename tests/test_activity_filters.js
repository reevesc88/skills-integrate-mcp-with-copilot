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

function fireToolbar(harness) {
  harness.elements["activity-search"].listeners.input.forEach((fn) => fn());
  harness.elements["category-filter"].listeners.change.forEach((fn) => fn());
  harness.elements["sort-by"].listeners.change.forEach((fn) => fn());
}

function failureNotice(list) {
  return list.children.find(
    (child) =>
      (child.textContent || "").includes(
        "Failed to load activities. Please try again later."
      ) ||
      (child.innerHTML || "").includes(
        "Failed to load activities. Please try again later."
      )
  );
}

function activityCard(list) {
  return list.children.find((child) => child.className === "activity-card");
}

async function testInitialLoadFailureSurvivesToolbar() {
  const harness = createHarness(async () => jsonResponse({ detail: "nope" }, 500));
  await settle();

  assert.strictEqual(
    harness.elements["activities-list"].innerHTML,
    "<p>Failed to load activities. Please try again later.</p>"
  );
  assert.strictEqual(harness.elements["activities-count"].textContent, "");

  harness.elements["activity-search"].value = "chess";
  harness.elements["category-filter"].value = "Sports";
  harness.elements["sort-by"].value = "time";
  fireToolbar(harness);

  assert.strictEqual(
    harness.elements["activities-list"].innerHTML,
    "<p>Failed to load activities. Please try again later.</p>"
  );
  assert.ok(
    !harness.elements["activities-list"].innerHTML.includes(
      "No activities match your search."
    )
  );
}

async function testLoadingCopySurvivesToolbarUntilFetchSucceeds() {
  let resolveFetch;
  const pending = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const harness = createHarness(() => pending);

  assert.strictEqual(
    harness.elements["activities-list"].innerHTML,
    "<p>Loading activities...</p>"
  );

  harness.elements["activity-search"].value = "chess";
  fireToolbar(harness);
  assert.strictEqual(
    harness.elements["activities-list"].innerHTML,
    "<p>Loading activities...</p>"
  );
  assert.ok(
    !harness.elements["activities-list"].innerHTML.includes(
      "No activities match your search."
    )
  );

  resolveFetch(
    jsonResponse({
      "Chess Club": {
        ...chessClub,
        participants: chessClub.participants.slice(),
      },
    })
  );
  await settle();

  const card = activityCard(harness.elements["activities-list"]);
  assert.ok(card, "cards render after the fetch succeeds");
  assert.ok(card.innerHTML.includes("Chess Club"));
  assert.strictEqual(failureNotice(harness.elements["activities-list"]), undefined);
}

async function testFailedRefetchAfterSignupKeepsRosterAndError() {
  let activityCalls = 0;
  const harness = createHarness(async (url) => {
    if (String(url).includes("/signup")) {
      return jsonResponse({ message: "signed up" });
    }
    if (String(url).includes("/unregister")) {
      return jsonResponse({ message: "unregistered" });
    }
    activityCalls += 1;
    if (activityCalls === 1) {
      return jsonResponse({
        "Chess Club": {
          ...chessClub,
          participants: ["michael@mergington.edu"],
        },
      });
    }
    return jsonResponse({ detail: "nope" }, 500);
  });

  await settle();
  const initialCard = activityCard(harness.elements["activities-list"]);
  assert.ok(initialCard.innerHTML.includes("Chess Club"));
  assert.ok(!initialCard.innerHTML.includes("student@mergington.edu"));

  harness.elements.email.value = "student@mergington.edu";
  harness.elements.activity.value = "Chess Club";
  await harness.elements["signup-form"].listeners.submit[0]({
    preventDefault() {},
  });
  await settle();

  const list = harness.elements["activities-list"];
  const card = activityCard(list);
  assert.ok(card, "cached activity card should stay visible");
  assert.ok(card.innerHTML.includes("Chess Club"));
  assert.ok(card.innerHTML.includes("michael@mergington.edu"));
  assert.ok(card.innerHTML.includes("student@mergington.edu"));
  assert.ok(card.innerHTML.includes("10 spots left"));
  assert.ok(failureNotice(list), "failure indicator should stay visible with cached cards");
  assert.strictEqual(
    harness.elements["activities-count"].textContent,
    "Showing 1 of 1 activities"
  );

  harness.elements["activity-search"].value = "chess";
  fireToolbar(harness);

  const cardAfter = activityCard(list);
  assert.ok(cardAfter.innerHTML.includes("student@mergington.edu"));
  assert.ok(cardAfter.innerHTML.includes("michael@mergington.edu"));
  assert.ok(failureNotice(list), "toolbar should keep the failure indicator");
  assert.ok(
    !list.children.some((child) =>
      `${child.textContent || ""} ${child.innerHTML || ""}`.includes(
        "No activities match your search."
      )
    )
  );

  harness.elements["activity-search"].value = "not-a-real-activity";
  fireToolbar(harness);
  assert.ok(failureNotice(list), "filtered empty roster should keep the failure indicator");
  assert.strictEqual(activityCard(list), undefined);
  assert.ok(
    list.children.some((child) =>
      (child.textContent || "").includes("No activities match your search.")
    )
  );
}

function activityPayload(name, participants) {
  return jsonResponse({
    [name]: {
      ...chessClub,
      participants: participants.slice(),
    },
  });
}

function selectValues(select) {
  return select.children.map((child) => child.value);
}

async function signUp(harness, email) {
  harness.elements.email.value = email;
  harness.elements.activity.value = "Chess Club";
  await harness.elements["signup-form"].listeners.submit[0]({
    preventDefault() {},
  });
}

async function testEarlierFetchSettlingLastIsIgnored() {
  const pendingGets = [];
  const harness = createHarness(async (url) => {
    if (String(url).includes("/signup")) {
      return jsonResponse({ message: "signed up" });
    }
    let resolveGet;
    const promise = new Promise((resolve) => {
      resolveGet = resolve;
    });
    pendingGets.push(resolveGet);
    return promise;
  });

  pendingGets[0](activityPayload("Chess Club", ["michael@mergington.edu"]));
  await settle();

  await signUp(harness, "first@mergington.edu");
  await signUp(harness, "second@mergington.edu");
  assert.strictEqual(pendingGets.length, 3);

  pendingGets[2](
    activityPayload("Chess Club", [
      "michael@mergington.edu",
      "first@mergington.edu",
      "second@mergington.edu",
    ])
  );
  await settle();

  let list = harness.elements["activities-list"];
  let card = activityCard(list);
  assert.ok(card.innerHTML.includes("second@mergington.edu"));
  assert.strictEqual(failureNotice(list), undefined);
  assert.deepStrictEqual(selectValues(harness.elements.activity), ["Chess Club"]);

  // Earlier 200 settles last and must not replace the newer roster.
  pendingGets[1](activityPayload("Stale Club", ["stale-only@mergington.edu"]));
  await settle();

  list = harness.elements["activities-list"];
  card = activityCard(list);
  assert.ok(card.innerHTML.includes("Chess Club"));
  assert.ok(card.innerHTML.includes("second@mergington.edu"));
  assert.ok(!card.innerHTML.includes("Stale Club"));
  assert.ok(!card.innerHTML.includes("stale-only@mergington.edu"));
  assert.strictEqual(failureNotice(list), undefined);
  assert.deepStrictEqual(selectValues(harness.elements.activity), ["Chess Club"]);

  // Earlier failure settles last and must not restore the error after a newer 200.
  await signUp(harness, "third@mergington.edu");
  await signUp(harness, "fourth@mergington.edu");
  const newer = pendingGets.length - 1;
  const older = newer - 1;
  pendingGets[newer](
    activityPayload("Chess Club", [
      "michael@mergington.edu",
      "first@mergington.edu",
      "second@mergington.edu",
      "third@mergington.edu",
      "fourth@mergington.edu",
    ])
  );
  await settle();

  pendingGets[older](jsonResponse({ detail: "nope" }, 500));
  await settle();

  list = harness.elements["activities-list"];
  card = activityCard(list);
  assert.ok(card.innerHTML.includes("fourth@mergington.edu"));
  assert.strictEqual(failureNotice(list), undefined);
  assert.strictEqual(
    harness.elements["activities-count"].textContent,
    "Showing 1 of 1 activities"
  );
}

Promise.all([
  testMessageTimer(),
  testActivityMarkupIsEscaped(),
  testInitialLoadFailureSurvivesToolbar(),
  testLoadingCopySurvivesToolbarUntilFetchSucceeds(),
  testFailedRefetchAfterSignupKeepsRosterAndError(),
  testEarlierFetchSettlingLastIsIgnored(),
])
  .then(() => {
    console.log("activity filter tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
