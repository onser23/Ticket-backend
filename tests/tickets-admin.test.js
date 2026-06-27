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

jest.mock('../services/emailService', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendStatusChangedEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const { sendStatusChangedEmail } = require('../services/emailService');

let userToken;
let adminToken;
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
  jest.clearAllMocks();

  await Admin.create({
    username: 'admin', password: await hashPassword('admin123'),
    email: 'admin@test.az', fullName: 'Administrator',
  });
  const adminLogin = await request(app).post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin123',
  });
  adminToken = adminLogin.body.token;

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

describe('Admin GET /api/tickets', () => {
  let otherCompanyId;

  beforeEach(async () => {
    const Company2 = await Company.create({
      displayName: 'Other MMC', originalName: 'Other MMC', ownerUserId: new mongoose.Types.ObjectId(),
    });
    otherCompanyId = Company2._id;
    const otherUser = await User.create({
      firstName: 'Other', lastName: 'User', email: 'other@test.az',
      password: await hashPassword('test123'), companyName: 'Other MMC',
      companyId: Company2._id, isVerified: true,
    });

    await Ticket.create([
      { title: 'User ticket 1', description: 'Test description 1', priority: 'low', companyId, createdBy: userId },
      { title: 'User ticket 2', description: 'Test description 2', priority: 'high', companyId, createdBy: userId },
      { title: 'Other user ticket', description: 'Other test description', priority: 'medium', companyId: Company2._id, createdBy: otherUser._id },
    ]);
  });

  test('admin sees all tickets → 3', async () => {
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.total).toBe(3);
  });

  test('admin filters by companyId → only 2', async () => {
    const res = await request(app).get(`/api/tickets?companyId=${companyId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  test('user still sees only own → 2', async () => {
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });
});

describe('Admin GET /api/tickets/:id', () => {
  let ticketId;
  let otherUserId;
  let otherUserTicketId;

  beforeEach(async () => {
    const Ticket = require('../models/Ticket');
    const t = await Ticket.create({
      title: 'Test ticket', description: 'Test description for single GET',
      priority: 'medium', companyId, createdBy: userId,
    });
    ticketId = t._id;

    // Başqa user yarat, onun ticket-i
    const otherUser = await User.create({
      firstName: 'Other', lastName: 'User', email: 'other@test.az',
      password: await hashPassword('test123'), companyName: 'Other',
      companyId, isVerified: true,
    });
    otherUserId = otherUser._id;

    const t2 = await Ticket.create({
      title: 'Other user ticket', description: 'Other user ticket description',
      priority: 'low', companyId, createdBy: otherUserId,
    });
    otherUserTicketId = t2._id;
  });

  test('admin token ilə GET /:id (öz ticketi) → 200', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Test ticket');
  });

  test('admin token ilə GET /:id (başqa user-in ticketi) → 200 (cross-panel blok YOX)', async () => {
    const res = await request(app)
      .get(`/api/tickets/${otherUserTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Other user ticket');
  });

  test('user token ilə GET /:id (öz ticketi) → 200', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Test ticket');
  });

  test('not found → 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/tickets/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('Admin PATCH /api/tickets/:id/status', () => {
  let ticketId;

  beforeEach(async () => {
    const t = await Ticket.create({
      title: 'Test ticket', description: 'Test description for patch',
      priority: 'medium', companyId, createdBy: userId,
    });
    ticketId = t._id;
  });

  test('valid status change → 200, ticket updated, no email for non-resolved', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(sendStatusChangedEmail).not.toHaveBeenCalled();
  });

  test('status=resolved → email triggered', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.resolvedAt).toBeTruthy();
    expect(sendStatusChangedEmail).toHaveBeenCalledTimes(1);
    expect(sendStatusChangedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@test.az', firstName: 'Test' })
    );
  });

  test('invalid status → 400', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
  });

  test('user token → 401 (adminAuth rejects)', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(401);
  });

  test('not found → 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .patch(`/api/tickets/${fakeId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });
});

describe('Admin DELETE /api/tickets/:id', () => {
  let ticketId;

  beforeEach(async () => {
    const t = await Ticket.create({
      title: 'Test ticket', description: 'Test description for delete',
      priority: 'medium', companyId, createdBy: userId,
    });
    ticketId = t._id;
  });

  test('soft delete → isActive=false', async () => {
    const res = await request(app)
      .delete(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const updated = await Ticket.findById(ticketId);
    expect(updated.isActive).toBe(false);
  });

  test('user token → 401 (adminAuth rejects)', async () => {
    const res = await request(app)
      .delete(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(401);
  });

  test('not found → 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/api/tickets/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
