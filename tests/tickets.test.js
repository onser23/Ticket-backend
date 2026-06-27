const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const app = require('../server');
const setup = require('./setup');
const User = require('../models/User');
const Company = require('../models/Company');
const { hashPassword } = require('../utils/password');
const { signUserToken } = require('../utils/jwt');

let userToken;
let userId;
let companyId;

beforeAll(async () => {
  await setup.connect();
});

afterAll(async () => {
  await setup.close();
});

beforeEach(async () => {
  await setup.clear();

  const company = await Company.create({
    displayName: 'Test MMC', originalName: 'Test MMC', ownerUserId: new mongoose.Types.ObjectId(),
  });
  companyId = company._id;

  const user = await User.create({
    firstName: 'Test', lastName: 'User', email: 'test@test.az',
    password: await hashPassword('test123'), companyName: 'Test MMC',
    companyId, isVerified: true,
  });
  userId = user._id;
  userToken = signUserToken({ userId: user._id.toString() });
});

function createTestPng() {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cf0000000300010073e2c79c0000000049454e44ae426082', 'hex');
  fs.writeFileSync(filePath, png);
  return filePath;
}

describe('POST /api/tickets', () => {
  test('valid data, no attachments → 201', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Test müraciət')
      .field('description', 'Bu bir test müraciətdir, minimum 10 simvol uzunluğunda')
      .field('priority', 'medium');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayId).toMatch(/^TKT-\d{3,}$/);
    expect(res.body.data.title).toBe('Test müraciət');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.attachments).toEqual([]);
  });

  test('valid data with 1 attachment → 201, file saved', async () => {
    const pngPath = createTestPng();
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Şəkilli müraciət')
      .field('description', 'Bu müraciətdə şəkil var, açıqlama uzun olmalıdır')
      .field('priority', 'high')
      .attach('attachments', pngPath);

    expect(res.status).toBe(201);
    expect(res.body.data.attachments.length).toBe(1);
    expect(res.body.data.attachments[0].mimetype).toBe('image/png');
    fs.unlinkSync(pngPath);
  });

  test('invalid MIME (txt) → 400', async () => {
    const txtPath = path.join(os.tmpdir(), `test-${Date.now()}.txt`);
    fs.writeFileSync(txtPath, 'hello world');
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Yoxlama müraciət')
      .field('description', 'Açıqlama uzun olmalıdır test üçün')
      .field('priority', 'low')
      .attach('attachments', txtPath);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yalnız şəkil/i);
    fs.unlinkSync(txtPath);
  });

  test('title çox qısadır → 400', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'AB')
      .field('description', 'Bu açıqlama düzgün uzunluqdadır')
      .field('priority', 'low');

    expect(res.status).toBe(400);
  });

  test('invalid priority → 400', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Test müraciət')
      .field('description', 'Bu açıqlama düzgün uzunluqdadır')
      .field('priority', 'urgent');

    expect(res.status).toBe(400);
  });

  test('no token → 401', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .field('title', 'Test')
      .field('description', 'Açıqlama düzgün uzunluqdadır')
      .field('priority', 'low');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/tickets', () => {
  beforeEach(async () => {
    const Ticket = require('../models/Ticket');
    await Ticket.create([
      { title: 'Ticket 1', description: 'Açıqlama 1 uzun olmalıdır test üçün', priority: 'low', status: 'pending', companyId, createdBy: userId },
      { title: 'Ticket 2', description: 'Açıqlama 2 uzun olmalıdır test üçün', priority: 'high', status: 'pending', companyId, createdBy: userId },
      { title: 'Ticket 3', description: 'Açıqlama 3 uzun olmalıdır test üçün', priority: 'medium', status: 'resolved', companyId, createdBy: userId },
    ]);
  });

  test('user own tickets → 200, all 3', async () => {
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.total).toBe(3);
  });

  test('filter by priority=high → 1 ticket', async () => {
    const res = await request(app).get('/api/tickets?priority=high').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].priority).toBe('high');
  });

  test('filter by status=resolved → 1 ticket', async () => {
    const res = await request(app).get('/api/tickets?status=resolved').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('resolved');
  });

  test('search filter → 1 match', async () => {
    const res = await request(app).get('/api/tickets?search=Ticket%202').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('Ticket 2');
  });

  test('pagination → page 1, limit 2', async () => {
    const res = await request(app).get('/api/tickets?page=1&limit=2').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.totalPages).toBe(2);
  });
});

describe('GET /api/tickets/:id', () => {
  let ticketId;

  beforeEach(async () => {
    const Ticket = require('../models/Ticket');
    const t = await Ticket.create({
      title: 'Single ticket',
      description: 'Açıqlama düzgün uzunluqdadır',
      priority: 'medium',
      companyId,
      createdBy: userId,
    });
    ticketId = t._id;
  });

  test('owner gets own ticket → 200', async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Single ticket');
  });

  test('other user → 403', async () => {
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherToken = signUserToken({ userId: otherUserId });

    const res = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  test('not found → 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/api/tickets/${fakeId}`).set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });
});
