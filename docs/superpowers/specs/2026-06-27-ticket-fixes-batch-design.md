# Ticket System Fixes Batch — Design

**Tarix:** 2026-06-27
**Status:** APPROVED (brainstorming → design)
**Repo-lar:** `Ticket-Backend` + `Ticket-Frontend`

---

## 1. Xülasə

İstifadəçi tərəfindən test zamanı aşkar edilmiş 9 bug/feature-ı əhatə edən tək spec. Hər task kiçik və müstəqil görünür, amma bəziləri (Task 1 + 4) cascading logic ilə bir-birinə bağlıdır. Bir session-da, bir plan ilə, subagent-driven workflow ilə icra olunacaq.

| # | Task | Tip | Prioritet |
|---|------|-----|-----------|
| 1 | Admin Şirkətlər status badge — User.isVerified göstər | UI + Backend populate | High |
| 2 | Reset password → auto-verify email | Backend | High |
| 3 | Admin Şirkətlər email sütunu User.email göstər | UI + Backend populate | High |
| 4 | Şirkət deaktiv → User də bloklanır (cascading) | Backend | Critical |
| 5 | Şirkət reaktiv button | UI + Backend | Medium |
| 6 | Müraciət sayı sütunu (sortable) | UI + Backend aggregation | Medium |
| 7 | Admin Müraciətlər pagination verify | Manual smoke | Low |
| 8 | Admin Şirkətlər pagination verify | Manual smoke | Low |
| 9 | User Müraciətlərim pagination verify | Manual smoke | Low |

**Pagination (Tasks 7-9):** Mövcud implementasiya artıq düzgündür (`totalPages > 1` şərti, `limit=20`). Kod dəyişikliyi yoxdur, yalnız manual smoke test ilə təsdiq.

---

## 2. Motiv və Hədəflər

### Mövcud vəziyyət (bug-lar)
1. **User register → OTP verify etmir → admin Şirkətlər səhifəsində "Aktiv" görünür.** Real vəziyyət: email hələ təsdiqlənməyib. Admin üçün yanıldıcıdır.
2. **User OTP verify etmir → forgot-password ilə şifrə sıfırlayır → login olmaq istəyir → "Email təsdiqlənməyib" xətası.** Reset OTP artıq email sahibliyini sübut edir, deməli verify sayılmalıdır.
3. **Admin Şirkətlər Email sütunu "-" göstərir.** Səbəb: backend `Company.contactEmail`-i qaytarır (null, çünki register zamanı set olunmur), `User.email` isə populate edilmir.
4. **Admin şirkəti deaktiv edir, user hələ də login ola bilir.** Səbəb: `Company.isActive=false` olur, `User.isActive=true` qalır. Login endpoint yalnız `User.isActive` yoxlayır.
5. **Passiv şirkəti reaktiv etmək mümkün deyil.** DELETE yalnız soft-delete edir, PUT `isActive=true` qəbul edir amma UI button yoxdur.
6. **Admin şirkətin neçə müraciəti olduğunu görmür.** Əlavə məlumat lazımdır.
7-9. **Pagination mövcuddur amma manual smoke test edilməyib.**

### Hədəflər
- Admin panel Şirkətlər səhifəsi **tam informasiyalı** və **əməliyyat yönümlü** olsun
- User account state-i **single source of truth** prinsipi ilə idarə olunsun (Company deaktiv → User də deaktiv)
- Mövcud **89 backend test** qorunsun + ~22 yeni test əlavə olunsun (~111 cəmi)
- Mövcud **bütün SP1-SP7 flow** regression olmasın

---

## 3. Arxitektura və Data Model

### 3.1 Model dəyişiklikləri
**Heç bir schema dəyişikliyi yoxdur.** `User.isVerified`, `User.isActive`, `Company.isActive` artıq mövcuddur.

### 3.2 State cədvəli

| Action | User.isActive | User.isVerified | Company.isActive |
|--------|---------------|-----------------|------------------|
| Register | true (default) | **false** (default) | true (default) |
| Register + verify-otp | true | **true** | true |
| Forgot + reset-password (user not verified) | true | **true** (Task 2) | true |
| Admin PUT company `isActive=true` (reaktiv) | **true** (cascade) | (dəyişmir) | **true** (cascade) |
| Admin PUT company `isActive=false` | **false** (cascade) | (dəyişmir) | **false** (cascade) |
| Admin DELETE company | **false** (cascade) | (dəyişmir) | **false** (soft delete) |

### 3.3 Cascading Logic əsas prinsipi
- `Company.isActive=false` → `User.isActive=false` (eyni request-də, eager)
- `Company.isActive=true` → `User.isActive=true` (eyni request-də, eager)
- **Eager cascade** seçildi: atomic əməliyyat (ya hər ikisi uğurlu, ya heç biri). Gələcəkdə lazy middleware lazım olarsa əlavə oluna bilər (YAGNI).

---

## 4. API Dəyişiklikləri

### 4.1 `POST /api/auth/reset-password` (Task 2)

**Cari davranış:**
```js
await User.updateOne({ email }, { password: hashed });
```

**Yeni davranış:**
```js
await User.updateOne({ email }, { password: hashed, isVerified: true });
```

**Səbəb:** Reset OTP-si email sahibliyini sübut edir. Idempotent — artıq verified user üçün heç bir yan təsiri yoxdur.

**Cavab mesajı dəyişir:**
- Köhnə: `'Şifrə uğurla dəyişdirildi. İndi login ola bilərsiniz.'`
- Yeni: `'Şifrə uğurla dəyişdirildi və email təsdiqləndi. İndi login ola bilərsiniz.'`

### 4.2 `POST /api/auth/login` (Task 4 mesaj fix)

**Cari mesaj:** `'Hesab deaktiv edilib'`
**Yeni mesaj:** `'Hesabınız deaktiv edilib'`

Yalnız text dəyişikliyi. Backend logic eyni qalır.

### 4.3 `DELETE /api/companies/:id` (Task 4 cascade)

**Cari:**
```js
const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
res.json({ success: true, message: 'Şirkət deaktiv edildi' });
```

**Yeni:**
```js
const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
if (!company) return res.status(404)...;
await User.updateOne({ companyId: company._id }, { isActive: false }); // ← cascade
res.json({ success: true, message: 'Şirkət və istifadəçi hesabı deaktiv edildi' });
```

### 4.4 `PUT /api/companies/:id` (Task 5 reaktiv + cascade)

**Cari:** displayName, contactEmail, contactPhone, isActive update edilir. Yalnız `User.companyName` sync olunur.

**Yeni:** `isActive` parametri dəyişdirildikdə eyni zamanda `User.isActive` cascade olunur:

```js
if (isActive !== undefined) {
  update.isActive = isActive;
  await User.updateOne({ companyId: company._id }, { isActive }); // ← cascade
}
```

**Qeyd:** Mövcud `displayName` update sonrası `User.companyName` sync qorunur.

### 4.5 `GET /api/companies` (Task 6 ticket count + Task 1/3 populate)

**Cari:** Sadə populate ilə `ownerUserId: 'firstName lastName email'`.

**Yeni:** Aggregation pipeline ilə:
- `ownerUserId: 'firstName lastName email isVerified'` populate (Tasks 1 + 3)
- `$lookup` ilə hər şirkətin ticket sayı (Task 6)
- Sort parametri: `?sortBy=ticketCount|createdAt&order=asc|desc` (Task 6)

```js
const companies = await Company.aggregate([
  { $match: query },
  { $sort: { createdAt: -1 } }, // initial sort (overridden by sortBy)
  { $skip: skip },
  { $limit: parseInt(limit, 10) },
  {
    $lookup: {
      from: 'tickets',
      localField: '_id',
      foreignField: 'companyId',
      as: 'tickets',
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'ownerUserId',
      foreignField: '_id',
      as: 'ownerUserId',
    },
  },
  { $unwind: { path: '$ownerUserId', preserveNullAndEmptyArrays: true } },
  {
    $project: {
      displayName: 1, originalName: 1, contactEmail: 1, contactPhone: 1,
      isActive: 1, createdAt: 1, updatedAt: 1,
      'ownerUserId._id': 1,
      'ownerUserId.firstName': 1,
      'ownerUserId.lastName': 1,
      'ownerUserId.email': 1,
      'ownerUserId.isVerified': 1,
      ticketCount: { $size: '$tickets' }, // ← Task 6
    },
  },
  { $sort: { [sortField]: sortOrder === 'asc' ? 1 : -1 } },
]);
```

**Query params:**
| Param | Tip | Default | Notes |
|-------|-----|---------|-------|
| `search` | string | - | displayName/originalName/contactEmail `$or` regex |
| `status` | enum | - | `active`/`passive`/`all` (mövcud) |
| `sortBy` | enum | `createdAt` | `createdAt` və ya `ticketCount` |
| `order` | enum | `desc` | `asc`/`desc` |
| `page` | int | `1` | Mövcud |
| `limit` | int | `20` | Mövcud |

**Validation:** `sortBy` yalnız `createdAt` və ya `ticketCount`; `order` yalnız `asc`/`desc`. Yanlış dəyər default-a düşür (silent — defensive programming).

### 4.6 Dəyişməyən endpoint-lər

| Endpoint | Səbəb |
|----------|-------|
| `POST /api/auth/register` | Mövcud `User.isVerified: false` default artıq düzgündür |
| `POST /api/auth/verify-otp` | Artıq `isVerified: true` set edir |
| `POST /api/auth/resend-otp` | Dəyişiklik yoxdur |
| `GET /api/auth/me` | Artıq `isVerified` qaytarır |
| `POST /api/admin/auth/login` | Admin üçün ayrıca auth flow |
| `GET /api/tickets` | Mövcud pagination işləyir (Task 7-9) |
| `POST /api/tickets` | Mövcud işləyir |
| `PATCH /api/tickets/:id/status` | Mövcud işləyir |
| `DELETE /api/tickets/:id` | Mövcud işləyir |
| `GET /api/stats` | Mövcud işləyir |
| `GET /api/comments/*` | Mövcud işləyir |

---

## 5. Frontend UI Dəyişiklikləri

### 5.1 `pages/AdminCompanies.js` — Əsas dəyişiklik

#### Cədvəl strukturu (Tasks 1, 3, 5, 6)

| Sütun | Genişlik | Mənbə | Status |
|-------|----------|-------|--------|
| Şirkət adı | `flex-1` | `c.displayName` | Mövcud |
| Owner | `flex-1` | `c.ownerUserId.firstName lastName` | Mövcud |
| **Email** | `flex-1` | **`c.ownerUserId.email`** | **Task 3 dəyişir** |
| **Status** | `flex-1` | computed | **Task 1 dəyişir** |
| **Müraciət sayı** | `w-32` | `c.ticketCount` | **Task 6 yeni** |
| Əməliyyat | `w-32` | - | **Task 5 dəyişir** |

#### Task 1 — Status badge komponenti

```js
const STATUS_BADGES = {
  active_verified: { label: 'Təsdiqlənmiş', className: 'bg-green-100 text-green-700' },
  active_unverified: { label: 'Doğrulanmamış', className: 'bg-yellow-100 text-yellow-700' },
  passive: { label: 'Passiv', className: 'bg-slate-100 text-slate-600' },
};

function getStatusKey(company) {
  if (!company.isActive) return 'passive';
  if (company.ownerUserId?.isVerified) return 'active_verified';
  return 'active_unverified';
}
```

JSX:
```jsx
<td>
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[getStatusKey(c)].className}`}>
    {STATUS_BADGES[getStatusKey(c)].label}
  </span>
</td>
```

#### Task 3 — Email sütunu (User.email)

```jsx
<td className="px-4 py-3 text-sm text-slate-600">{c.ownerUserId?.email || '-'}</td>
```

#### Task 5 — Reaktiv button

```jsx
{c.isActive ? (
  <button onClick={() => handleDeactivate(c)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Deaktiv et">
    <Power className="w-4 h-4" />
  </button>
) : (
  <button onClick={() => handleReactivate(c)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Aktivləşdir">
    <Power className="w-4 h-4" />
  </button>
)}
```

`handleReactivate` funksiyası:
```js
const handleReactivate = async (company) => {
  if (!window.confirm(`${company.displayName} şirkətini yenidən aktivləşdirmək istədiyinizə əminsiniz?`)) return;
  try {
    await adminApi.put(`/companies/${company._id}`, { isActive: true });
    toast.success('Şirkət və istifadəçi hesabı yenidən aktivləşdirildi');
    fetchCompanies();
  } catch (error) {
    toast.error('Aktivləşdirmə uğursuz oldu');
  }
};
```

#### Task 6 — Müraciət sayı sütunu + sort

State:
```js
const [sortBy, setSortBy] = useState('createdAt');
const [order, setOrder] = useState('desc');
```

Fetch params:
```js
const params = { page, limit, sortBy, order };
```

Header (kliklənə bilən):
```jsx
<th onClick={() => handleSort('ticketCount')} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100">
  <div className="flex items-center gap-1">
    Müraciət sayı
    {sortBy === 'ticketCount' && (order === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
  </div>
</th>
```

`handleSort`:
```js
const handleSort = (field) => {
  if (sortBy === field) {
    setOrder(order === 'desc' ? 'asc' : 'desc');
  } else {
    setSortBy(field);
    setOrder('desc');
  }
  setPage(1);
};
```

Cell:
```jsx
<td className="px-4 py-3 text-sm text-slate-900 font-medium">{c.ticketCount}</td>
```

### 5.2 `pages/UserLogin.js` — Dəyişiklik yoxdur

Mövcud error rendering işləyir. Yalnız backend mesajı dəyişir (`'Hesab deaktiv edilib'` → `'Hesabınız deaktiv edilib'`). Frontend hər iki halda qırmızı banner göstərir.

### 5.3 `pages/UserRegister.js` — Dəyişiklik yoxdur

Mövcud flow düzgündür: register → `/verify-otp` navigate. Backend artıq `isVerified: false` default edir.

### 5.4 `pages/UserResetPassword.js` — Toast text (opsional)

Mövcud toast: `'Şifrə uğurla dəyişdirildi! İndi login ola bilərsiniz.'`
Yeni toast: `'Şifrə uğurla dəyişdirildi və email təsdiqləndi. İndi login ola bilərsiniz.'`

User-a aydın feedback verir ki, OTP təsdiqlənməsi də baş verib.

### 5.5 Pagination səhifələri — Tasks 7-9

Heç bir dəyişiklik yoxdur. Mövcud implementasiya artıq düzgündür:

```jsx
{totalPages > 1 && (
  <div className="...">
    <button onClick={() => setPage(page - 1)}>Əvvəlki</button>
    <span>Səhifə {page} / {totalPages}</span>
    <button onClick={() => setPage(page + 1)}>Növbəti</button>
  </div>
)}
```

Yalnız manual smoke test ilə təsdiqlənir.

---

## 6. Error Handling

### Backend xəta mesajları (cədvəl)

| Ssenari | Status | Mesaj (AZ) | Source |
|---------|--------|------------|--------|
| Register — duplicate email | 400 | `Bu e-poçt ilə istifadəçi artıq mövcuddur` | Mövcud |
| Register — uğurlu | 201 | `Qeydiyyat uğurla başa çatdı. Email ünvanınıza göndərilmiş OTP kodunu daxil edin.` | Mövcud |
| Verify OTP — yanlış | 400 | `OTP yanlışdır` | Mövcud |
| Verify OTP — vaxtı keçib | 400 | `OTP-nin vaxtı keçib` | Mövcud |
| Verify OTP — çox cəhd | 429 | `Çoxlu yanlış cəhd. Yeni OTP tələb edin.` | Mövcud |
| Login — email təsdiqlənməyib | 403 | `Email təsdiqlənməyib. OTP kodunu yoxlayın.` | Mövcud |
| **Login — hesab deaktiv** | 403 | **`Hesabınız deaktiv edilib`** | **Task 4 (dəyişir)** |
| Reset password — uğurlu | 200 | **`Şifrə uğurla dəyişdirildi və email təsdiqləndi. İndi login ola bilərsiniz.`** | **Task 2 (dəyişir)** |
| Forgot password — email mövcud deyil | 200 | `Əgər email mövcuddursa, reset kodu göndərildi` | Mövcud (email enumeration qarşısının alınması) |
| **Delete company — uğurlu** | 200 | **`Şirkət və istifadəçi hesabı deaktiv edildi`** | **Task 4 (dəyişir)** |
| **Reactivate company — uğurlu** | 200 | **`Şirkət və istifadəçi hesabı yenidən aktivləşdirildi`** | **Task 5 (dəyişir)** |

### Frontend xəta rendering

**UserLogin.js (Task 4):**
- Mövcud error banner-i backend mesajını göstərir (`errorMessage` state)
- Yalnız backend text dəyişir, frontend dəyişmir
- **Verify:** manual smoke test ilə deaktiv user login olmağa çalışdıqda "Hesabınız deaktiv edilib" qırmızı banner görsənir

**AdminCompanies.js (Tasks 4, 5):**
- `window.confirm` modal hər iki action üçün
- Uğur: `toast.success`
- Xəta: `toast.error(error.response?.data?.message)`

**UserResetPassword.js (Task 2 — opsional):**
- `toast.success` mesajı yeni text ilə

### Edge case-lər

| Case | Davranış | Notes |
|------|----------|-------|
| User artıq verified + şifrə sıfırlama | `isVerified=true` set et (idempotent) | OK |
| Şirkət mövcud deyil | `404` qaytar, user update çağırılmasın | Mövcud pattern |
| Bir neçə user eyni şirkətdə | Mümkün deyil (`Company.ownerUserId` unique index) | DB constraint |
| Admin user-i manual deaktiv etmək istəyir | Mövcud `User.isActive=false` UI yoxdur (YAGNI) | Gələcək task |
| Ticket count = 0 olan şirkət | Badge "0" göstərir, sort düzgün işləyir | OK |
| Sort digər sütunlar (displayName, contactEmail) | Mövcud default `createdAt: -1` qorunur | Yalnız `ticketCount` + `createdAt` sort edilə bilər |
| Pagination səhifələri (Tasks 7-9) | Mövcud implementasiya işləyir, verify lazımdır | Manual smoke |

### Validation (express-validator)

- Mövcud `updateValidation` (`companies.js:7-12`) artıq `isActive.isBoolean()` yoxlayır
- `resetPasswordValidation` mövcuddur, dəyişiklik yoxdur
- **Yeni:** `sortBy` və `order` üçün inline whitelist (silent fallback to default)

---

## 7. Testing Strategiyası

### 7.1 Backend Tests (TDD red-green-refactor)

**Yeni test faylı: `Backend/tests/auth-cascade.test.js`** (~140 sətir, 8 test)
- Task 2 + 4 backend logic
- 1. Reset-password uğurlu + `isVerified=true` ✅
- 2. Reset-password yanlış OTP → `isVerified` dəyişmir
- 3. Reset sonrası login uğurlu (əvvəl 403 idi)
- 4. Reset sonrası login 401 yanlış şifrə (köhnə şifrə işləmir)
- 5. Login sonrası User.isActive=false → 403 "Hesabınız deaktiv edilib"
- 6. Login sonrası User.isActive=true → 200
- 7. Login mesajı exact text yoxlaması
- 8. Reset-password message exact text yoxlaması

**Yeni test faylı: `Backend/tests/companies-cascade.test.js`** (~110 sətir, 6 test)
- Task 4 + 5 backend cascade logic
- 1. DELETE company → `Company.isActive=false` + `User.isActive=false` (cascade)
- 2. DELETE sonrası User login cəhdi → 403 (end-to-end Task 4)
- 3. PUT company `isActive=true` (reaktiv) → hər ikisi `isActive=true`
- 4. PUT company `isActive=false` → hər ikisi `isActive=false`
- 5. DELETE sonrası reaktiv → User login olur
- 6. PUT `displayName` dəyişikliyi → `User.companyName` sync olunur (regression)

**Yeni test faylı: `Backend/tests/companies-ticket-count.test.js`** (~120 sətir, 6 test)
- Task 6 backend aggregation
- 1. GET /api/companies → `ticketCount` field hər şirkətdə mövcuddur
- 2. 0 ticket olan şirkət → `ticketCount=0`
- 3. 5 ticket olan şirkət → `ticketCount=5`
- 4. ?sortBy=ticketCount&order=desc → ən çox ticket birinci
- 5. ?sortBy=ticketCount&order=asc → ən az ticket birinci
- 6. Default sort `createdAt` qorunur (sortBy olmadan)

**Yenilənən test faylı: `Backend/tests/companies.test.js`** (+2 test)
- Task 1 + 3 populate
- 1. GET /api/companies → `ownerUserId.isVerified` field mövcuddur
- 2. GET /api/companies → `ownerUserId.email` User.email-dən gəlir (Company.contactEmail fərqli ola bilər)

**Cəmi yeni test: ~22**

### 7.2 Manual Browser Smoke Test (10 ssenari)

1. **Task 1 — Status badge:**
   - Register new user → verify etmə → admin panel Şirkətlər → status badge "Doğrulanmamış" (sarı) ✅
   - Verify OTP → status badge "Təsdiqlənmiş" (yaşıl) ✅
   - Admin şirkəti deaktiv et → status badge "Passiv" (boz) ✅

2. **Task 2 — Reset auto-verify:**
   - Register new user → verify etmə → login səhifəsi → "Şifrəni unutdum" → email + OTP + new password → success toast → login səhifəsi → login olur ✅

3. **Task 3 — Email sütunu:**
   - Admin panel Şirkətlər → Email sütununda User.email görünür (əvvəl "-" idi) ✅

4. **Task 4 — Deaktiv blok:**
   - Admin Şirkətlər → şirkəti deaktiv et → User login səhifəsi → 403 "Hesabınız deaktiv edilib" banner ✅

5. **Task 5 — Reaktiv:**
   - Admin Şirkətlər → Passiv şirkət → "Power" button (yaşıl) → confirm → "Şirkət və istifadəçi hesabı yenidən aktivləşdirildi" → User login olur ✅

6. **Task 6 — Müraciət sayı:**
   - Admin Şirkətlər → yeni sütun "Müraciət sayı" → hər şirkətin sayı ✅
   - Sütun başlığına klik → ▼▲ sort (asc/desc) ✅

7. **Task 7 — Admin Müraciətlər pagination:**
   - Real DB-də 21+ ticket yarat (və ya limit=2 ilə test et) → pagination görsənir ✅

8. **Task 8 — Admin Şirkətlər pagination:**
   - 21+ şirkət yarat → pagination görsənir ✅

9. **Task 9 — User Müraciətlərim pagination:**
   - User 21+ ticket yarat → pagination görsənir ✅

10. **Regression — mövcud testlər:**
    - Register → verify → login → ticket yarat → admin status dəyişdir → user görür (bütün mövcud SP1-SP7 flow işləyir) ✅

### 7.3 Test İnfrastruktur

- Backend: `tests/setup.js` mövcud (mongodb-memory-server + supertest) — yeni test faylları eyni pattern istifadə edir
- Mock: `jest.mock('../services/emailService', ...)` mövcud `auth.test.js`-də — yeni testlərdə də istifadə olunur
- Frontend test: mövcud deyil, yalnız manual smoke (YAGNI)

### 7.4 TDD Yanaşması

Bütün backend tasklar TDD red-green-refactor:
1. Əvvəlcə test yaz (failing — `expect(res.status).toBe(X)` artıq X-dən fərqli)
2. Implementation yaz (test pass)
3. Refactor (test hələ pass, code clean)
4. Code review (subagent 2-ci agent ilə)

---

## 8. Implementation Plan Xülasəsi

**Cəmi ~13 implementation task (2 repo, ~30 commit):**

| # | Task | Repo | Tip | Təxmini vaxt |
|---|------|------|-----|---------------|
| T1 | `tests/auth-cascade.test.js` (failing) | Backend | TDD red | 15 dəq |
| T2 | Reset-password + login msg + verifyOTP fix | Backend | TDD green | 15 dəq |
| T3 | `tests/companies-cascade.test.js` (failing) | Backend | TDD red | 15 dəq |
| T4 | Companies DELETE/PUT cascade logic | Backend | TDD green | 20 dəq |
| T5 | `tests/companies-ticket-count.test.js` (failing) | Backend | TDD red | 20 dəq |
| T6 | Companies GET aggregation ($lookup + sort) | Backend | TDD green | 25 dəq |
| T7 | `companies.test.js`: populate testləri əlavə | Backend | TDD green | 10 dəq |
| T8 | Spec + Plan commit | Both | Docs | 5 dəq |
| T9 | AdminCompanies: badge + email sütun + count sütun | Frontend | UI | 25 dəq |
| T10 | AdminCompanies: sort (▼▲) + reaktiv button | Frontend | UI | 25 dəq |
| T11 | UserResetPassword: toast text | Frontend | UI | 5 dəq |
| T12 | Tam smoke test (10 ssenari) | Manual | Verify | 20 dəq |
| T13 | Final code review + commit | Both | Cleanup | 10 dəq |

**Test artımı:** 89 + 22 = ~111 backend test PASS, 0 regression.

**Ümumi təxmini vaxt:** 3-4 saat (subagent-driven, paralel işləyə bilən tasklar T1-T7 eyni session-da, T9-T11 eyni session-da).

---

## 9. Out of Scope (Gələcək tasklar)

Aşkar edilmiş, amma bu spec-ə daxil edilməmiş tasklar:

1. **Manual User deactivation endpoint** — Admin User.isActive-i ayrıca dəyişə bilmir (cascading avtomatikdir). Əgər lazım olarsa, `PUT /api/admin/users/:id {isActive: false}` əlavə oluna bilər.
2. **User model-də displayId** — Mövcud strukturda User-un public ID-si yoxdur (MongoDB `_id` istifadə olunur). Gələcəkdə `User.displayId` (məs. `USR-NNN`) əlavə oluna bilər.
3. **Email dəyişikliyi sonrası re-verify** — User email dəyişdirə bilmir (mövcud scope xaricidir). Əgər əlavə olunarsa, avtomatik `isVerified=false` olmalıdır.
4. **Audit log** — Kim nə zaman deaktiv/reaktiv etdi — gələcəkdə əlavə oluna bilər.
5. **Email notification on deactivation** — User-ə email göndərilmir deaktiv olunduqda. Gələcəkdə email template əlavə oluna bilər.
6. **`isVerified` filter in admin search** — Mövcud search `displayName/originalName/contactEmail` axtarır. `ownerUserId.email` və ya `isVerified` filter əlavə oluna bilər.
7. **Pagination page size selector** — Mövcud `limit=20` sabitdir. Gələcəkdə 10/20/50 dropdown əlavə oluna bilər.

---

## 10. Success Criteria

Bu spec uğurlu sayılır əgər:

- [ ] Bütün 9 task istifadəçi tərəfindən manual test edilib ✅
- [ ] Bütün yeni backend testlər PASS (~22 yeni)
- [ ] Mövcud 89 backend test heç biri broken deyil
- [ ] Heç bir SP1-SP7 regression yoxdur (manual smoke test)
- [ ] Admin Şirkətlər səhifəsi bütün 3-state badge, email, ticket count, sort, reaktiv button ilə işləyir
- [ ] User deaktiv olduqda login bloklanır və düzgün mesaj göstərilir
- [ ] Reset password sonrası email avtomatik təsdiqlənir

---

## 11. Risk Analysis

| Risk | Ehtimal | Təsir | Azaltma |
|------|---------|-------|---------|
| Aggregation pipeline performance (Task 6) | Orta | Aşağı | `$lookup` `tickets` collection-dan bütün ticket-ləri çəkir, amma yalnız `$size` istifadə edir (yaddaş). Mövcud data ölçüsü üçün OK (89 test + production ~yüz ticket). Gələcəkdə `count` istifadə oluna bilər. |
| Cascade `User.updateOne` race condition | Aşağı | Orta | Atomic deyil (2 ayrı update). 1 şirkət = 1 user (unique index), race yoxdur. |
| Frontend sort deep-link | Aşağı | Aşağı | URL query sync YAGNI. Pagination filter dəyişəndə page reset edilir. |
| `Company.findByIdAndUpdate` olduqdan sonra user update fail | Çox aşağı | Orta | Production logging ilə izlənilir. Gələcəkdə transaction əlavə oluna bilər (MongoDB session istifadə edərək). |
| `ownerUserId.isVerified` undefined qaytarır (user silinib) | Aşağı | Aşağı | Mövcud `preserveNullAndEmptyArrays: true` ilə `null` olur, frontend `?.` ilə idarə edir. |
| Pagination real DB-də 21+ record yoxdur | Orta | Aşağı | Test limit=2 ilə manual edilə bilər (browser DevTools). Smoke test ssenari 7-9. |

---

## 12. Əlaqəli Sənədlər

- `Ticket-Backend/CONTEXT.md` — Mövcud backend status (SP1-SP7 tamamlanıb)
- `Ticket-Frontend/CONTEXT.md` — Mövcud frontend status (SP1-SP7 tamamlanıb)
- `docs/superpowers/plans/2026-06-27-ticket-fixes-batch.md` — Implementation plan (bu spec-dən sonra yaradılacaq)

---

**Son:** Bu sənəd 9 task-ın tam dizayn sənədidir — brainstorming (5 hissəli dizayn təsdiqi) → bu sənəd. İstifadəçi review etdikdən sonra `writing-plans` skill-ə keçid.
