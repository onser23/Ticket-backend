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

describe('GET /api/companies', () => {
  test('admin token → 200, companies list', async () => {
    const res = await request(app).get('/api/companies').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test('search filter işləyir', async () => {
    const user = await User.create({
      firstName: 'Ali', lastName: 'Babayev', email: 'a@test.az',
      password: 'hashed', companyName: 'ABC MMC',
      isVerified: true,
    });
    await Company.create({ displayName: 'ABC MMC', originalName: 'ABC MMC', ownerUserId: user._id });

    const res = await request(app).get('/api/companies?search=abc').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].displayName).toBe('ABC MMC');
  });

  test('user token → 401', async () => {
    const res = await request(app).get('/api/companies').set('Authorization', `Bearer ${adminToken.slice(0, -5)}xx`);
    expect(res.status).toBe(401);
  });

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
      contactEmail: 'wrongcompany@test.az',
    });

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].ownerUserId.email).toBe('realemail@test.az');
  });
});

describe('PUT /api/companies/:id', () => {
  test('displayName update + linked User.companyName sync', async () => {
    const user = await User.create({
      firstName: 'Ali', lastName: 'Babayev', email: 'a@test.az',
      password: 'hashed', companyName: 'OldName', isVerified: true,
    });
    const company = await Company.create({ displayName: 'OldName', originalName: 'OldName', ownerUserId: user._id });
    user.companyId = company._id;
    await user.save();

    const res = await request(app).put(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'NewName' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('NewName');

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.companyName).toBe('NewName');
  });

  test('404 — şirkət tapılmadı', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).put(`/api/companies/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'Test' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/companies/:id', () => {
  test('soft delete — isActive=false', async () => {
    const user = await User.create({
      firstName: 'Ali', lastName: 'Babayev', email: 'a@test.az',
      password: 'hashed', companyName: 'Test', isVerified: true,
    });
    const company = await Company.create({ displayName: 'Test', originalName: 'Test', ownerUserId: user._id });

    const res = await request(app).delete(`/api/companies/${company._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const updated = await Company.findById(company._id);
    expect(updated.isActive).toBe(false);
  });
});
