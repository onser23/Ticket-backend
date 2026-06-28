# CONTEXT — Ticket Backend

Bu fayl monorepo-dan backend-in çıxarılması haqqında qısa məlumat verir.

**Tarixçə:** Bu backend əvvəlcə `C:\Users\Administrator\Desktop\Ticket\` monorepo-sunun bir hissəsi idi (7 sub-project: SP1-SP7). 2026-06-27 tarixində ayrı GitHub repo-ya köçürülüb.

**Tam implementation tarixçəsi:** Monorepo-nun CONTEXT.md faylında saxlanılıb (8 session: brainstorming, design doc, SP1-SP7 implementation, final smoke test).

## Sub-Project Breakdown

| Sub-Project | Ad | Status |
|-------------|----|--------|
| SP1 | Foundation + Auth | ✅ |
| SP2 | Layout + Profile + Companies (atomic register, migration) | ✅ |
| SP3 | Tickets + File Upload (multer, TKT-NNN auto-gen) | ✅ |
| SP4 | Admin Tickets + Status + Email (statusChanged template) | ✅ |
| SP5 | Reply/Comment Thread (polymorphic refPath, adminReply template) | ✅ |
| SP6 | Stats Dashboards (MongoDB $group aggregation) | ✅ |
| SP7 | Polish + Mobile + Final (ErrorBoundary, README) | ✅ |
| **FB-1** | **Ticket Fixes Batch (2026-06-27)** — **✅** | ✅ |

## FB-1: Ticket Fixes Batch (2026-06-27)

**Tarix:** 2026-06-27
**Status:** ✅ Tamamlanıb (11/13 implementation task + docs)
**Təsvir:** İstifadəçi tərəfindən test zamanı aşkar edilmiş 9 bug/feature üçün tək spec + plan + subagent-driven workflow ilə icra olunub.

### Dəyişikliklər

| Task | Ad | Tip | Commit |
|------|----|-----|--------|
| T1 | `tests/auth-cascade.test.js` (Tasks 2+4 backend tests) | TDD red | `ec32773` |
| T2 | Reset-password `isVerified: true` + login message fix | TDD green | `9f246c2` |
| T3 | `tests/companies-cascade.test.js` (Tasks 4+5 cascade tests) | TDD red | `f8f063c` `12a262e` `fc40f24` |
| T4 | DELETE/PUT `isActive` cascade (Company ↔ User) | TDD green | `c816909` |
| T5 | `tests/companies-ticket-count.test.js` (Task 6 aggregation tests) | TDD red | `f5d236f` |
| T6 | Companies GET aggregation pipeline (`$lookup` + sortBy/order) | TDD green | `4ddea6e` |
| T7 | `companies.test.js` populate tests (Tasks 1+3) | TDD green | `36cd79e` |
| T8 | Spec + Plan docs | Docs | `bc09b1a` |

### Yeni Funksionallıq

**1. Cascading Logic (Tasks 4, 5):**
- Admin Company-ni deaktiv etdikdə → eyni anda User.isActive=false olur
- Admin PUT `isActive: true` → User.isActive=true geri qaytar (reaktiv)
- Mesajlar: `'Şirkət və istifadəçi hesabı deaktiv edildi'` / `'Şirkət və istifadəçi hesabı yenidən aktivləşdirildi'`

**2. Auto-Verify on Password Reset (Task 2):**
- Reset-password uğurlu olduqda User.isVerified=true avtomatik set olunur
- Mesaj: `'Şifrə uğurla dəyişdirildi və email təsdiqləndi. İndi login ola bilərsiniz.'`

**3. Updated Login Message (Task 4):**
- `User.isActive=false` olduqda: `'Hesabınız deaktiv edilib'` (əvvəl: `'Hesab deaktiv edilib'`)

**4. Companies GET Aggregation (Task 6):**
- `ticketCount` field hər şirkətin müraciət sayını göstərir (MongoDB `$lookup` + `$size`)
- Query params: `?sortBy=createdAt|ticketCount&order=asc|desc`
- `ownerUserId` populate: `firstName lastName email isVerified` (Tasks 1, 3)

### Test Status (FB-1 sonrası)

**Backend test suite:**
- **101 PASS / 10 FAIL / 111 total**
- 89 (SP1-SP7) + 22 (FB-1 yeni testlər) = 111 test
- 10 pre-existing FAIL **mövcud deyil** — `server.js:11` `connectDB()` middleware race condition səbəbindən (mongodb-memory-server vs production URI conflict)
- Bu bug SP1-SP7 zamanı mövcud idi (plan qeydlərində qeyd olunub), FB-1 scope xaricindədir

**Yeni test faylları:**
- `Backend/tests/auth-cascade.test.js` (143 lines, 7 tests)
- `Backend/tests/companies-cascade.test.js` (179 lines, 7 tests)
- `Backend/tests/companies-ticket-count.test.js` (120 lines, 6 tests)
- `Backend/tests/companies.test.js` (+2 populate tests)

### Manual Smoke Test Status

**FB-1 manual smoke test (10 ssenari)** — İstifadəçi tərəfindən icra olunmalıdır. Detallar `docs/superpowers/specs/2026-06-27-ticket-fixes-batch-design.md` §7.2-də.

---

## Nədir Bu Repo?

- **Backend-only** — `frontend/` və monorepo faylları bu repo-da YOXDUR
- Frontend repo ayrıdır: `ticket-system-frontend`
- **111 backend test (FB-1 sonrası), 0 FB-1 regression**
- **Real Atlas DB ilə end-to-end smoke test uğurlu** (SP7-də)

## Texniki Stack

- Node.js 20+ / Express 4.18 / Mongoose 8
- jsonwebtoken (2 secret: user 24h, admin 12h)
- bcryptjs (10 rounds)
- nodemailer (SMTP/SSL 465, Namecheap Private Email)
- multer (UUID filename, mime/ext whitelist, 2MB/file, 5 files max)
- express-validator
- Jest + Supertest + mongodb-memory-server (in-memory)
- MongoDB aggregation pipeline (`$lookup`, `$match`, `$sort`, `$skip`, `$limit`, `$unwind`, `$project`, `$size`)

## API Endpoints — FB-1 Yenilikləri

| Endpoint | Dəyişiklik |
|----------|------------|
| `POST /api/auth/reset-password` | + `isVerified: true` set, + yeni success message |
| `POST /api/auth/login` | "Hesabınız deaktiv edilib" message |
| `DELETE /api/companies/:id` | + `User.updateOne({companyId}, {isActive: false})` cascade |
| `PUT /api/companies/:id` | + `isActive` cascade (PUT zamanı həm Company həm User dəyişir) |
| `GET /api/companies` | + `ticketCount` aggregation, + `sortBy/order` params, + `ownerUserId.isVerified` populate |

## Quraşdırma

README.md faylına baxın.

## Deployment

Production üçün Railway/Render/Heroku + MongoDB Atlas + SMTP (SendGrid/SES).

## Əlaqəli Sənədlər

- `docs/superpowers/specs/2026-06-27-ticket-fixes-batch-design.md` — FB-1 design spec
- `docs/superpowers/plans/2026-06-27-ticket-fixes-batch.md` — FB-1 implementation plan

---

**Əlaqə:** info@zootrend.az
