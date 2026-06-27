const request = require('supertest');
const app = require('../server');
const setup = require('./setup');
const Admin = require('../models/Admin');
const { hashPassword } = require('../utils/password');

beforeAll(async () => {
  await setup.connect();
});

afterAll(async () => {
  await setup.close();
});

afterEach(async () => {
  await setup.clear();
});

describe('POST /api/admin/auth/login', () => {
  beforeEach(async () => {
    await Admin.create({
      username: 'admin',
      password: await hashPassword('admin123'),
      email: 'info@zootrend.az',
      fullName: 'Administrator',
    });
  });

  test('valid credentials → 200, token qaytarılır', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({
      username: 'admin', password: 'admin123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.admin.username).toBe('admin');
  });

  test('yanlış password → 401', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({
      username: 'admin', password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  test('mövcud olmayan istifadəçi → 401', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({
      username: 'nobody', password: 'admin123',
    });
    expect(res.status).toBe(401);
  });

  test('username boş → 400', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({
      username: '', password: 'admin123',
    });
    expect(res.status).toBe(400);
  });

  test('user token ilə admin login mümkün DEYİL (cross-panel blok)', async () => {
    const User = require('../models/User');
    await User.create({
      firstName: 'Test', lastName: 'User', email: 'test@test.az',
      password: await hashPassword('test123'), companyName: 'Test',
      isVerified: true,
    });
    const userLogin = await request(app).post('/api/auth/login').send({
      email: 'test@test.az', password: 'test123',
    });
    const userToken = userLogin.body.token;

    const res = await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/auth/me', () => {
  let token;

  beforeEach(async () => {
    await Admin.create({
      username: 'admin',
      password: await hashPassword('admin123'),
      email: 'info@zootrend.az',
      fullName: 'Administrator',
    });
    const loginRes = await request(app).post('/api/admin/auth/login').send({
      username: 'admin', password: 'admin123',
    });
    token = loginRes.body.token;
  });

  test('valid token → 200, admin info', async () => {
    const res = await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.username).toBe('admin');
  });

  test('token yoxdur → 401', async () => {
    const res = await request(app).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
  });
});
