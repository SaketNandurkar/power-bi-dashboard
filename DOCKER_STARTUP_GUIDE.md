# 🚀 Bizware Power BI Dashboards - Docker Startup Guide

## 📋 Port Reference Table

| Service | Host Port | Container Port | Purpose |
|---------|-----------|----------------|---------|
| **Frontend (React)** | **3000** | 80 | Main web application UI |
| **Backend (Express API)** | **3001** | 3001 | REST API for uploads & SAP sync |
| **PostgreSQL** | **5433** | 5432 | Database (exposed for external access) |
| **n8n** | **5678** | 5678 | Workflow automation UI |

### Important Notes:
- ✅ **Frontend is ALWAYS on port 3000** (not 8080 or any other port)
- ✅ **SAP_MOCK_MODE=false** - Uses production SAP API directly
- ✅ **sampleXML folder is NOT used** - All data comes from production

---

## 🛑 Step 1: Stop Everything & Clean Up

```bash
# Stop all Docker containers
docker-compose -f docker-compose.local.yml down

# Kill any lingering processes on ports
netstat -ano | findstr ":3000 :3001"
# If you see any PIDs, kill them:
# taskkill //F //PID <PID_NUMBER>
```

---

## ▶️ Step 2: Start the Project

### **Option A: Fresh Start (Recommended)**
```bash
# Build and start all services
docker-compose -f docker-compose.local.yml up --build -d

# View logs (optional)
docker-compose -f docker-compose.local.yml logs -f
```

### **Option B: Quick Start (No Rebuild)**
```bash
# Start existing containers
docker-compose -f docker-compose.local.yml up -d
```

---

## ✅ Step 3: Verify Services Are Running

```bash
# Check all containers are up
docker ps

# Expected output:
# bizware-frontend    (0.0.0.0:3000->80/tcp)
# bizware-backend     (0.0.0.0:3001->3001/tcp)
# bizware-postgres    (0.0.0.0:5433->5432/tcp)
# bizware-n8n         (0.0.0.0:5678->5678/tcp)
```

---

## 🌐 Step 4: Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Main App** | http://localhost:3000 | N/A |
| **Backend API** | http://localhost:3001/api/status | N/A |
| **n8n Workflows** | http://localhost:5678 | admin / admin123 |
| **PostgreSQL** | localhost:5433 | bizware_user / localdev123 |

---

## 🔄 Step 5: Trigger Data Sync

```bash
# Sync all reports from SAP production
curl -X POST http://localhost:3001/api/sap/sync

# Check sync status
curl http://localhost:3001/api/status
```

---

## 🛑 Stop the Project

```bash
# Stop all containers (keeps data)
docker-compose -f docker-compose.local.yml stop

# Stop and remove containers (keeps volumes)
docker-compose -f docker-compose.local.yml down

# Nuclear option: Remove everything including volumes
docker-compose -f docker-compose.local.yml down -v
```

---

## 🔧 Troubleshooting

### **Port Already in Use**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill it (replace <PID> with actual PID)
taskkill //F //PID <PID>
```

### **Database Connection Issues**
```bash
# Check PostgreSQL is healthy
docker exec bizware-postgres pg_isready -U bizware_user

# Connect to database
docker exec -it bizware-postgres psql -U bizware_user -d bizware_dashboards
```

### **Backend Not Starting**
```bash
# Check backend logs
docker logs bizware-backend

# Restart backend
docker-compose -f docker-compose.local.yml restart backend
```

### **SAP Connection Issues**
- Ensure you're on company VPN
- SAP URL: `https://10.10.2.212:44300`
- Check credentials are correct in docker-compose.local.yml (lines 88-89)

---

## 📦 Data Flow

```
SAP Production API (10.10.2.212:44300)
    ↓ (Hourly sync via backend)
PostgreSQL Database (port 5433)
    ↓ (Live connection via gateway)
Power BI Service
    ↓ (Embedded iframe)
Frontend (port 3000)
```

---

## 🎯 Quick Commands Reference

```bash
# Full restart (fresh build)
docker-compose -f docker-compose.local.yml down && docker-compose -f docker-compose.local.yml up --build -d

# View all logs
docker-compose -f docker-compose.local.yml logs -f

# View specific service logs
docker logs -f bizware-backend

# Rebuild single service
docker-compose -f docker-compose.local.yml build backend
docker-compose -f docker-compose.local.yml up -d backend

# Execute SQL
docker exec -it bizware-postgres psql -U bizware_user -d bizware_dashboards -c "SELECT COUNT(*) FROM curated.sales_register;"
```

---

**Always use `docker-compose.local.yml` for local development!** ✅
