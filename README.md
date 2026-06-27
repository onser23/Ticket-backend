# Ticket Sistemi — Backend

Baxça İdarəetmə Sistemi üçün problem bildirişi (ticket/müraciət) sisteminin backend hissəsi. Node.js + Express + MongoDB Atlas + JWT + nodemailer + multer.

**Frontend repo:** [ticket-system-frontend](https://github.com/<user>/ticket-system-frontend)

---

## Stack

- Node.js 20+
- Express 4.18
- Mongoose 8 (MongoDB ODM)
- jsonwebtoken (iki ayrı secret: user + admin)
- bcryptjs (password hashing)
- nodemailer (SMTP email)
- multer (file upload)
- express-validator (input validation)
- Jest + Supertest + mongodb-memory-server (testing)

---

## Xüsusiyyətlər

- ✅ İki ayrı auth sistemi (User + Admin) — ayrı JWT secret
- ✅ OTP email verification (qeydiyyat + şifrə sıfırlama)
- ✅ Şirkət self-onboarding (atomic register transaction)
- ✅ Müraciət CRUD (user öz müraciətləri, admin bütün müraciətlər)
- ✅ Müraciət status dəyişikliyi (resolved → email user-ə)
- ✅ Comment thread (user + admin reply, admin reply → email user-ə)
- ✅ Şirkət admin CRUD (search, status filter, soft delete)
- ✅ Stats dashboards (MongoDB `$group` aggregation)
- ✅ File upload (5 images, 2MB each, MIME validation)
- ✅ Email templates (OTP, Status Changed, Admin Reply) — branded HTML

---

## Quraşdırma

### 1. Clone

```bash
git clone https://github.com/<user>/ticket-system-backend.git
cd ticket-system-backend
```

### 2. Install

```bash
npm install
```

### 3. Environment

```bash
cp .env.example .env
# .env faylını redaktə et (real credentials)
```

**`.env` nümunəsi:**

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb+srv://<username>:<password>@ticket.2vlslck.mongodb.net/ticket_system

JWT_USER_SECRET=change-this-to-a-strong-random-string-min-32-chars
JWT_ADMIN_SECRET=change-this-to-another-strong-random-string-min-32-chars

MAIL_HOST=mail.privateemail.com
MAIL_PORT=465
MAIL_USER=info@yourdomain.com
MAIL_PASSWORD=your-smtp-password
MAIL_FROM_NAME=Ticket Sistemi

FRONTEND_URL=http://localhost:3000
```

### 4. Seed admin (default: admin / admin123)

```bash
npm run seed
```

**Production-da `admin123` şifrəsini mütləq dəyişdirin!**

### 5. Run

```bash
# Development (nodemon)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:5000`.

---

## Scripts

| Script | Açıqlama |
|--------|----------|
| `npm start` | Production server start |
| `npm run dev` | Dev server (nodemon auto-reload) |
| `npm test` | Run all jest tests (89 tests) |
| `npm run seed` | Create default admin user |
| `npm run migrate` | Migrate existing users → Companies (SP1→SP2) |

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Açıqlama |
|--------|----------|------|----------|
| POST | `/register` | ✗ | Yeni user + Company yarat, OTP email |
| POST | `/verify-otp` | ✗ | Email təsdiqlə |
| POST | `/resend-otp` | ✗ | Yeni OTP (60s cooldown) |
| POST | `/login` | ✗ | Login, JWT al |
| POST | `/forgot-password` | ✗ | Reset OTP göndər |
| POST | `/reset-password` | ✗ | Şifrəni sıfırla |
| GET | `/me` | ✓ user | Cari user |

### Admin Auth (`/api/admin/auth`)

| Method | Endpoint | Açıqlama |
|--------|----------|----------|
| POST | `/login` | Admin login |
| GET | `/me` | Cari admin |

### Tickets (`/api/tickets`)

| Method | Endpoint | Auth | Açıqlama |
|--------|----------|------|----------|
| GET | `/` | ✓ user/admin | User: own / Admin: all + filter |
| GET | `/:id` | ✓ user/admin | Single ticket |
| POST | `/` | ✓ user | Yeni ticket (multipart, max 5 images) |
| PATCH | `/:id/status` | ✓ admin | Status dəyişdir (resolved → email) |
| DELETE | `/:id` | ✓ admin | Soft delete |

### Comments (`/api/comments`)

| Method | Endpoint | Auth | Açıqlama |
|--------|----------|------|----------|
| GET | `/ticket/:ticketId` | ✓ user/admin | Comment-lər |
| POST | `/ticket/:ticketId` | ✓ user/admin | Comment yaz (admin reply → email) |

### Companies (`/api/companies`)

| Method | Endpoint | Auth | Açıqlama |
|--------|----------|------|----------|
| GET | `/` | ✓ admin | List + search + status filter |
| GET | `/:id` | ✓ admin | Single |
| PUT | `/:id` | ✓ admin | Update |
| DELETE | `/:id` | ✓ admin | Soft delete |

### Profile (`/api/profile`, `/api/admin/profile`)

| Method | Endpoint | Auth | Açıqlama |
|--------|----------|------|----------|
| GET | `/` | ✓ user/admin | Cari profil |
| PUT | `/` | ✓ user/admin | Update info |
| PUT | `/password` | ✓ user/admin | Change password |

### Stats (`/api/stats`)

| Method | Endpoint | Auth | Açıqlama |
|--------|----------|------|----------|
| GET | `/user` | ✓ user | Own ticket counts |
| GET | `/admin` | ✓ admin | All + byCompany breakdown |

### Static files

| Path | Açıqlama |
|------|----------|
| `/uploads/tickets/*` | Upload edilmiş şəkillər |

---

## Data Model

```
users       → firstName, lastName, email (unique), password (bcrypt hash, min 6),
             companyName, companyId, isVerified, isActive
admins      → username (unique), password (bcrypt hash), email, fullName
companies   → displayName, originalName, ownerUserId (unique), contactEmail, contactPhone, isActive
tickets     → displayId (auto "TKT-NNN"), title, description, status, priority,
             companyId, createdBy, attachments[], isActive, resolvedAt
comments    → ticketId, authorId (refPath), authorRole, text
otps        → email, code (bcrypt hash), purpose, expiresAt (TTL), isUsed, attempts
```

---

## Tests

```bash
npm test
```

**89 tests** (8 test faylı):
- `auth.test.js` (26 tests) — register, OTP, login, forgot/reset password, /me, cross-panel block
- `adminAuth.test.js` (7 tests) — admin login, /me
- `companies.test.js` (6 tests) — CRUD, search, soft delete
- `profile.test.js` (10 tests) — info + password change
- `tickets.test.js` (14 tests) — POST multipart, GET list, GET :id
- `tickets-admin.test.js` (15 tests) — admin GET/PATCH/DELETE
- `comments.test.js` (11 tests) — list + post, admin email trigger
- `stats.test.js` (6 tests) — user + admin stats

---

## Layihə Strukturu

```
backend/
├── config/         # db, mailer, seed, migrate
├── middleware/     # auth, adminAuth, authOrAdmin, upload, errorHandler
├── models/         # User, Admin, Company, Ticket, Comment, Otp
├── routes/         # auth, adminAuth, tickets, comments, companies,
│                   # profile, adminProfile, stats
├── services/       # emailService, emailTemplates (3 templates)
├── utils/          # jwt, password, otp, validators
├── tests/          # 89 jest tests
├── docs/           # design doc + plans
├── uploads/        # multer file uploads (gitignored)
├── server.js
└── package.json
```

---

## Təhlükəsizlik

- `.env` gitignored
- İki ayrı JWT secret (user vs admin) — cross-panel girişi bloklanır
- bcrypt password hash (10 rounds)
- OTP 6-rəqəmli, bcrypt-hashed, 10 dəq TTL, max 5 attempt, 60s resend cooldown
- CORS configured (`FRONTEND_URL` env)
- Multer file upload validation (mime + extension, 2MB max)
- User input validation (express-validator)
- Email enumeration prevention (forgot-password always returns 200)
- HTML email templates (XSS prevention — pre-rendered, no user content)

---

## Lisenziya

Private / Proprietary
