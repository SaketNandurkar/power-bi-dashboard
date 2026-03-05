# Bizware Power BI Dashboards - Complete Deployment Guide

## 1. High-Level Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              NGINX (SSL/Proxy)              │
                    │            srv1368855.hstgr.cloud           │
                    └──────┬──────────┬──────────┬───────────────┘
                           │          │          │
              ┌────────────▼─┐  ┌─────▼────┐  ┌─▼──────────┐
              │  Frontend    │  │ Backend  │  │  n8n       │
              │  React SPA   │  │ Express  │  │  Workflows │
              │  :80         │  │ :3001    │  │  :5678     │
              └──────────────┘  └────┬─────┘  └──┬─────────┘
                                     │           │
                                     ▼           ▼
                              ┌─────────────────────┐
                              │    PostgreSQL 16     │
                              │   raw | curated |   │
                              │        audit        │
                              └─────────┬───────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │   Power BI Views    │
                              │  (curated.v_*)      │
                              └─────────────────────┘
```

## 2. Data Flow

```
User uploads CSV via Frontend
        │
        ▼
POST /api/upload (Backend validates file + report type)
        │
        ▼
Forward to n8n webhook (http://n8n:5678/webhook/upload-csv)
        │
        ▼
n8n Workflow:
  1. Parse CSV
  2. Normalize column names (CSV headers → snake_case)
  3. Handle special values (trailing minus, YYYYMMDD dates)
  4. Generate SHA256 row hash from all business columns
  5. Batch UPSERT into raw.* tables
  6. Mirror UPSERT into curated.* tables
  7. Write audit log to audit.upload_audit
        │
        ▼
Power BI reads from curated.v_* views (unchanged visuals)
```

## 3. Hash-Based Delta Strategy

Each CSV row is processed as follows:

| Step | Description |
|------|-------------|
| 1 | Map CSV columns to snake_case DB columns |
| 2 | Sort column names alphabetically |
| 3 | Concatenate all values with `\|` separator |
| 4 | Compute SHA256 hash of concatenated string |
| 5 | UPSERT with ON CONFLICT, only update when hash differs |

**Primary Keys per Report:**

| Report | Primary Key Columns |
|--------|-------------------|
| Accounts Payable | company_code, document_number, fiscal_year, item |
| Bank Report | gl_account |
| Budget Report | year, group_name, income_group, zmonth |
| Sales Register | invoice_no |

## 4. VPS Deployment Steps

### Prerequisites
- SSH access to srv1368855.hstgr.cloud
- Root or sudo access

### Step 1: Connect to VPS
```bash
ssh root@srv1368855.hstgr.cloud
```

### Step 2: Upload project files
```bash
scp -r ./power-bi-dashboards root@srv1368855.hstgr.cloud:/opt/bizware-dashboards
```

### Step 3: Configure environment
```bash
cd /opt/bizware-dashboards
cp .env.example .env
nano .env
# Set strong passwords for POSTGRES_PASSWORD and N8N_PASSWORD
```

### Step 4: Run deployment
```bash
chmod +x scripts/deploy.sh scripts/setup-ssl.sh
bash scripts/deploy.sh
```

### Step 5: Import n8n workflow
1. Open https://srv1368855.hstgr.cloud/n8n/
2. Login with N8N_USER/N8N_PASSWORD
3. Go to Workflows → Import from File
4. Import `n8n/workflows/csv-upload-workflow.json`
5. Configure PostgreSQL credentials in n8n:
   - Host: postgres
   - Port: 5432
   - Database: bizware_dashboards
   - User: bizware_user
   - Password: (from .env)
6. Activate the workflow

### Step 6: Verify
```bash
# Check all services running
docker compose ps

# Check API health
curl https://srv1368855.hstgr.cloud/api/health

# View logs
docker compose logs -f backend
```

## 5. Power BI Repointing Guide

### Step 1: Open Existing PBIX
Open `POWER BI PROJECT.pbix` in Power BI Desktop.

### Step 2: Check Current Data Sources
Go to Home → Transform Data → Data Source Settings.
Note the current CSV file paths.

### Step 3: Replace Data Source
For each table:
1. Go to Home → Transform Data
2. Select the query (e.g., "Accounts Payable")
3. In Advanced Editor, replace the CSV source with PostgreSQL:

```m
let
    Source = PostgreSQL.Database("srv1368855.hstgr.cloud:5432", "bizware_dashboards"),
    curated_v_accounts_payable = Source{[Schema="curated",Item="v_accounts_payable"]}[Data]
in
    curated_v_accounts_payable
```

Repeat for each report:
- `curated.v_accounts_payable` → matches "Accounts Payable"
- `curated.v_bank_report` → matches "Bank Report"
- `curated.v_budget_report` → matches "Budget Report"
- `curated.v_sales_register` → matches "Sales Register"

### Step 4: Validate
- Verify all visuals render correctly
- Check column names match exactly
- Confirm no DAX errors
- Test all filters and slicers

### Step 5: Configure PostgreSQL Credentials
Go to File → Options → Data Source Settings:
- Server: srv1368855.hstgr.cloud
- Port: 5432
- Database: bizware_dashboards
- Username: bizware_user (read-only user recommended)
- Password: (from .env)

Note: For Power BI to connect to PostgreSQL, port 5432 must be exposed.
Add to docker-compose.yml postgres service:
```yaml
ports:
  - "5432:5432"
```
And add firewall rule:
```bash
ufw allow from <PowerBI_Gateway_IP> to any port 5432
```

### Step 6: Publish to Power BI Service
1. File → Publish → Select workspace
2. Configure scheduled refresh in Power BI Service
3. Set up On-premises Data Gateway if needed

### Step 7: Get Embed URL
1. In Power BI Service, open the report
2. File → Embed report → Website or portal
3. Copy the embed URL
4. Set POWERBI_EMBED_URL in .env
5. Rebuild frontend: `docker compose up -d --build frontend`

## 6. Security Hardening Checklist

- [ ] Strong passwords in .env (min 20 chars, mixed case + numbers + symbols)
- [ ] PostgreSQL not exposed to public internet (internal only by default)
- [ ] UFW firewall enabled (only 22, 80, 443)
- [ ] SSL/TLS enabled via Let's Encrypt
- [ ] n8n protected with basic auth
- [ ] File upload limited to 50MB
- [ ] File types validated (.csv, .xlsx only)
- [ ] Rate limiting on API endpoints
- [ ] CORS restricted to specific origins
- [ ] Helmet security headers on backend
- [ ] Nginx security headers (HSTS, X-Frame-Options, etc.)
- [ ] Environment variables for all secrets (never in code)
- [ ] Docker containers run as non-root where possible
- [ ] Regular OS and Docker image updates

## 7. Performance Optimization

- **Database**: Indexes on all PK, FK, date, and frequently filtered columns
- **Views**: Power BI reads from lightweight views (no JOINs, no computation)
- **Batch UPSERT**: 500-row batches prevent memory spikes
- **Delta detection**: Only changed rows are updated (hash comparison)
- **Nginx**: Gzip compression, static asset caching
- **Connection pooling**: pg Pool with max 10 connections
- **Rate limiting**: Prevents abuse at nginx and application level

## 8. Future Scalability Plan

| Phase | Enhancement |
|-------|------------|
| Phase 1 | Add scheduled auto-upload via n8n cron (watch SFTP/folder) |
| Phase 2 | Add user authentication (JWT) to frontend and backend |
| Phase 3 | Add data validation rules engine in n8n |
| Phase 4 | Add email notifications on upload success/failure |
| Phase 5 | Add historical audit dashboard in frontend |
| Phase 6 | Migrate to Kubernetes for horizontal scaling |
| Phase 7 | Add Redis caching for status API |
| Phase 8 | Implement row-level security in PostgreSQL for multi-tenant |
