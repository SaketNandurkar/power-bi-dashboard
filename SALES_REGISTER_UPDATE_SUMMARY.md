# Sales Register - New Fields Update Summary

## ✅ Changes Applied

### **3 New Fields Added:**

| SAP Field | Database Column | Type | Description |
|-----------|----------------|------|-------------|
| `ZbillQty` | `billing_quantity` | NUMERIC(18,3) | Billing Quantity |
| `ZinvNetvalue` | `net_value` | NUMERIC(18,2) | Invoice Net Value |
| `ZinvTaxamt` | `tax_amount` | NUMERIC(18,2) | Invoice Tax Amount |

---

## 📋 What Was Updated:

### 1. **Database Schema** ✅
- Added 3 new columns to `raw.raw_sales_register`
- Added 3 new columns to `curated.sales_register`
- Updated Power BI view `curated.v_sales_register` to expose new fields

**Files:**
- [database/add-sales-register-fields.sql](database/add-sales-register-fields.sql)

### 2. **Upsert Function** ✅
- Updated `raw.upsert_sales_register()` function
- Added new parameters for 3 new fields
- Updated both raw and curated insert/update logic

**Files:**
- [database/update-sales-upsert.sql](database/update-sales-upsert.sql)

### 3. **Field Mappings** ✅
- Updated SAP → PostgreSQL field mappings
- Added 3 new field mappings in `sales_register` config
- Updated `upsertParamOrder` array

**Files:**
- [backend/src/services/sapFieldMappings.js](backend/src/services/sapFieldMappings.js)

### 4. **Backend Code** ✅
- Rebuilt Docker image with updated mappings
- Changes are now live in the container

---

## 🔄 Next Steps:

### **To Load New Data:**

1. **Restart Backend** (if not done automatically):
   ```bash
   docker-compose -f docker-compose.local.yml up -d backend
   ```

2. **Trigger Sync to Load Fresh Data:**
   ```bash
   curl -X POST http://localhost:3001/api/sap/sync
   ```

   This will:
   - Truncate old sales_register data
   - Fetch fresh data from SAP with new fields
   - Load into database

3. **Verify New Fields:**
   ```sql
   SELECT invoice_no, billing_quantity, net_value, tax_amount, total
   FROM curated.sales_register
   LIMIT 5;
   ```

---

## 📊 Power BI Update:

The Power BI view now exposes these new columns:
- **"Billing Quantity"**
- **"Net Value"**
- **"Tax Amount"**

**To use in Power BI:**
1. Refresh your dataset in Power BI Service
2. New columns will automatically appear
3. Add them to your visualizations

---

## 🎯 Sample Data Structure:

**Before:**
```
Invoice No: 8018100009
Billing Type: ZDM1
Total: 15000.000
```

**After:**
```
Invoice No: 8018100009
Billing Type: ZDM1
Billing Quantity: 10.000        ← NEW
Net Value: 15000.000            ← NEW
Tax Amount: 0.000               ← NEW
Total: 15000.000
```

---

**All changes applied successfully!** 🎉
