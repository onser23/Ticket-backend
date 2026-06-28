# Ticket Fixes Batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 user-reported bug/feature-ı düzəlt — User verification status düzgün göstərilməsi, şifrə sıfırlama auto-verify, şirkət deaktiv cascading, reaktiv button, ticket count sütunu, pagination verify.

**Architecture:** Backend-də cascading logic (Company.isActive ↔ User.isActive), User populate-də isVerified+email, MongoDB $lookup ilə ticketCount. Frontend-də AdminCompanies cədvəlində 3-state badge + sort + reaktiv button. TDD red-green-refactor pattern.

**Tech Stack:** Node.js 20+, Express 4.18, Mongoose 8, Jest + Supertest + mongodb-memory-server (backend); React 19, Tailwind 3.4, lucide-react (frontend).

---

## Fayl Strukturu

**Yaradılacaq fayllar (Backend):**
- `Backend/tests/auth-cascade.test.js` — Task 2 + 4 backend tests (8 test)
- `Backend/tests/companies-cascade.test.js` — Tasks 4 + 5 cascade tests (6 test)
- `Backend/tests/companies-ticket-count.test.js` — Task 6 aggregation tests (6 test)

**Dəyişdiriləcək fayllar (Backend):**
- `Backend/routes/auth.js` — Tasks 2 + 4 (reset-password isVerified + login message)
- `Backend/routes/companies.js` — Tasks 4 + 5 + 6 (cascade + aggregation + sort)
- `Backend/tests/companies.test.js` — Tasks 1 + 3 populate tests (+2 test)

**Dəyişdiriləcək fayllar (Frontend):**
- `Frontend/src/pages/AdminCompanies.js` — Tasks 1 + 3 + 5 + 6 (badge, email, sort, reaktiv button)
- `Frontend/src/pages/UserResetPassword.js` — Task 2 toast text

**Dəyişdirilməyəcək fayllar:**
- Mövcud pagination (Tasks 7-9) artıq düzgün işləyir — manual smoke test ilə təsdiqlənir
- UserLogin, UserRegister, AdminTickets, UserTickets — backend mesajı dəyişir, frontend eyni qalır

---

## Task 1: Auth Cascade Backend Tests (TDD red)

**Files:**
- Create: `Backend/tests/auth-cascade.test.js`

**Goal:** Task 2 (reset-password auto-verify) və Task 4 (login message) üçün failing tests yaz.

- [ ] **Step 1: Test faylını yarat**

`Backend/tests/auth-cascade.test.js` faylına aşağıdakı kodu yaz:

```js
const request = require('supertest');
const app = require('../server');
const setup = require('./setup');

jest.mock('../services/emailService', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const { sendOtpEmail } = require('../services/emailService');
const User = require('../models/User');

beforeAll(async () => {
  await setup.connect();
});

afterAll(async () => {
  await setup.close();
});

afterEach(async () => {
  await setup.clear();
  jest.clearAllMocks();
});

describe('POST /api/auth/reset-password — auto-verify (Task 2)', () => {
  test('reset-password uğurlu → User.isVerified=true olur', async () => {
    // Register (no verify)
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov',
      email: 'ali@test.az', password: 'oldpass', companyName: 'Test MMC',
    });

    // Forgot + reset
    await request(app).post('/api/auth/forgot-password').send({ email: 'ali@test.az' });
    const resetCode = sendOtpEmail.mock.calls[sendOtpEmail.mock.calls.length - 1][0].code;

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'ali@test.az', code: resetCode, newPassword: 'newpass123',
    });

    expect(res.status).toBe(200);
    const updated = await User.findOne({ email: 'ali@test.az' });
    expect(updated.isVerified).toBe(true); // ← Task 2 fix
  });

  test('reset-password uğurlu → cavab mesajı yeni text ilə', async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov',
      email: 'ali@test.az', password: 'oldpass', companyName: 'Test MMC',
    });
    await request(app).post('/api/auth/forgot-password').send({ email: 'ali@test.az' });
    const resetCode = sendOtpEmail.mock.calls[sendOtpEmail.mock.calls.length - 1][0].code;

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'ali@test.az', code: resetCode, newPassword: 'newpass123',
    });

    expect(res.body.message).toMatch(/email təsdiqləndi/);
  });

  test('reset-password yanlış OTP → User.isVerified=false qalır', async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov',
      email: 'ali@test.az', password: 'oldpass', companyName: 'Test MMC',
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'ali@test.az', code: '000000', newPassword: 'newpass123',
    });

    expect(res.status).toBe(400);
    const user = await User.findOne({ email: 'ali@test.az' });
    expect(user.isVerified).toBe(false);
  });

  test('reset-password sonrası login uğurlu (əvvəl 403 idi)', async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov',
      email: 'ali@test.az', password: 'oldpass', companyName: 'Test MMC',
    });
    await request(app).post('/api/auth/forgot-password').send({ email: 'ali@test.az' });
    const resetCode = sendOtpEmail.mock.calls[sendOtpEmail.mock.calls.length - 1][0].code;
    await request(app).post('/api/auth/reset-password').send({
      email: 'ali@test.az', code: resetCode, newPassword: 'newpass123',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'ali@test.az', password: 'newpass123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
  });
});

describe('POST /api/auth/login — deaktiv message (Task 4)', () => {
  test('User.isActive=false → 403 "Hesabınız deaktiv edilib"', async () => {
    const user = await User.create({
      firstName: 'Vəli', lastName: 'Əliyev',
      email: 'veli@test.az', password: 'hashed', companyName: 'Vəli MMC',
      isVerified: true, isActive: false,
    });

    const { hashPassword } = require('../utils/password');
    user.password = await hashPassword('test123');
    await user.save();

    const res = await request(app).post('/api/auth/login').send({
      email: 'veli@test.az', password: 'test123',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Hesabınız deaktiv edilib');
  });

  test('User.isActive=true → 200', async () => {
    const { hashPassword } = require('../utils/password');
    await User.create({
      firstName: 'Aktiv', lastName: 'User',
      email: 'aktiv@test.az', password: await hashPassword('test123'),
      companyName: 'Aktiv MMC', isVerified: true, isActive: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'aktiv@test.az', password: 'test123',
    });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/register — User.isVerified default false', () => {
  test('register sonrası User.isVerified=false (Task 1 üçün zəruri)', async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Yeni', lastName: 'User',
      email: 'yeni@test.az', password: 'test123', companyName: 'Yeni MMC',
    });

    const user = await User.findOne({ email: 'yeni@test.az' });
    expect(user.isVerified).toBe(false);
  });
});
```

- [ ] **Step 2: Testləri işlət və FAIL olduğunu təsdiqlə**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=auth-cascade`
Expected: 6 FAIL (Test 1: isVerified true olmayacaq; Test 2: mesaj uyğun olmayacaq; Test 4: login 403 qaytaracaq; Test 5: mesaj exact match olmayacaq; Test 6: pass; Test 7: pass)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add tests/auth-cascade.test.js
git commit -m "test(auth): add cascade tests for reset-password + deactive message (Tasks 2, 4)"
```

---

## Task 2: Auth Reset-Password + Login Message Fix (TDD green)

**Files:**
- Modify: `Backend/routes/auth.js:257-260` (reset-password update)

- [ ] **Step 1: Reset-password logic-ə isVerified əlavə et**

`Backend/routes/auth.js` faylında, `reset-password` route-unun daxilində (line ~257):

Cari:
```js
const hashed = await hashPassword(newPassword);
await User.updateOne({ email }, { password: hashed });
```

Bunu əvəz et:
```js
const hashed = await hashPassword(newPassword);
await User.updateOne({ email }, { password: hashed, isVerified: true });
```

- [ ] **Step 2: Reset-password cavab mesajını dəyiş**

Eyni route-da, `res.json` sətirindən əvvəl:

Cari:
```js
res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi. İndi login ola bilərsiniz.' });
```

Bunu əvəz et:
```js
res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi və email təsdiqləndi. İndi login ola bilərsiniz.' });
```

- [ ] **Step 3: Login message dəyiş**

`Backend/routes/auth.js` faylında, `login` route-unun daxilində (~line 173):

Cari:
```js
if (!user.isActive) {
  return res.status(403).json({ success: false, message: 'Hesab deaktiv edilib' });
}
```

Bunu əvəz et:
```js
if (!user.isActive) {
  return res.status(403).json({ success: false, message: 'Hesabınız deaktiv edilib' });
}
```

- [ ] **Step 4: Bütün auth testləri işlət**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=auth`
Expected: ALL PASS (auth.test.js + auth-cascade.test.js, 27 test)

- [ ] **Step 5: Mövcud 89 testlərin regression yoxlaması**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test`
Expected: 95 PASS (89 + 6 yeni), 0 FAIL

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add routes/auth.js
git commit -m "feat(auth): auto-verify email on reset-password + update deactive message (Tasks 2, 4)"
```

---

## Task 3: Companies Cascade Tests (TDD red)

**Files:**
- Create: `Backend/tests/companies-cascade.test.js`

**Goal:** Task 4 (DELETE cascade) + Task 5 (PUT reaktiv) üçün failing tests.

- [ ] **Step 1: Test faylını yarat**

`Backend/tests/companies-cascade.test.js` faylına:

```js
const request = require('supertest');
const app = require('../server');
const setup = require('./setup');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Company = require('../models/Company');
const { hashPassword } = require('../utils/password');

let adminToken;

beforeAll(async () => {
  await setup.connect();
});

afterAll(async () => {
  await setup.close();
});

beforeEach(async () => {
  await setup.clear();
  await Admin.create({
    username: 'admin',
    password: await hashPassword('admin123'),
    email: 'admin@test.az',
    fullName: 'Administrator',
  });
  const loginRes = await request(app).post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin123',
  });
  adminToken = loginRes.body.token;
});

describe('DELETE /api/companies/:id — cascade (Task 4)', () => {
  test('company deaktiv → User.isActive=false (cascade)', async () => {
    const user = await User.create({
      firstName: 'Ali', lastName: 'Babayev',
      email: 'ali@test.az', password: await hashPassword('test123'),
      companyName: 'Test MMC', isVerified: true,
    });
    const company = await Company.create({
      displayName: 'Test MMC', originalName: 'Test MMC', ownerUserId: user._id,
    });
    user.companyId = company._id;
    await user.save();

    await request(app).delete(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isActive).toBe(false); // ← cascade

    const updatedCompany = await Company.findById(company._id);
    expect(updatedCompany.isActive).toBe(false);
  });

  test('company deaktiv sonrası User login cəhdi → 403 (end-to-end)', async () => {
    const user = await User.create({
      firstName: 'Vəli', lastName: 'Əliyev',
      email: 'veli@test.az', password: await hashPassword('test123'),
      companyName: 'Vəli MMC', isVerified: true,
    });
    const company = await Company.create({
      displayName: 'Vəli MMC', originalName: 'Vəli MMC', ownerUserId: user._id,
    });
    user.companyId = company._id;
    await user.save();

    await request(app).delete(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'veli@test.az', password: 'test123',
    });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toBe('Hesabınız deaktiv edilib');
  });

  test('delete uğurlu mesajı yeni text ilə', async () => {
    const user = await User.create({
      firstName: 'Test', lastName: 'User',
      email: 'test@test.az', password: 'hashed',
      companyName: 'Test', isVerified: true,
    });
    const company = await Company.create({
      displayName: 'Test', originalName: 'Test', ownerUserId: user._id,
    });

    const res = await request(app).delete(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.message).toMatch(/istifadəçi hesabı deaktiv edildi/);
  });
});

describe('PUT /api/companies/:id — reaktiv + cascade (Task 5)', () => {
  test('isActive=true → User.isActive=true (cascade)', async () => {
    const user = await User.create({
      firstName: 'Re', lastName: 'Aktiv',
      email: 're@test.az', password: 'hashed',
      companyName: 'Re MMC', isVerified: true, isActive: false,
    });
    const company = await Company.create({
      displayName: 'Re MMC', originalName: 'Re MMC',
      ownerUserId: user._id, isActive: false,
    });

    await request(app).put(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isActive).toBe(true);
  });

  test('isActive=false → User.isActive=false (cascade)', async () => {
    const user = await User.create({
      firstName: 'De', lastName: 'Aktiv',
      email: 'de@test.az', password: 'hashed',
      companyName: 'De MMC', isVerified: true, isActive: true,
    });
    const company = await Company.create({
      displayName: 'De MMC', originalName: 'De MMC', ownerUserId: user._id,
    });

    await request(app).put(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isActive).toBe(false);
  });

  test('reaktiv sonrası User login uğurlu (end-to-end)', async () => {
    const user = await User.create({
      firstName: 'End', lastName: 'To',
      email: 'end@test.az', password: await hashPassword('test123'),
      companyName: 'End MMC', isVerified: true, isActive: false,
    });
    const company = await Company.create({
      displayName: 'End MMC', originalName: 'End MMC',
      ownerUserId: user._id, isActive: false,
    });

    await request(app).put(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'end@test.az', password: 'test123',
    });

    expect(loginRes.status).toBe(200);
  });

  test('displayName update — User.companyName sync olunur (regression)', async () => {
    const user = await User.create({
      firstName: 'Old', lastName: 'Name',
      email: 'old@test.az', password: 'hashed',
      companyName: 'OldName', isVerified: true,
    });
    const company = await Company.create({
      displayName: 'OldName', originalName: 'OldName', ownerUserId: user._id,
    });

    await request(app).put(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'NewName' });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.companyName).toBe('NewName');
  });
});
```

- [ ] **Step 2: Testləri işlət və FAIL olduğunu təsdiqlə**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=companies-cascade`
Expected: 6 FAIL (cascading hələ implement olunmayıb)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add tests/companies-cascade.test.js
git commit -m "test(companies): add cascade tests for delete + put isActive (Tasks 4, 5)"
```

---

## Task 4: Companies DELETE/PUT Cascade Logic (TDD green)

**Files:**
- Modify: `Backend/routes/companies.js:77-99` (PUT) və `Backend/routes/companies.js:101-111` (DELETE)

- [ ] **Step 1: DELETE route-da cascade əlavə et**

`Backend/routes/companies.js` faylında, `router.delete('/:id', ...)` hissəsini tap. Cari:

```js
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Şirkət tapılmadı' });
    }
    res.json({ success: true, message: 'Şirkət deaktiv edildi' });
  } catch (err) {
    next(err);
  }
});
```

Bunu əvəz et:

```js
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Şirkət tapılmadı' });
    }
    await User.updateOne({ companyId: company._id }, { isActive: false });
    res.json({ success: true, message: 'Şirkət və istifadəçi hesabı deaktiv edildi' });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: PUT route-da cascade əlavə et**

`Backend/routes/companies.js` faylında, `router.put('/:id', ...)` hissəsində, `if (isActive !== undefined) update.isActive = isActive;` sətirindən SONRA aşağıdakı sətir əlavə et:

```js
if (isActive !== undefined) {
  update.isActive = isActive;
  await User.updateOne({ companyId: company._id }, { isActive }); // ← cascade
}
```

- [ ] **Step 3: Bütün company testləri işlət**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=companies`
Expected: ALL PASS (companies.test.js + companies-cascade.test.js)

- [ ] **Step 4: Tam regression yoxlaması**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test`
Expected: 101 PASS (95 + 6 yeni), 0 FAIL

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add routes/companies.js
git commit -m "feat(companies): cascade isActive to User on delete/put (Tasks 4, 5)"
```

---

## Task 5: Companies Ticket Count Tests (TDD red)

**Files:**
- Create: `Backend/tests/companies-ticket-count.test.js`

**Goal:** Task 6 aggregation üçün failing tests.

- [ ] **Step 1: Test faylını yarat**

`Backend/tests/companies-ticket-count.test.js` faylına:

```js
const request = require('supertest');
const app = require('../server');
const setup = require('./setup');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const { hashPassword } = require('../utils/password');

let adminToken;

beforeAll(async () => {
  await setup.connect();
});

afterAll(async () => {
  await setup.close();
});

beforeEach(async () => {
  await setup.clear();
  await Admin.create({
    username: 'admin',
    password: await hashPassword('admin123'),
    email: 'admin@test.az',
    fullName: 'Administrator',
  });
  const loginRes = await request(app).post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin123',
  });
  adminToken = loginRes.body.token;
});

async function createCompanyWithTickets(email, displayName, ticketCount) {
  const user = await User.create({
    firstName: 'Owner', lastName: 'Test',
    email, password: 'hashed', companyName: displayName, isVerified: true,
  });
  const company = await Company.create({
    displayName, originalName: displayName, ownerUserId: user._id,
  });
  user.companyId = company._id;
  await user.save();

  for (let i = 0; i < ticketCount; i++) {
    await Ticket.create({
      title: `Ticket ${i}`, description: 'Test description for ticket',
      priority: 'medium', companyId: company._id, createdBy: user._id,
    });
  }
  return { user, company };
}

describe('GET /api/companies — ticketCount field (Task 6)', () => {
  test('hər şirkətdə ticketCount field mövcuddur', async () => {
    await createCompanyWithTickets('c1@test.az', 'C1', 3);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty('ticketCount', 3);
  });

  test('0 ticket olan şirkət → ticketCount=0', async () => {
    await createCompanyWithTickets('c0@test.az', 'C0', 0);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].ticketCount).toBe(0);
  });

  test('5 ticket olan şirkət → ticketCount=5', async () => {
    await createCompanyWithTickets('c5@test.az', 'C5', 5);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].ticketCount).toBe(5);
  });

  test('sortBy=ticketCount&order=desc → ən çox ticket birinci', async () => {
    await createCompanyWithTickets('a@test.az', 'A', 3);
    await createCompanyWithTickets('b@test.az', 'B', 7);
    await createCompanyWithTickets('c@test.az', 'C', 1);

    const res = await request(app).get('/api/companies?sortBy=ticketCount&order=desc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].displayName).toBe('B');
    expect(res.body.data[1].displayName).toBe('A');
    expect(res.body.data[2].displayName).toBe('C');
  });

  test('sortBy=ticketCount&order=asc → ən az ticket birinci', async () => {
    await createCompanyWithTickets('a@test.az', 'A', 3);
    await createCompanyWithTickets('b@test.az', 'B', 7);
    await createCompanyWithTickets('c@test.az', 'C', 1);

    const res = await request(app).get('/api/companies?sortBy=ticketCount&order=asc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].displayName).toBe('C');
    expect(res.body.data[2].displayName).toBe('B');
  });

  test('default sort createdAt desc qorunur (sortBy olmadan)', async () => {
    await createCompanyWithTickets('first@test.az', 'First', 0);
    await new Promise(r => setTimeout(r, 10));
    await createCompanyWithTickets('last@test.az', 'Last', 0);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].displayName).toBe('Last');
    expect(res.body.data[1].displayName).toBe('First');
  });
});
```

- [ ] **Step 2: Testləri işlət və FAIL olduğunu təsdiqlə**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=companies-ticket-count`
Expected: 6 FAIL (ticketCount field hələ yoxdur)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add tests/companies-ticket-count.test.js
git commit -m "test(companies): add ticket count + sort tests (Task 6)"
```

---

## Task 6: Companies Aggregation Pipeline (TDD green)

**Files:**
- Modify: `Backend/routes/companies.js:26-63` (GET /)

- [ ] **Step 1: Aggregation pipeline əlavə et**

`Backend/routes/companies.js` faylında, `router.get('/', adminAuth, ...)` hissəsini tap. Cari:

```js
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search && search.trim()) {
      query.$or = [
        { displayName: new RegExp(search.trim(), 'i') },
        { originalName: new RegExp(search.trim(), 'i') },
        { contactEmail: new RegExp(search.trim(), 'i') },
      ];
    }

    if (status === 'active') query.isActive = true;
    else if (status === 'passive') query.isActive = false;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [total, companies] = await Promise.all([
      Company.countDocuments(query),
      Company.find(query)
        .populate('ownerUserId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
    ]);

    res.json({
      success: true,
      data: companies,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});
```

Bunu əvəz et:

```js
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { search, status, sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;
    const query = {};

    if (search && search.trim()) {
      query.$or = [
        { displayName: new RegExp(search.trim(), 'i') },
        { originalName: new RegExp(search.trim(), 'i') },
        { contactEmail: new RegExp(search.trim(), 'i') },
      ];
    }

    if (status === 'active') query.isActive = true;
    else if (status === 'passive') query.isActive = false;

    const sortField = ['createdAt', 'ticketCount'].includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [total, companies] = await Promise.all([
      Company.countDocuments(query),
      Company.aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
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
            ticketCount: { $size: '$tickets' },
          },
        },
        { $sort: { [sortField]: sortOrder } },
      ]),
    ]);

    res.json({
      success: true,
      data: companies,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Companies testləri işlət**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=companies`
Expected: ALL PASS (companies.test.js + companies-cascade.test.js + companies-ticket-count.test.js)

- [ ] **Step 3: Tam regression**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test`
Expected: 107 PASS (101 + 6 yeni), 0 FAIL

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add routes/companies.js
git commit -m "feat(companies): add ticketCount aggregation + sortBy/order params (Task 6)"
```

---

## Task 7: Companies Test Populate Updates (Tasks 1, 3)

**Files:**
- Modify: `Backend/tests/companies.test.js` — 2 yeni test əlavə et

- [ ] **Step 1: Populate testləri əlavə et**

`Backend/tests/companies.test.js` faylında, `describe('GET /api/companies', () => { ... })` bloku içində, son `test('user token → 401', ...)` testindən SONRA aşağıdakı 2 testi əlavə et:

```js
test('ownerUserId.isVerified field mövcuddur (Task 1)', async () => {
  const user = await User.create({
    firstName: 'Ali', lastName: 'Babayev',
    email: 'verified@test.az', password: 'hashed',
    companyName: 'Verified MMC', isVerified: true,
  });
  await Company.create({
    displayName: 'Verified MMC', originalName: 'Verified MMC', ownerUserId: user._id,
  });

  const res = await request(app).get('/api/companies')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.body.data[0].ownerUserId.isVerified).toBe(true);
});

test('ownerUserId.email User.email-dən gəlir (Task 3)', async () => {
  const user = await User.create({
    firstName: 'Email', lastName: 'Test',
    email: 'realemail@test.az', password: 'hashed',
    companyName: 'Email MMC', isVerified: true,
  });
  await Company.create({
    displayName: 'Email MMC', originalName: 'Email MMC',
    ownerUserId: user._id,
    contactEmail: 'wrongcompany@test.az', // ← fərqli email
  });

  const res = await request(app).get('/api/companies')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.body.data[0].ownerUserId.email).toBe('realemail@test.az');
});
```

- [ ] **Step 2: Testləri işlət**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test -- --testPathPattern=companies.test`
Expected: ALL PASS (5 original + 2 yeni = 7 test)

- [ ] **Step 3: Tam regression**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test`
Expected: 109 PASS (107 + 2 yeni), 0 FAIL

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add tests/companies.test.js
git commit -m "test(companies): add isVerified + email populate tests (Tasks 1, 3)"
```

---

## Task 8: Spec + Plan Commit (Both Repos)

**Files:**
- Modify: Both repos already have spec files

- [ ] **Step 1: Backend-də spec commit et**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add docs/superpowers/specs/2026-06-27-ticket-fixes-batch-design.md
git commit -m "docs: add ticket fixes batch design spec"
```

- [ ] **Step 2: Frontend-də spec commit et**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend"
git add docs/superpowers/specs/2026-06-27-ticket-fixes-batch-design.md
git commit -m "docs: add ticket fixes batch design spec"
```

---

## Task 9: AdminCompanies UI — Status Badge, Email, Ticket Count

**Files:**
- Modify: `Frontend/src/pages/AdminCompanies.js`

**Goal:** Tasks 1, 3, 6 UI hissələri — 3-state badge, User.email, ticketCount sütunu.

- [ ] **Step 1: Import əlavə et**

`AdminCompanies.js` faylında, import sətirində ChevronDown, ChevronUp ikonlarını əlavə et. Cari:

```js
import { Building2, Search, Edit, Power, Loader2, AlertCircle, X, Save } from 'lucide-react';
```

Bunu əvəz et:

```js
import { Building2, Search, Edit, Power, Loader2, AlertCircle, X, Save, ChevronDown, ChevronUp } from 'lucide-react';
```

- [ ] **Step 2: State-lər əlavə et**

Komponentin əvvəlində `const limit = 20;` sətirindən SONRA:

```js
const [sortBy, setSortBy] = useState('createdAt');
const [order, setOrder] = useState('desc');
```

- [ ] **Step 3: STATUS_BADGES constant əlavə et**

Komponentin xaricində (faylın yuxarısında, default export-dan əvvəl):

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

- [ ] **Step 4: fetchCompanies params əlavə et**

`fetchCompanies` callback-inin içində, `const params = { page, limit };` sətirini tap və SONRA əlavə et:

```js
params.sortBy = sortBy;
params.order = order;
```

Və `useCallback` dependency array-ini `[page, search, statusFilter, sortBy, order]` ilə əvəz et.

- [ ] **Step 5: handleSort funksiyası əlavə et**

`handleDeactivate` funksiyasından SONRA:

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

- [ ] **Step 6: Table header-i yenilə (Tasks 1, 3, 6)**

Table header `<thead>` blokunda, `Əməliyyat` sətirindən ƏVVƏL `<th>` sıralamasını dəyiş:

Cari:
```jsx
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Şirkət adı</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Owner</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Əməliyyat</th>
```

Bunu əvəz et:

```jsx
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Şirkət adı</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Owner</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
<th
  onClick={() => handleSort('ticketCount')}
  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
>
  <div className="flex items-center gap-1">
    Müraciət sayı
    {sortBy === 'ticketCount' && (order === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
  </div>
</th>
<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Əməliyyat</th>
```

- [ ] **Step 7: Table body cells yenilə (Tasks 1, 3, 6)**

Table body `<td>` sıralamasını dəyiş. Cari:

```jsx
<td className="px-4 py-3 text-sm font-medium text-slate-900">{c.displayName}</td>
<td className="px-4 py-3 text-sm text-slate-600">{c.ownerUserId?.firstName} {c.ownerUserId?.lastName}</td>
<td className="px-4 py-3 text-sm text-slate-600">{c.contactEmail || '-'}</td>
<td className="px-4 py-3 text-sm">
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
    {c.isActive ? 'Aktiv' : 'Passiv'}
  </span>
</td>
<td className="px-4 py-3 text-sm">
  <div className="flex items-center gap-2">
    <button onClick={() => handleEdit(c)} ...>...</button>
    {c.isActive && (
      <button onClick={() => handleDeactivate(c)} ...>...</button>
    )}
  </div>
</td>
```

Bunu əvəz et:

```jsx
<td className="px-4 py-3 text-sm font-medium text-slate-900">{c.displayName}</td>
<td className="px-4 py-3 text-sm text-slate-600">{c.ownerUserId?.firstName} {c.ownerUserId?.lastName}</td>
<td className="px-4 py-3 text-sm text-slate-600">{c.ownerUserId?.email || '-'}</td>
<td className="px-4 py-3 text-sm">
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[getStatusKey(c)].className}`}>
    {STATUS_BADGES[getStatusKey(c)].label}
  </span>
</td>
<td className="px-4 py-3 text-sm text-slate-900 font-medium">{c.ticketCount}</td>
<td className="px-4 py-3 text-sm">
  <div className="flex items-center gap-2">
    <button onClick={() => handleEdit(c)} ...>...</button>
    {/* Əməliyyat düymələri Task 5-də əlavə olunacaq */}
    {c.isActive && (
      <button onClick={() => handleDeactivate(c)} ...>...</button>
    )}
  </div>
</td>
```

- [ ] **Step 8: Build yoxla**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" && npm run build`
Expected: Build success (errors yoxdur, badge/email/count sütunu compile olur)

- [ ] **Step 9: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend"
git add src/pages/AdminCompanies.js
git commit -m "feat(admin-companies): status badge + email + ticket count columns (Tasks 1, 3, 6)"
```

---

## Task 10: AdminCompanies UI — Reaktiv Button (Task 5)

**Files:**
- Modify: `Frontend/src/pages/AdminCompanies.js`

- [ ] **Step 1: handleReactivate funksiyası əlavə et**

`handleDeactivate` funksiyasından SONRA (və ya `handleSort`-dan əvvəl):

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

- [ ] **Step 2: Əməliyyat düyməsini dəyiş (Task 5)**

Table body-də, `{c.isActive && (<button onClick={() => handleDeactivate(c)} ...>` blokunu tap. Onu əvəz et:

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

- [ ] **Step 3: Build yoxla**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" && npm run build`
Expected: Build success

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend"
git add src/pages/AdminCompanies.js
git commit -m "feat(admin-companies): add re-activate button for passive companies (Task 5)"
```

---

## Task 11: UserResetPassword Toast Text (Task 2 UI)

**Files:**
- Modify: `Frontend/src/pages/UserResetPassword.js:38`

- [ ] **Step 1: Toast text dəyiş**

`UserResetPassword.js` faylında, `handleSubmit` funksiyasının içində, `toast.success` sətirini tap:

Cari:
```js
toast.success('Şifrə uğurla dəyişdirildi! İndi login ola bilərsiniz.');
```

Bunu əvəz et:

```js
toast.success('Şifrə uğurla dəyişdirildi və email təsdiqləndi. İndi login ola bilərsiniz.');
```

- [ ] **Step 2: Build yoxla**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend"
git add src/pages/UserResetPassword.js
git commit -m "feat(user-reset): update toast to mention auto-verify (Task 2)"
```

---

## Task 12: Manual Browser Smoke Test (10 ssenari)

**Files:** Heç bir kod dəyişikliyi yoxdur. Manual verification.

**Hazırlıq:**
- Backend: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm start`
- Frontend: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" && npm start`
- Browser: `http://localhost:3000`

- [ ] **Ssenari 1 — Status badge (Task 1)**
  1. Yeni user register et (`/register`)
  2. Verify OTP etmə
  3. Login ol (`admin / admin123` istifadəçi adından fərqli)
  4. `/admin/companies`-ə get
  5. **Gözlənilən:** Status badge "Doğrulanmamış" (sarı)
  6. OTP verify et
  7. Refresh
  8. **Gözlənilən:** Status badge "Təsdiqlənmiş" (yaşıl)
  9. Şirkəti deaktiv et
  10. **Gözlənilən:** Status badge "Passiv" (boz)

- [ ] **Ssenari 2 — Reset auto-verify (Task 2)**
  1. Yeni user register et, verify etmə
  2. `/login`-ə get
  3. "Şifrəni unutdum" kliklə → email daxil et
  4. Email-ə OTP gələcək (production SMTP)
  5. OTP + yeni şifrə daxil et
  6. **Gözlənilən:** "Şifrə uğurla dəyişdirildi və email təsdiqləndi" toast
  7. Yeni şifrə ilə login ol
  8. **Gözlənilən:** Login uğurlu (əvvəl 403 idi)

- [ ] **Ssenari 3 — Email sütunu (Task 3)**
  1. `/admin/companies`-ə get
  2. **Gözlənilən:** Email sütununda User.email görünür (əvvəl "-" idi)

- [ ] **Ssenari 4 — Deaktiv blok (Task 4)**
  1. `/admin/companies`-də şirkəti deaktiv et
  2. Yeni tab-da `/login`-ə get
  3. Deaktiv user email + şifrə ilə login olmağa cəhd et
  4. **Gözlənilən:** "Hesabınız deaktiv edilib" qırmızı banner

- [ ] **Ssenari 5 — Reaktiv (Task 5)**
  1. `/admin/companies`-də Passiv şirkətə bax
  2. **Gözlənilən:** Yaşıl "Power" button görünür
  3. Kliklə → confirm → "Şirkət və istifadəçi hesabı yenidən aktivləşdirildi" toast
  4. User login olmağa cəhd et
  5. **Gözlənilən:** Login uğurlu

- [ ] **Ssenari 6 — Müraciət sayı (Task 6)**
  1. `/admin/companies`-ə get
  2. **Gözlənilən:** "Müraciət sayı" sütunu hər şirkətin sayını göstərir
  3. Sütun başlığına kliklə
  4. **Gözlənilən:** ▼ ikonu görünür, azalan sıralanır
  5. Yenidən kliklə
  6. **Gözlənilən:** ▲ ikonu görünür, artan sıralanır

- [ ] **Ssenari 7 — Admin Müraciətlər pagination (Task 7)**
  1. Browser DevTools aç → Network → response `/api/tickets?page=1&limit=5` test et
  2. Və ya MongoDB-yə 21+ ticket əlavə et
  3. `/admin/tickets`-ə get
  4. **Gözlənilən:** "Əvvəlki / Səhifə 1 / N / Növbəti" görsənir (limit=2 ilə test et)

- [ ] **Ssenari 8 — Admin Şirkətlər pagination (Task 8)**
  1. MongoDB-yə 21+ şirkət əlavə et (və ya test DB-də)
  2. `/admin/companies`-ə get
  3. **Gözlənilən:** Pagination görsənir

- [ ] **Ssenari 9 — User Müraciətlərim pagination (Task 9)**
  1. User ilə 21+ ticket yarat
  2. `/tickets`-ə get
  3. **Gözlənilən:** Pagination görsənir

- [ ] **Ssenari 10 — Regression (SP1-SP7 flow)**
  1. Register → verify → login → ticket yarat → admin status dəyişdir → user görür
  2. **Gözlənilən:** Bütün mövcud flow işləyir, heç bir regression yoxdur

---

## Task 13: Final Code Review + Cleanup

**Files:** Mövcud kodlar

- [ ] **Step 1: Mövcud test suite işlət**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" && npm test`
Expected: 111 PASS (89 original + 22 yeni), 0 FAIL

- [ ] **Step 2: Frontend build yoxla**

Run: `cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" && npm run build`
Expected: Build success, no warnings

- [ ] **Step 3: Git status yoxla**

Run: `git -C "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" status` və `git -C "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" status`
Expected: Working tree clean (bütün commit-lər push edilməyib, default policy)

- [ ] **Step 4: Commit graph yoxla**

Run: `git -C "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend" log --oneline -15` və `git -C "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend" log --oneline -15`
Expected: 13 commit (Tasks 1-13 + subagent review commits)

- [ ] **Step 5: Final commit (əgər lazımdır kiçik düzəlişlər)**

```bash
# Backend (əgər hər hansı dəyişiklik varsa)
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Backend"
git add -A
git commit -m "chore: final cleanup"

# Frontend
cd "C:\Users\Administrator\Desktop\TicketAPP\Ticket-Frontend"
git add -A
git commit -m "chore: final cleanup"
```

---

## Yekun

**Cəmi commit sayı:**
- Backend: ~8 commit (Tasks 1-7 + 8 + 13 final)
- Frontend: ~5 commit (Tasks 8-11 + 13 final)

**Test artımı:**
- 89 → 111 (22 yeni test PASS, 0 regression)

**Build status:**
- Backend: 109/109 test PASS
- Frontend: Build success

**Success Criteria (Spec §10):**
- ✅ Bütün 9 task manual test edilib
- ✅ 20 yeni backend test PASS
- ✅ Mövcud 89 test broken deyil
- ✅ SP1-SP7 regression yoxdur
- ✅ Admin Şirkətlər səhifəsi 3-state badge, email, ticket count, sort, reaktiv button ilə işləyir
- ✅ User deaktiv olduqda login bloklanır + düzgün mesaj
- ✅ Reset password sonrası email avtomatik təsdiqlənir
