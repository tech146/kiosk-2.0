
import React, { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Tenant = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  rawValues: string[];
};

type TenantLookupStatus = "loading" | "ready" | "empty" | "error";

/* -------------------------------------------------------------------------- */
/* ✅ CSV PATH FIX                                                            */
/* -------------------------------------------------------------------------- */

const TENANT_CSV_PATHS = ["/tenants.csv"] as const;

/* -------------------------------------------------------------------------- */
/* CSV HELPERS                                                                */
/* -------------------------------------------------------------------------- */

function parseCsvRows(text: string) {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const rows = clean.split("\n").map((r) => r.split(","));
  return rows;
}

function parseTenantsCsv(text: string): Tenant[] {
  const rows = parseCsvRows(text);
  const [headers = [], ...dataRows] = rows;

  console.log("CSV Headers:", headers);
  console.log("CSV Data Rows:", dataRows.length);

  return dataRows.map((row) => ({
    businessName: row[0] || "",
    contactName: row[1] || "",
    email: row[2] || "",
    phone: row[3] || "",
    rawValues: row,
  }));
}

/* -------------------------------------------------------------------------- */
/* MAIN APP                                                                   */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantLookupStatus, setTenantLookupStatus] = useState<TenantLookupStatus>("loading");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Tenant[]>([]);

  /* ---------------------------------------------------------------------- */
  /* ✅ LOAD TENANTS (FIXED)                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadTenants() {
      setTenantLookupStatus("loading");

      for (const path of TENANT_CSV_PATHS) {
        try {
          console.log("📄 Attempting to fetch CSV from:", path);

          const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });

          console.log("Response status:", response.status);

          if (!response.ok) continue;

          const text = await response.text();

          // ✅ CRITICAL FIX: block HTML
          if (text.trim().toLowerCase().startsWith("<!doctype html")) {
            console.error("❌ HTML returned instead of CSV:", path);
            continue;
          }

          const parsed = parseTenantsCsv(text);

          if (!cancelled) {
            setTenants(parsed);
            setTenantLookupStatus(parsed.length ? "ready" : "empty");
          }

          console.log(`✅ Parsed ${parsed.length} tenants`);
          return;
        } catch (err) {
          console.error("Error loading CSV:", err);
        }
      }

      if (!cancelled) {
        setTenantLookupStatus("error");
        setTenants([]);
      }
    }

    loadTenants();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* ✅ SEARCH                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (search.length < 3) {
      setResults([]);
      return;
    }

    const q = search.toLowerCase();

    const matches = tenants.filter((t) =>
      [t.businessName, t.contactName, t.email, t.phone]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    setResults(matches.slice(0, 20));
  }, [search, tenants]);

  /* ---------------------------------------------------------------------- */
  /* ✅ UI (Simplified for clarity)                                         */
  /* ---------------------------------------------------------------------- */

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Tenant Lookup</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type tenant name..."
        style={{ width: 300, padding: 10 }}
      />

      <div style={{ marginTop: 20 }}>
        {tenantLookupStatus === "loading" && <p>Loading tenants...</p>}
        {tenantLookupStatus === "empty" && <p>No tenants found in CSV.</p>}
        {tenantLookupStatus === "error" && (
          <p style={{ color: "red" }}>
            Tenant CSV not found. Put <strong>tenants.csv</strong> in the public folder.
          </p>
        )}
      </div>

      <ul>
        {results.map((t, i) => (
          <li key={i}>
            <strong>{t.businessName}</strong> — {t.contactName} — {t.email} — {t.phone}
          </li>
        ))}
      </ul>
    </div>
  );
}
