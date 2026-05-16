(function () {
  "use strict";

  const tokenInput = document.querySelector("#tokenInput");
  const loadButton = document.querySelector("#loadButton");
  const exportLink = document.querySelector("#exportLink");
  const tableWrap = document.querySelector("#leadTableWrap");
  const statsRow = document.querySelector("#statsRow");
  const statTotal = document.querySelector("#statTotal");
  const statDrink = document.querySelector("#statDrink");
  const statGummy = document.querySelector("#statGummy");
  const statSample = document.querySelector("#statSample");

  const TOKEN_KEY = "dsl_admin_token";
  tokenInput.value = localStorage.getItem(TOKEN_KEY) || "";
  updateExportLink();

  tokenInput.addEventListener("input", () => {
    localStorage.setItem(TOKEN_KEY, tokenInput.value);
    updateExportLink();
  });

  tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadLeads();
  });

  loadButton.addEventListener("click", loadLeads);

  async function loadLeads() {
    tableWrap.innerHTML = '<div class="empty-state"><strong>Loading…</strong></div>';
    statsRow.hidden = true;

    try {
      const response = await fetch(withToken("/api/leads"));
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        tableWrap.innerHTML = `
          <div class="empty-state">
            <strong>Could not load leads</strong>
            ${response.status === 401 ? "Token missing or incorrect. Paste the ADMIN_TOKEN you set as an env variable." : "Server responded with " + response.status}
          </div>`;
        return;
      }

      renderTable(result.leads || []);
      renderStats(result.leads || []);
    } catch (err) {
      tableWrap.innerHTML = `
        <div class="empty-state">
          <strong>Could not reach the server</strong>
          Check that node server.mjs is running.
        </div>`;
    }
  }

  function renderStats(leads) {
    if (!leads.length) {
      statsRow.hidden = true;
      return;
    }
    statsRow.hidden = false;
    statTotal.textContent = leads.length;
    statDrink.textContent = leads.filter((l) => /drink|mix/i.test(l.preferredFormat)).length;
    statGummy.textContent = leads.filter((l) => /gummy/i.test(l.preferredFormat)).length;
    statSample.textContent = leads.filter((l) => /sample|free/i.test(l.sampleInterest || "")).length;
  }

  function renderTable(leads) {
    if (leads.length === 0) {
      tableWrap.innerHTML = `
        <div class="empty-state">
          <strong>No leads captured yet</strong>
          Take the survey from the landing page — submissions show here.
        </div>`;
      return;
    }

    const rows = leads
      .map(
        (lead) => `
          <tr>
            <td>${escapeHtml(formatDate(lead.createdAt))}</td>
            <td>${escapeHtml(lead.firstName) || "<span style=\"color:#999\">—</span>"}</td>
            <td>${escapeHtml(lead.email)}</td>
            <td>${escapeHtml(lead.whatsapp) || "<span style=\"color:#999\">—</span>"}</td>
            <td>${escapeHtml(lead.activityType)}</td>
            <td>${escapeHtml(lead.preferredFormat)}</td>
            <td>${escapeHtml(lead.mvpInterest)}</td>
            <td>${escapeHtml(lead.sampleInterest)}</td>
            <td>${escapeHtml(lead.priceRange)}</td>
            <td>${escapeHtml((lead.concerns || []).join(", "))}</td>
            <td>${escapeHtml(lead.notes)}</td>
            <td>${lead.consent ? '<span class="badge yes">yes</span>' : '<span class="badge no">no</span>'}</td>
            <td><span class="lang-badge">${escapeHtml(lead.language || "en")}</span></td>
            <td>${escapeHtml(lead.source || "")}</td>
          </tr>
        `,
      )
      .join("");

    tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Email</th>
            <th>WhatsApp</th>
            <th>Activity</th>
            <th>Format</th>
            <th>MVP</th>
            <th>Sample</th>
            <th>Price</th>
            <th>Concerns</th>
            <th>Notes</th>
            <th>Consent</th>
            <th>Lang</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function updateExportLink() {
    exportLink.href = withToken("/api/leads.csv");
  }

  function withToken(path) {
    const token = tokenInput.value.trim();
    if (!token) return path;
    return `${path}?token=${encodeURIComponent(token)}`;
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
