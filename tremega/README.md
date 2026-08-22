# Tremega - Bids & Estimates + Sub/Contractor Management

A full-stack bids, estimates, and subcontractor management system for Tremega.

## Project Structure

```
tremega/
├── backend/                    # Node.js/Express API (Port 3000)
│   ├── lib/
│   │   └── supabase.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── bids.js            # Bids + sub assignments
│   │   ├── subs.js            # Sub management
│   │   ├── notifications.js   # Notifications
│   │   ├── messages.js        # Messaging
│   │   └── photos.js          # Photo uploads
│   ├── schema.sql             # Bids tables
│   ├── schema_subs.sql        # Sub management tables
│   ├── server.js
│   └── package.json
│
└── frontend/                   # React/Vite (Port 5173)
    ├── src/
    │   ├── components/
    │   │   ├── ui/            # shadcn/ui components
    │   │   ├── BidForm.tsx
    │   │   ├── BidPreview.tsx
    │   │   ├── BidsList.tsx
    │   │   ├── BidStatusBadge.tsx
    │   │   ├── SubsList.tsx
    │   │   ├── InviteSubModal.tsx
    │   │   ├── SubPerformanceDashboard.tsx
    │   │   ├── SubAssignmentPanel.tsx
    │   │   ├── NotificationCenter.tsx
    │   │   ├── MessagingThread.tsx
    │   │   ├── PhotoUploadWidget.tsx
    │   │   └── PhotoGallery.tsx
    │   ├── hooks/
    │   │   ├── useBids.ts
    │   │   ├── useSubs.ts
    │   │   ├── useSubAssignments.ts
    │   │   ├── useNotifications.ts
    │   │   ├── useMessages.ts
    │   │   └── usePhotos.ts
    │   ├── lib/
    │   │   ├── api.ts
    │   │   └── utils.ts
    │   ├── pages/
    │   │   ├── BidsPage.tsx
    │   │   ├── SubsPage.tsx
    │   │   └── SubDashboard.tsx
    │   ├── types/
    │   │   └── index.ts
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

## Setup Instructions

### 1. Database Setup (Supabase)

1. Create a new Supabase project at https://supabase.com
2. Run `backend/schema.sql` in the Supabase SQL Editor
3. Run `backend/schema_subs.sql` in the Supabase SQL Editor
4. Create a storage bucket named `job-photos` (public)
5. Note your project URL and service role key

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Supabase credentials

# Start the server
npm run dev
```

The backend will run on http://localhost:3000

### 3. Frontend Setup

```bash
cd frontend
npm install

# Start the dev server
npm run dev
```

The frontend will run on http://localhost:5173

## Features

### Bids & Estimates
- Create, edit, and manage bids/estimates
- Line item management with auto-calculation
- Tax calculation
- Status workflow: Draft → Sent → Accepted/Rejected
- Auto-expiration after 30 days
- Job creation on bid acceptance

### Sub/Contractor Management
- Invite subs via email
- Assign subs to bid line items
- Track sub performance (completion rate, turnaround time)
- Sub dashboard for assigned work only
- Role-based access (owner, admin, contractor, sub, worker)

### Messaging
- Thread-based messaging on bids/jobs/assignments
- Contractor ↔ Sub communication
- Real-time polling (10s interval)

### Notifications
- In-app notifications for assignments, messages, updates
- Unread count badge
- Mark as read / mark all as read

### Photo Management
- Upload photos to bids/jobs
- Phase tracking (bid, progress, completion)
- Photo gallery with expand/delete
- Supabase Storage integration

## API Endpoints

### Bids
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/bids | Create new bid |
| GET | /api/bids | List all bids |
| GET | /api/bids/:id | Get single bid |
| PUT | /api/bids/:id | Update bid |
| POST | /api/bids/:id/send | Send bid |
| PUT | /api/bids/:id/accept | Accept bid |
| PUT | /api/bids/:id/reject | Reject bid |
| DELETE | /api/bids/:id | Delete bid |
| POST | /api/bids/:bidId/line-items/:lineItemId/assign-sub | Assign sub |

### Subs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/subs | Invite sub |
| GET | /api/subs | List subs |
| GET | /api/subs/:id/performance | Get performance |
| PUT | /api/subs/:id | Update sub |
| DELETE | /api/subs/:id | Remove sub |

### Sub Assignments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/bids/sub-assignments | Get my assignments |
| PUT | /api/bids/sub-assignments/:id/start | Start work |
| PUT | /api/bids/sub-assignments/:id/complete | Complete work |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | Get notifications |
| PUT | /api/notifications/:id/read | Mark as read |
| PUT | /api/notifications/mark-all-read | Mark all read |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/messages | Send message |
| GET | /api/messages | Get messages |
| GET | /api/messages/:id/thread | Get thread |

### Photos
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/photos/upload | Upload photo |
| GET | /api/photos | List photos |
| DELETE | /api/photos/:id | Delete photo |

## Tech Stack

**Backend:**
- Node.js + Express
- Supabase (PostgreSQL + Storage)
- JWT authentication
- Express Validator
- Multer (file uploads)

**Frontend:**
- React 18 + TypeScript
- Vite
- TanStack Query (React Query)
- Tailwind CSS + shadcn/ui
- React Router
- Lucide icons

## Security

- Row Level Security (RLS) policies on all tables
- Business-scoped data isolation
- Subs can only see their assigned work
- JWT authentication required for all endpoints
- File upload validation (images only, 10MB limit)
