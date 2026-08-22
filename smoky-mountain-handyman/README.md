# Smoky Mountain Handyman - Dispatch SaaS

AI-powered handyman dispatch platform. Property managers create jobs, Claude AI auto-assigns the best contractor, and everyone tracks progress in real-time.

## Quick Start

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Open the **SQL Editor** in your Supabase dashboard
3. Paste and run the entire contents of `supabase/schema.sql`
4. Go to **Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon` key → `SUPABASE_ANON_KEY`

### 2. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → `ANTHROPIC_API_KEY`

### 3. Local Development

```bash
# Clone / navigate to project
cd smoky-mountain-handyman

# Install dependencies
npm install

# Copy env template and fill in your keys
cp .env.example .env

# Start dev server
npm run dev
```

Server runs at `http://localhost:3001`

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_ANON_KEY
# - ANTHROPIC_API_KEY
# - JWT_SECRET
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/me` | Get current user |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Create job (AI auto-assigns contractor) |
| GET | `/api/jobs` | List user's jobs (filter: `?status=&urgency=`) |
| GET | `/api/jobs/:id` | Job details + status history |
| PATCH | `/api/jobs/:id/status` | Update job status |
| PATCH | `/api/jobs/:id/photos` | Add photos to job |
| PATCH | `/api/jobs/:id/reassign` | Manually reassign contractor |

### Contractors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contractors` | List contractors (filter: `?availability=&skill=`) |
| POST | `/api/contractors` | Add contractor |
| GET | `/api/contractors/:id` | Contractor details + active jobs |
| PATCH | `/api/contractors/:id` | Update contractor |
| GET | `/api/contractors/:id/jobs` | Contractor's job list |

### Properties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | List user's properties |
| POST | `/api/properties` | Add property |
| GET | `/api/properties/:id` | Property details + job history |
| PATCH | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices` | Create invoice for a job |
| GET | `/api/invoices` | List invoices |
| GET | `/api/invoices/:id` | Invoice details |
| GET | `/api/invoices/:id/pdf` | Download PDF invoice |
| PATCH | `/api/invoices/:id` | Update invoice |

## How AI Assignment Works

When a job is created, the system:
1. Fetches all available contractors from Supabase
2. Sends the job description + contractor list to Claude
3. Claude analyzes skills match, urgency, cost, and rating
4. Returns the best contractor with reasoning
5. Job is auto-assigned and status set to "assigned"

## Frontend Integration

Your React frontend should:
1. Store the JWT token from login/register
2. Send it in the `Authorization: Bearer <token>` header
3. Connect to `http://localhost:3001/api` (dev) or your Vercel URL (prod)

## Database Tables

- **users** - Property managers and admins
- **contractors** - Handyman contractors with skills and rates
- **properties** - Managed properties
- **jobs** - Work orders with AI assignment
- **job_status_history** - Audit trail of status changes
- **invoices** - Generated invoices
