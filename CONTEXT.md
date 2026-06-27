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

## Nədir Bu Repo?

- **Backend-only** — `frontend/` və monorepo faylları bu repo-da YOXDUR
- Frontend repo ayrıdır: `ticket-system-frontend`
- **89 backend test PASS, 0 regression**
- **Real Atlas DB ilə end-to-end smoke test uğurlu**

## Texniki Stack

- Node.js 20+ / Express 4.18 / Mongoose 8
- jsonwebtoken (2 secret: user 24h, admin 12h)
- bcryptjs (10 rounds)
- nodemailer (SMTP/SSL 465, Namecheap Private Email)
- multer (UUID filename, mime/ext whitelist, 2MB/file, 5 files max)
- express-validator
- Jest + Supertest + mongodb-memory-server (in-memory)

## Quraşdırma

README.md faylına baxın.

## Deployment

Production üçün Railway/Render/Heroku + MongoDB Atlas + SMTP (SendGrid/SES).

---

**Əlaqə:** info@zootrend.az
