const request = require('supertest');
const app = require('../server');
const setup = require('./setup');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');

let userToken;
let userId;
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
    username: 'admin', password: await hashPassword('admin123'),
    email: 'admin@test.az', fullName: 'Administrator',
  });
  const adminLogin = await request(app).post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin123',
  });
  adminToken = adminLogin.body.token;

  await request(app).post('/api/auth/register').send({
    firstName: 'Test', lastName: 'User', email: 'test@test.az',
    password: 'test123', companyName: 'Test MMC',
  });
  const user = await User.findOne({ email: 'test@test.az' });
  user.isVerified = true;
  await user.save();
  userId = user._id;
  const userLogin = await request(app).post('/api/auth/login').send({
    email: 'test@test.az', password: 'test123',
  });
  userToken = userLogin.body.token;
});

describe('GET /api/profile', () => {
  test('valid token → 200, user info', async () => {
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@test.az');
    expect(res.body.user.companyName).toBe('Test MMC');
  });

  test('no token → 401', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/profile', () => {
  test('firstName update → 200', async () => {
    const res = await request(app).put('/api/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ firstName: 'Updated' });
    expect(res.status).toBe(200);

    const user = await User.findById(userId);
    expect(user.firstName).toBe('Updated');
  });

  test('email update → 200', async () => {
    const res = await request(app).put('/api/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ email: 'newemail@test.az' });
    expect(res.status).toBe(200);

    const user = await User.findById(userId);
    expect(user.email).toBe('newemail@test.az');
  });
});

describe('PUT /api/profile/password', () => {
  test('correct current password → 200, new password works', async () => {
    const res = await request(app).put('/api/profile/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: 'test123', newPassword: 'newpass123' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'test@test.az', password: 'newpass123',
    });
    expect(loginRes.status).toBe(200);
  });

  test('wrong current password → 401', async () => {
    const res = await request(app).put('/api/profile/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/profile', () => {
  test('admin token → 200', async () => {
    const res = await request(app).get('/api/admin/profile').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.username).toBe('admin');
  });

  test('user token → 401', async () => {
    const res = await request(app).get('/api/admin/profile').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/admin/profile', () => {
  test('fullName update → 200', async () => {
    const res = await request(app).put('/api/admin/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'New Admin' });
    expect(res.status).toBe(200);

    const admin = await Admin.findOne({ username: 'admin' });
    expect(admin.fullName).toBe('New Admin');
  });
});

describe('PUT /api/admin/profile/password', () => {
  test('correct current password → 200', async () => {
    const res = await request(app).put('/api/admin/profile/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'admin123', newPassword: 'newadmin123' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/admin/auth/login').send({
      username: 'admin', password: 'newadmin123',
    });
    expect(loginRes.status).toBe(200);
  });
});
