# Bizware SAP Integration - Complete Data Flow Document

## 1. Business Overview

Bizware's Power BI dashboards display financial data from 4 SAP reports:

| Report | Business Purpose | Example Data |
|--------|-----------------|--------------|
| **Accounts Payable** | Tracks what the company owes to vendors | Invoice amounts, vendor names, posting dates |
| **Bank Report** | Shows GL account balances | Account numbers, balances |
| **Budget Report** | Tracks monthly budget allocations | Budget amounts by income group and month |
| **Sales Register** | Records all sales invoices | Invoice numbers, billing types, customer names, totals |

**The system has two ways to get this data into the dashboards:**

1. **CSV Upload (Manual)** - User uploads a CSV file through the web UI
2. **SAP Sync (Automated)** - Backend directly calls SAP's API every hour and pulls fresh data

Both paths end at the same PostgreSQL database, which Power BI reads from.

---

## 2. High-Level Architecture

```
                     PATH 1: CSV Upload (Manual)
    ┌──────────┐     ┌──────────┐     ┌─────┐     ┌────────────┐
    │ Frontend  │────>│ Express  │────>│ n8n │────>│ PostgreSQL │
    │ (React)  │     │ Backend  │     │     │     │            │
    └──────────┘     └──────────┘     └─────┘     └─────┬──────┘
                                                        │
                     PATH 2: SAP Sync (Automated)       │
                     ┌──────────┐                       │     ┌──────────┐
                     │   SAP    │                       │────>│ Power BI │
                     │  System  │                       │     │Dashboard │
                     └────┬─────┘                       │     └──────────┘
                          │ OData API                   │
                     ┌────▼─────┐                       │
                     │ Express  │───────────────────────┘
                     │ Backend  │  (direct DB write)
                     └──────────┘
```

---

## 3. SAP OData API - What It Is

SAP exposes data through **OData v2** (Open Data Protocol). Think of it as SAP's REST API that returns data in XML format instead of JSON.

**SAP Service URL:**
```
https://10.10.3.28:44300/sap/opu/odata/sap/ZBANKFILES_TOPWRBI_SRV
```

This single service exposes 4 **Entity Sets** (similar to database tables):

| Entity Set Name | Maps To Report | Approx Rows |
|----------------|----------------|-------------|
| `ZENTITY_ACCPAYABLESet` | Accounts Payable | ~1,500 |
| `ZENTITY_BankSet` | Bank Report | ~9 |
| `ZENTITY_AL11Set` | Budget Report | ~73 |
| `ZENTITY_SALESREGSet` | Sales Register | Variable |

**Authentication:** HTTP Basic Auth (username + password).

**SSL:** Self-signed certificate (the system is configured to accept it).

---

## 4. SAP XML Response Format

When the backend calls `GET /ZENTITY_ACCPAYABLESet`, SAP returns an Atom XML feed. Here's a simplified example:

```xml
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">
  <entry>
    <content type="application/xml">
      <m:properties>
        <d:Zcompcode>1000</d:Zcompcode>
        <d:ZdocNo>2500000571</d:ZdocNo>
        <d:Zyear>2023</d:Zyear>
        <d:ZpostDt>20230221</d:ZpostDt>
        <d:Zvendor>0000100032</d:Zvendor>
        <d:ZlclAmt>-3764.00</d:ZlclAmt>
        <d:Zcurr>INR</d:Zcurr>
        ...
      </m:properties>
    </content>
  </entry>
  <entry>
    ...more rows...
  </entry>
</feed>
```

**Key points:**
- Each `<entry>` = one data row
- Field names have the `d:` namespace prefix (e.g., `d:Zcompcode`)
- All values are text strings (numbers, dates — everything is text in XML)

---

## 5. How SAP Fields Map to Database Columns

The file `backend/src/services/sapFieldMappings.js` defines every field mapping. No "entity" classes are created — it's a pure configuration object.

### Accounts Payable Mapping

| SAP XML Field | Database Column | Data Type | Example Conversion |
|--------------|----------------|-----------|-------------------|
| `Zcompcode` | `company_code` | text | `"1000"` → `"1000"` |
| `ZdocNo` | `document_number` | text | `"2500000571"` → `"2500000571"` |
| `Zyear` | `fiscal_year` | integer | `"2023"` → `2023` |
| `ZpostDt` | `posting_date` | date | `"20230221"` → `"2023-02-21"` |
| `Zvendor` | `vendor` | text | `"0000100032"` → `"0000100032"` |
| `Zmsme` | `msme` | text | As-is |
| `ZpurchDoc` | `purchasing_document` | text | As-is |
| `ZpurchDocitm` | `item` | text | As-is |
| `ZpoDoctyp` | `po_document_type` | text | As-is |
| `ZintOrdr` | `internal_order` | text | As-is |
| `ZdebCrdt` | `debit_credit` | text | As-is |
| `ZlclAmt` | `local_amount` | numeric | `"-3764.00"` → `-3764.00` |
| `Zcurr` | `currency` | text | As-is |

### Bank Report Mapping

| SAP XML Field | Database Column | Data Type |
|--------------|----------------|-----------|
| `Zgl` | `gl_account` | text |
| `ZshrtTxt` | `short_text` | text |
| `ZlongTxt` | `long_text` | text |
| `Zbalance` | `balance` | numeric |

### Budget Report Mapping

| SAP XML Field | Database Column | Data Type |
|--------------|----------------|-----------|
| `Zyear` | `year` | integer |
| `Zgroup` | `group_name` | text |
| `ZincmGrp` | `income_group` | text |
| `Zmonth` | `zmonth` | text |
| `Zbudget` | `budget_cr` | numeric |

### Sales Register Mapping

| SAP XML Field | Database Column | Data Type | Example Conversion |
|--------------|----------------|-----------|-------------------|
| `ZinvNo` | `invoice_no` | text | As-is |
| `ZbillingTyp` | `billing_type` | text | As-is |
| `ZbilltypDesc` | `billing_type_description` | text | As-is |
| `ZinvDate` | `invoice_date` | date | `"17.10.2022"` → `"2022-10-17"` |
| `ZbillTo` | `bill_to` | text | As-is |
| `ZbillyoNm` | `bill_to_name` | text | As-is |
| `Zyear` | `fiscal_year` | integer | `"2022"` → `2022` |
| `Ztotal` | `total` | numeric | `"45231.50"` → `45231.50` |

---

## 6. Data Type Conversions

The sync service applies 4 type conversions when transforming SAP text values into proper database types:

| Type | SAP Format | Database Format | Example |
|------|-----------|----------------|---------|
| `text` | Any string | Stored as-is | `"1000"` → `"1000"` |
| `integer` | Number string | Parsed to int | `"2023"` → `2023` |
| `numeric` | Decimal string | Parsed to float | `"-3764.00"` → `-3764.00` |
| `date_yyyymmdd` | `YYYYMMDD` | `YYYY-MM-DD` | `"20230221"` → `"2023-02-21"` |
| `date_ddmmyyyy` | `DD.MM.YYYY` | `YYYY-MM-DD` | `"17.10.2022"` → `"2022-10-17"` |

---

## 7. Complete SAP Sync Data Flow (Step by Step)

### Step 1: Trigger

The sync starts in one of two ways:

- **Manual:** User clicks "Sync Now" on the frontend UI → `POST /api/sap/sync`
- **Automatic:** Cron scheduler fires every hour (`0 * * * *`) → calls `syncAll('scheduler')` internally

### Step 2: Backend Receives Request

File: `backend/src/routes/sap.js`

```
POST /api/sap/sync
Body (optional): { "reportType": "accounts_payable" }
```

- If `reportType` is provided → syncs only that one report
- If no body → syncs all 4 reports sequentially

### Step 3: Fetch XML from SAP (or Mock Files)

File: `backend/src/services/sapOdataClient.js`

**Real Mode** (`SAP_MOCK_MODE=false`):
```
GET https://10.10.3.28:44300/sap/opu/odata/sap/ZBANKFILES_TOPWRBI_SRV/ZENTITY_ACCPAYABLESet
Headers: Accept: application/atom+xml
Auth: Basic (SAP_USERNAME:SAP_PASSWORD)
```

**Mock Mode** (`SAP_MOCK_MODE=true`):
- Reads from local XML files in `sampleXML/` folder
- Same parsing logic — identical code path after file read
- File mapping:
  - `ZENTITY_ACCPAYABLESet` → `sampleXML/Accounts_payable.xml`
  - `ZENTITY_BankSet` → `sampleXML/BankRecords.xml`
  - `ZENTITY_AL11Set` → `sampleXML/AL11Set.xml`
  - `ZENTITY_SALESREGSet` → `sampleXML/SalesRegister.xml`

### Step 4: Parse XML

The `fast-xml-parser` library converts the XML into JavaScript objects:

```
XML:  <d:Zcompcode>1000</d:Zcompcode>
      ↓
JS:   { Zcompcode: "1000" }     (namespace prefix "d:" is stripped)
```

The parser extracts `feed.entry[].content.properties` from each entry, producing an array of flat objects.

### Step 5: Transform (SAP Fields → DB Columns)

File: `backend/src/services/sapSyncService.js` → `transformEntry()`

For each SAP entry, the field mappings from Step 5 are applied:

```
Input (SAP):   { Zcompcode: "1000", ZpostDt: "20230221", ZlclAmt: "-3764.00" }
                    ↓ mapping + type conversion
Output (DB):   { company_code: "1000", posting_date: "2023-02-21", local_amount: -3764.00 }
```

### Step 6: Compute Row Hash (Delta Detection)

File: `backend/src/services/sapSyncService.js` → `computeRowHash()`

All column values are joined with `|` and hashed with SHA-256:

```
"1000|2500000571|2023|2023-02-21|0000100032|...|INR"
    ↓ SHA-256
"a3f8c2d1e5b7...64 char hex hash"
```

**Why?** SAP data doesn't have a "last modified" timestamp. The hash lets us detect if a row has actually changed since the last sync. If the hash matches, we skip the update — saving database writes.

### Step 7: UPSERT to Database

The system calls a PostgreSQL stored function for each row:

```sql
SELECT raw.upsert_accounts_payable(
    '1000',           -- company_code
    '2500000571',     -- document_number
    2023,             -- fiscal_year
    '2023-02-21',     -- posting_date
    '0000100032',     -- vendor
    ...
    'a3f8c2d1e5b7...' -- row_hash
) AS action;
```

The function does three things:
1. **INSERT** if the row doesn't exist → returns `'inserted'`
2. **UPDATE** if the row exists AND the hash changed → returns `'updated'`
3. **SKIP** if the row exists AND the hash matches → returns `'unchanged'`

**Important:** The same function also mirrors the data from the `raw` schema to the `curated` schema automatically.

### Step 8: Write Audit Record

After processing all rows for a report type, the audit table is updated:

```sql
UPDATE audit.upload_audit SET
    rows_total = 1500,
    rows_inserted = 45,
    rows_updated = 3,
    rows_unchanged = 1452,
    upload_status = 'success',
    duration_ms = 12340
WHERE id = {audit_id};
```

The `uploaded_by` field is set to:
- `'sap_sync_manual'` — if triggered by the user's "Sync Now" button
- `'sap_sync_scheduler'` — if triggered by the hourly cron job

### Step 9: Frontend Updates

After sync completes:
- The Status Panel auto-refreshes every 30 seconds showing the latest row counts
- The "Source" column shows either "SAP Sync" or "CSV Upload" badge
- The SAP Sync Panel shows last sync time and results (X new, Y updated per report)

### Step 10: Power BI Reads Data

Power BI Desktop connects to PostgreSQL and reads from **curated views**:
- `curated.v_accounts_payable`
- `curated.v_bank_report`
- `curated.v_budget_report`
- `curated.v_sales_register`

These views expose the data with original CSV-friendly column names (e.g., `"Company Code"`, `"Local Amount"`).

---

## 8. Database Schema Design

```
PostgreSQL: bizware_dashboards
├── raw schema (landing zone)
│   ├── raw_accounts_payable    ← SAP sync writes here
│   ├── raw_bank_report         ← SAP sync writes here
│   ├── raw_budget_report       ← SAP sync writes here
│   └── raw_sales_register      ← SAP sync writes here
│
├── curated schema (clean data for Power BI)
│   ├── accounts_payable        ← auto-mirrored by upsert functions
│   ├── bank_report             ← auto-mirrored by upsert functions
│   ├── budget_report           ← auto-mirrored by upsert functions
│   ├── sales_register          ← auto-mirrored by upsert functions
│   ├── v_accounts_payable      ← VIEW (Power BI reads this)
│   ├── v_bank_report           ← VIEW (Power BI reads this)
│   ├── v_budget_report         ← VIEW (Power BI reads this)
│   └── v_sales_register        ← VIEW (Power BI reads this)
│
└── audit schema (tracking)
    ├── upload_audit             ← every sync/upload is logged
    └── error_log                ← failures are logged
```

**Why two schemas (raw + curated)?**
- `raw` = exact data as received, with technical columns (row_hash, timestamps)
- `curated` = clean data for reporting, with views that rename columns to business-friendly names
- Power BI only connects to `curated` views — never touches raw data

---

## 9. File-by-File Summary

### Backend Files

| File | Role |
|------|------|
| `backend/src/services/sapFieldMappings.js` | Configuration: maps every SAP XML field name to its database column name and data type |
| `backend/src/services/sapOdataClient.js` | HTTP client: calls SAP OData API (or reads mock XML files), parses XML, returns JS objects |
| `backend/src/services/sapSyncService.js` | Orchestrator: transforms data, computes hashes, calls database upsert functions, writes audit records |
| `backend/src/services/sapScheduler.js` | Scheduler: runs sync every hour using cron, configurable via `SAP_SYNC_CRON` |
| `backend/src/routes/sap.js` | API endpoints: `POST /api/sap/sync` (trigger) and `GET /api/sap/status` (check progress) |
| `backend/src/config/index.js` | Configuration: reads SAP-related environment variables |
| `backend/src/index.js` | App entry: mounts SAP routes, starts scheduler on server boot |
| `backend/src/services/dbService.js` | Database pool + status query (includes `uploaded_by` to distinguish SAP vs CSV) |
| `backend/src/routes/status.js` | Status endpoint: returns report status with source badge (SAP Sync / CSV Upload) |

### Frontend Files

| File | Role |
|------|------|
| `frontend/src/components/SapSyncPanel.js` | UI: "SAP Data Sync" card with Sync Now button, mock mode indicator, sync results |
| `frontend/src/services/api.js` | API client: `triggerSapSync()` and `fetchSapStatus()` functions |
| `frontend/src/App.js` | Layout: renders SapSyncPanel between Upload and Status panels |
| `frontend/src/components/StatusPanel.js` | UI: report status table with Source column |

### Infrastructure Files

| File | Role |
|------|------|
| `docker-compose.local.yml` | Local dev: SAP env vars, mock mode ON, sampleXML volume mounted |
| `docker-compose.yml` | Production: SAP env vars from host .env, mock mode OFF |
| `database/init.sql` | Schema: tables, upsert functions, views, audit tables, indexes |
| `backend/.env.example` | Template: documents all SAP environment variables |

---

## 10. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SAP_ODATA_BASE_URL` | `https://10.10.3.28:44300/sap/opu/odata/sap/ZBANKFILES_TOPWRBI_SRV` | SAP OData service root URL |
| `SAP_USERNAME` | (empty) | SAP Basic Auth username |
| `SAP_PASSWORD` | (empty) | SAP Basic Auth password |
| `SAP_MOCK_MODE` | `false` | `true` = read local XML files instead of calling SAP |
| `SAP_SYNC_CRON` | `0 * * * *` | Cron expression (default: every hour at minute 0) |
| `SAP_SYNC_ENABLED` | `true` | `false` = disable the auto-sync scheduler entirely |
| `SAP_REQUEST_TIMEOUT` | `120000` | HTTP timeout in ms for SAP API calls (2 minutes) |

---

## 11. Mock Mode vs Real Mode

| Aspect | Mock Mode | Real Mode |
|--------|-----------|-----------|
| Data source | Local `sampleXML/*.xml` files | Live SAP OData API over HTTPS |
| When to use | Local development, testing | Production, UAT |
| Env variable | `SAP_MOCK_MODE=true` | `SAP_MOCK_MODE=false` |
| Credentials needed | No | Yes (`SAP_USERNAME` + `SAP_PASSWORD`) |
| Data freshness | Static (same sample data) | Live from SAP |

Everything after the XML fetch is identical — same parser, same transformer, same database writes.

---

## 12. How to Test

1. Start the stack: `docker compose -f docker-compose.local.yml up --build`
2. Open `http://localhost:3000` in browser
3. Click **"Sync Now"** in the SAP Data Sync panel (mock mode auto-enabled locally)
4. Watch the Status Panel update with row counts and "SAP Sync" source badge
5. Verify in database: `SELECT COUNT(*) FROM curated.accounts_payable;`
6. Run sync again — second run should show 0 inserts, 0 updates (delta detection working)
