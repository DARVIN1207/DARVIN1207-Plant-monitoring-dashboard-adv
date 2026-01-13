# 🚀 Quick Start Guide

## Step 1: Install Dependencies

Open PowerShell or Terminal in the **backend** folder and run:

```powershell
cd backend
npm install
```

## Step 2: Initialize Database

This will create the database and seed it with sample data (200 plants, etc.):

```powershell
npm run init-db
```

**Note:** This may take 1-2 minutes to complete.

## Step 3: Start the Server

```powershell
npm start
```

You should see:
```
✅ Server running on http://localhost:3000
✅ Frontend available at http://localhost:3000
```

## Step 4: Open in Browser

Visit: **http://localhost:3000**

## Login Credentials

**Farmer (Read-Only):**
- Username: `farmer001`
- Password: `pwd001`

**Agronomist (Full Access):**
- Username: `agro01`
- Password: `pass01`

---

## Troubleshooting

### Port 3000 Already in Use?
```powershell
$env:PORT=3001
npm start
```
Then update `frontend/js/api.js` line 1 to use port 3001.

### Database Not Found?
Run `npm run init-db` again. If it fails, delete `backend/database/plant_monitoring.db` and try again.

### Module Not Found Error?
Run `npm install` again in the backend folder.


