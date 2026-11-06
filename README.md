# SheRise – Women Entrepreneurship Hub

A beginner-friendly full-stack platform that helps women explore business ideas, showcase products, contact entrepreneurs, estimate product profit, request mentorship and find official business-support resources.

## 1. Problem and objectives

People starting small businesses may struggle to find practical first steps, customers, mentors and reliable support information. SheRise brings several beginner resources into one place. It is an educational MVP, not a financial institution, job placement agency or verified marketplace operator.

### Users
- **Visitor:** Browse public business listings and funding resources; use the idea lab, business guide and profit calculator.
- **Registered entrepreneur/member:** Publish and delete their own business listings, contact another business, and submit mentorship requests.
- **Administrator:** No admin role is included in this MVP. Funding resources are inserted through SQL and managed by a database administrator.

## 2. Implemented features
- Account registration, login, logout and session check.
- Public marketplace with search and category filter.
- Authenticated business listing creation and owner-only deletion API.
- Authenticated customer enquiries.
- Local rule-based business idea generator and business guide (no AI API).
- Profit estimate calculator (runs in browser; not accounting advice).
- Mentorship request submission.
- Funding resource directory with official links and eligibility reminders.
- Responsive design and API health endpoint.

**Not included in this MVP:** payment processing, product image uploads, checkout/shipping, chat, mentor scheduling, admin dashboard, email verification/password reset, file uploads, automated AI/LLM integration, or automatic verification of funding schemes. Do not treat sample funding links as confirmation that a programme is currently open.

## 3. Technology
- HTML5, CSS3, Vanilla JavaScript
- Node.js 20+ and Express 5
- Supabase PostgreSQL
- npm packages: `@supabase/supabase-js` (database client), `bcryptjs` (password hashing), `jsonwebtoken` (signed session token), `cookie-parser` (read cookie), `dotenv` (environment config), `helmet` (security headers), `express-rate-limit` (limit login attempts)

## 4. Folder structure

```text
sherise-women-entrepreneurship-hub/
├── .gitignore
├── README.md
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── .env                 # placeholders only; fill locally; never commit
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── routes.js
└── database/
    └── schema.sql
```

## 5. Prerequisites
Install:
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js LTS (includes npm)](https://nodejs.org/)
- [Git](https://git-scm.com/downloads)
- A free [Supabase account](https://supabase.com/)

In a new VS Code terminal, verify:

```powershell
node --version
npm --version
git --version
```

Use Node.js 20 or newer.

## 6. Setup on Windows

1. Download and extract `sherise-women-entrepreneurship-hub.zip`.
2. In VS Code choose **File → Open Folder** and open the extracted `sherise-women-entrepreneurship-hub` folder.
3. Open **Terminal → New Terminal**. Confirm you can see `frontend`, `backend`, and `database` in the Explorer.
4. In the terminal, enter the backend directory and install dependencies:

   ```powershell
   cd backend
   npm install
   ```

   npm downloads the server libraries and creates `package-lock.json`. Wait for the command prompt to return. If PowerShell blocks `npm`, try `npm.cmd install`.

5. Create a Supabase project at https://supabase.com/. Choose a project name and database password and keep the password private.
6. In Supabase open **SQL Editor → New query**. Open `database/schema.sql` in VS Code, copy all its contents, paste into the SQL Editor and click **Run**. In **Table Editor**, verify these tables exist: `users`, `businesses`, `inquiries`, `mentor_requests`, `funding_resources`.
7. In Supabase open **Project Settings → API** (or **API Keys** in the current dashboard). Copy the Project URL and the `service_role` secret key. The service-role key is privileged: use it only in `backend/.env`, never in frontend files or GitHub.
8. Open `backend/.env` and replace the placeholders:

   ```env
   PORT=3000
   NODE_ENV=development
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
   JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   ```

   Generate a strong JWT secret in a terminal with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   `.env` contains your private local values. `.env.example` documents variable names and safe example values. Do not commit `.env`.

9. From the `backend` directory start the app:

   ```powershell
   npm start
   ```

   Expected terminal output: `SheRise is running at http://localhost:3000`. Open http://localhost:3000 in your browser. Keep the terminal running while using the app. Stop the server with Ctrl+C.
10. Test registration, login, marketplace listing, enquiries, mentorship request and public funding resources. The database must be set up before these database-backed features work.

### macOS/Linux notes
Use the same commands in Terminal. Directory changes use `cd backend`; shell syntax for editing `.env` differs, but the file contents are the same.

## 7. Architecture

```text
Browser (HTML/CSS/Vanilla JS)
          | fetch() to /api/*
          v
Express server (backend/server.js + routes.js)
          | Supabase JS client (server-side service role)
          v
Supabase PostgreSQL
```

The browser never receives the Supabase service-role key. Express verifies the signed, HTTP-only session cookie and enforces ownership in routes before reading or changing private records.

## 8. Database tables and relationships

- `users`: one account per unique email; stores a bcrypt password hash.
- `businesses`: each listing belongs to one user (`owner_id → users.id`).
- `inquiries`: connects a sender (`sender_id → users.id`) to a business (`business_id → businesses.id`).
- `mentor_requests`: each request belongs to one user (`user_id → users.id`).
- `funding_resources`: public information entries, independent of user accounts.

Foreign keys cascade dependent records when an account or business is deleted. Prices are non-negative. Text lengths and statuses are constrained. Indexes support owner, category and related-record lookups.

## 9. API reference
All routes are same-origin under `/api`. JSON bodies are used. Authenticated endpoints require the HTTP-only `sherise_token` cookie created at login/register. The cookie is `SameSite=Strict`, `HttpOnly`, and `Secure` in production. Mutating requests with an Origin header must match the current host.

| Method | Path | Purpose | Auth | Body/query | Success |
|---|---|---|---|---|---|
| GET | `/api/health` | Server health | No | None | `{ ok: true, service }` |
| POST | `/api/auth/register` | Create account | No; rate limited | `{ fullName, email, password }` | `201 { user }`, sets cookie |
| POST | `/api/auth/login` | Sign in | No; rate limited | `{ email, password }` | `{ user }`, sets cookie |
| POST | `/api/auth/logout` | Clear session cookie | No | None | `{ message }` |
| GET | `/api/auth/me` | Current account | Yes | None | `{ user }` |
| GET | `/api/businesses` | Browse active listings | No | `search`, `category` query | `{ businesses }` |
| POST | `/api/businesses` | Publish listing | Yes | `{ name, category, description, productName, price, contactEmail, city }` | `201 { business }` |
| GET | `/api/my/businesses` | List own listings | Yes | None | `{ businesses }` |
| DELETE | `/api/businesses/:id` | Delete own listing | Yes; owner only | None | `{ message }` |
| POST | `/api/businesses/:id/inquiries` | Contact listing owner | Yes | `{ message }` | `201 { inquiryId, message }` |
| POST | `/api/mentor-requests` | Submit mentor request | Yes | `{ topic, goals, preferredContact }` | `201 { request }` |
| GET | `/api/funding` | List support resources | No | None | `{ resources }` |

Common errors: `400` invalid input, `401` missing/invalid session, `403` disallowed origin, `404` missing route/listing, `409` duplicate email, `500` unexpected write failure, `503` database unavailable. Error responses use `{ "error": "message" }`. Private listing deletion checks both record ID and authenticated owner ID. User IDs and roles are never accepted from the browser.

## 10. Authentication and security notes

This MVP uses server-managed JWT sessions in HTTP-only cookies and bcrypt password hashes. It does not use Supabase Auth. The Supabase service-role key bypasses RLS, so all database access must go through the trusted Express server. RLS is enabled on every table as defence-in-depth, but no browser access is configured. Never create a frontend Supabase client with the service-role key. For production deployment, consider managed Supabase Auth, email verification, password reset, stronger CSRF/origin policy for your deployment topology, audit logging and a dedicated admin workflow. Use HTTPS in production. Rotate any key that is accidentally exposed.

## 11. Manual test checklist

- [ ] `GET http://localhost:3000/api/health` returns `ok: true`.
- [ ] Register with a new valid email; user row appears and browser session starts.
- [ ] Register same email again; API returns `409`.
- [ ] Password shorter than 8 characters is rejected.
- [ ] Refresh page; session remains active; `/api/auth/me` returns the user.
- [ ] Log out; `/api/auth/me` returns `401`.
- [ ] Browse marketplace without login; public listings appear.
- [ ] Search by business/product name and filter category.
- [ ] Publish listing while logged in; it appears in marketplace and in `businesses` table.
- [ ] Submit invalid/empty listing values; server rejects them.
- [ ] Contact another user's listing; enquiry row is created. Attempt to contact own listing; server rejects it.
- [ ] Submit a mentorship request while logged in; row appears in `mentor_requests`.
- [ ] Use idea generator, business guide and profit calculator without an account.
- [ ] Funding resources load with official links.
- [ ] Try deleting a listing using a different account; request must not delete it.
- [ ] Resize browser to mobile width; navigation and cards stack without horizontal overflow.
- [ ] Confirm `.env` and `node_modules/` are not staged for Git.

## 12. Troubleshooting

- **Missing or placeholder environment values:** edit `backend/.env`; confirm variable names are exact and there are no extra quote marks.
- **Invalid API key / database unavailable:** verify `SUPABASE_URL` and server-side service-role key in Supabase settings. Do not paste the key into chat or GitHub.
- **relation does not exist:** run all of `database/schema.sql` in the correct Supabase project's SQL Editor.
- **Port already in use:** change `PORT=3001` in `.env`, restart, then open http://localhost:3001.
- **npm command blocked in PowerShell:** use `npm.cmd install` and `npm.cmd start`.
- **Cannot log in:** confirm the account exists in `users`; register again with a unique email if needed.
- **Marketplace empty:** create a listing while signed in. Empty state is expected for a new database.

## 13. GitHub upload

Create an empty repository on GitHub (do not add a README or license if this folder already has one). Open a terminal at the project root `sherise-women-entrepreneurship-hub`, then run:

```bash
git init
git status
git add .
git status
git commit -m "Build SheRise women entrepreneurship hub"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the HTTPS URL copied from your own GitHub repository. Before `git add .` and before committing, confirm `backend/.env` is not staged, `.env.example` is included, `node_modules/` is excluded, and no secrets appear in any file. `.gitignore` does not remove a secret already committed. If a secret was pushed, rotate it immediately in Supabase and clean the repository history.

## 14. Verification and limitations

The project ZIP includes the full source, SQL schema and setup instructions. After extraction, run `npm install` to regenerate dependencies locally. The Supabase database connection cannot be verified until you supply your own Supabase project URL and service-role key and run the SQL schema. Funding scheme details and availability can change; check the official provider before applying. Product images, payments, admin moderation and live AI are intentionally outside this beginner MVP.
