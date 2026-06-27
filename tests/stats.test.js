const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const setup = require('./setup');
const User = require('../models/User');
const Company = require('../models/Company');
const Admin = require('../models/Admin');
const Ticket = require('../models/Ticket');
const { hashPassword } = require('../utils/password');
const { signUserToken } = require('../utils/jwt');

let userToken;
let adminToken;
let userId;
let companyId;
let otherCompanyId;
let otherUserId;
let otherUserToken;

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

  const company = await Company.create({
    displayName: 'Company A', originalName: 'Company A', ownerUserId: new mongoose.Types.ObjectId(),
  });
  companyId = company._id;
  const company2 = await Company.create({
    displayName: 'Company B', originalName: 'Company B', ownerUserId: new mongoose.Types.ObjectId(),
  });
  otherCompanyId = company2._id;

  const user = await User.create({
    firstName: 'User', lastName: 'Alpha', email: 'a@test.az',
    password: await hashPassword('test123'), companyName: 'Company A',
    companyId, isVerified: true,
  });
  userId = user._id;
  userToken = signUserToken({ userId: user._id.toString() });

  const otherUser = await User.create({
    firstName: 'User', lastName: 'Beta', email: 'b@test.az',
    password: await hashPassword('test123'), companyName: 'Company B',
    companyId: otherCompanyId, isVerified: true,
  });
  otherUserId = otherUser._id;
  otherUserToken = signUserToken({ userId: otherUser._id.toString() });
});

describe('GET /api/stats/user', () => {
  test('user with no tickets → all zeros', async () => {
    const res = await request(app).get('/api/stats/user').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ total: 0, pending: 0, in_progress: 0, resolved: 0 });
  });

  test('user with 3 tickets (mixed status)', async () => {
    await Ticket.create([
      { title: 'Ticket 1', description: 'Desc desc desc desc', priority: 'low', status: 'pending', companyId, createdBy: userId },
      { title: 'Ticket 2', description: 'Desc desc desc desc', priority: 'high', status: 'in_progress', companyId, createdBy: userId },
      { title: 'Ticket 3', description: 'Desc desc desc desc', priority: 'medium', status: 'resolved', companyId, createdBy: userId },
    ]);

    const res = await request(app).get('/api/stats/user').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ total: 3, pending: 1, in_progress: 1, resolved: 1 });
  });

  test('user only sees own counts, not other users', async () => {
    await Ticket.create([
      { title: 'My ticket', description: 'Desc desc desc desc', priority: 'low', companyId, createdBy: userId },
      { title: 'Other ticket', description: 'Desc desc desc desc', priority: 'low', companyId: otherCompanyId, createdBy: otherUserId },
    ]);

    const res = await request(app).get('/api/stats/user').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  test('no token → 401', async () => {
    const res = await request(app).get('/api/stats/user');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/stats/admin', () => {
  test('admin: no tickets → all zeros + empty byCompany', async () => {
    const res = await request(app).get('/api/stats/admin').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.byCompany).toEqual([]);
  });

  test('admin: multi-company breakdown', async () => {
    await Ticket.create([
      { title: 'Company A 1', description: 'Desc desc desc desc', priority: 'low', status: 'pending', companyId, createdBy: userId },
      { title: 'Company A 2', description: 'Desc desc desc desc', priority: 'high', status: 'resolved', companyId, createdBy: userId },
      { title: 'Company B 1', description: 'Desc desc desc desc', priority: 'medium', status: 'pending', companyId: otherCompanyId, createdBy: otherUserId },
    ]);

    const res = await request(app).get('/api/stats/admin').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.pending).toBe(2);
    expect(res.body.data.resolved).toBe(1);
    expect(res.body.data.byCompany.length).toBe(2);

    const companyAStats = res.body.data.byCompany.find((c) => c.displayName === 'Company A');
    expect(companyAStats.total).toBe(2);
    expect(companyAStats.pending).toBe(1);
    expect(companyAStats.resolved).toBe(1);
  });

  test('user token → 401', async () => {
    const res = await request(app).get('/api/stats/admin').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(401);
  });
});
