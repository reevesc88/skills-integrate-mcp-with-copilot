// Filter and sort activity entries: [[name, details], ...]
// sort is "name" or "time". category "" means every category.
function filterAndSortActivities(entries, options) {
  const query = (options.query || "").trim().toLowerCase();
  const category = options.category || "";
  const sort = options.sort || "name";

  const filtered = entries.filter(([name, details]) => {
    if (category && details.category !== category) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [name, details.description, details.schedule, details.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  filtered.sort((a, b) => {
    if (sort === "time") {
      const byDate = (a[1].date || "").localeCompare(b[1].date || "");
      if (byDate !== 0) {
        return byDate;
      }
    }
    return a[0].localeCompare(b[0]);
  });

  return filtered;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitiesCount = document.getElementById("activities-count");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("activity-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortBy = document.getElementById("sort-by");

  let activities = {};
  let messageTimer;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function populateCategoryFilter() {
    const current = categoryFilter.value;
    const categories = [
      ...new Set(
        Object.values(activities)
          .map((details) => details.category)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    categoryFilter.innerHTML = '<option value="">All categories</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
    if (categories.includes(current)) {
      categoryFilter.value = current;
    }
  }

  function populateActivitySelect() {
    const current = activitySelect.value;
    activitySelect.innerHTML =
      '<option value="">-- Select an activity --</option>';
    Object.keys(activities)
      .sort((a, b) => a.localeCompare(b))
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    if (activities[current]) {
      activitySelect.value = current;
    }
  }

  function renderActivities() {
    const entries = filterAndSortActivities(Object.entries(activities), {
      query: searchInput.value,
      category: categoryFilter.value,
      sort: sortBy.value,
    });
    const total = Object.keys(activities).length;

    activitiesCount.textContent =
      total === 0
        ? ""
        : `Showing ${entries.length} of ${total} activities`;

    activitiesList.innerHTML = "";

    if (entries.length === 0) {
      activitiesList.innerHTML = "<p>No activities match your search.</p>";
      return;
    }

    entries.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";
      activityCard.dataset.category = details.category || "";
      activityCard.dataset.name = name;

      const spotsLeft = details.max_participants - details.participants.length;
      const safeName = escapeHtml(name);

      // Create participants HTML with delete icons instead of bullet points.
      // Escape field values only; this string is inserted as markup.
      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
            <h5>Participants:</h5>
            <ul class="participants-list">
              ${details.participants
                .map((email) => {
                  const safeEmail = escapeHtml(email);
                  return `<li><span class="participant-email">${safeEmail}</span><button class="delete-btn" data-activity="${safeName}" data-email="${safeEmail}">❌</button></li>`;
                })
                .join("")}
            </ul>
          </div>`
          : `<p><em>No participants yet</em></p>`;

      activityCard.innerHTML = `
        <h4>${safeName}</h4>
        <p class="activity-category">${escapeHtml(details.category || "")}</p>
        <p>${escapeHtml(details.description)}</p>
        <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      activities = await response.json();
      populateCategoryFilter();
      populateActivitySelect();
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      activitiesCount.textContent = "";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  searchInput.addEventListener("input", renderActivities);
  categoryFilter.addEventListener("change", renderActivities);
  sortBy.addEventListener("change", renderActivities);

  // Initialize app
  fetchActivities();
});
