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
    user.companyId = company._id;
    await user.save();

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
    user.companyId = company._id;
    await user.save();

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
    user.companyId = company._id;
    await user.save();

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
    user.companyId = company._id;
    await user.save();

    await request(app).put(`/api/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'NewName' });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.companyName).toBe('NewName');
  });
});
