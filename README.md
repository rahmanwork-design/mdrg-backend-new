# MDRG Backend - Render Deployment

This folder contains the backend API for Managing Debt Responsibly Group, ready to deploy to Render.

## Quick Deploy

### 1. Upload to GitHub
Create a new GitHub repository and upload ALL files from this folder to the ROOT (not in a subfolder).

### 2. Deploy to Render
- Go to https://dashboard.render.com
- Click "New +" → "Blueprint"
- Connect your GitHub repo
- Click "Apply"

### 3. Done!
Your backend will be live at: `https://your-service-name.onrender.com`

## Files Included

- `src/` - Server and database code
- `routes/` - API routes (auth, clients)
- `middleware/` - Authentication middleware
- `database/` - SQLite database folder
- `package.json` - Node.js dependencies
- `render.yaml` - Render configuration
- `RENDER_DEPLOY_GUIDE.md` - Detailed instructions

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/clients` - List all clients
- `POST /api/clients/:id/cases` - Create new case
- `GET /api/dashboard/stats` - Dashboard statistics

## Support

See `RENDER_DEPLOY_GUIDE.md` for detailed step-by-step instructions.
