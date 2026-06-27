const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const setup = require('./setup');
const User = require('../models/User');
const Company = require('../models/Company');
const Admin = require('../models/Admin');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const { hashPassword } = require('../utils/password');
const { signUserToken } = require('../utils/jwt');

jest.mock('../services/emailService', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendStatusChangedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendAdminReplyEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const { sendAdminReplyEmail } = require('../services/emailService');

let userToken;
let adminToken;
let userId;
let ticketId;

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

  const user = await User.create({
    firstName: 'Test', lastName: 'User', email: 'test@test.az',
    password: await hashPassword('test123'), companyName: 'Test MMC',
    companyId: company._id, isVerified: true,
  });
  userId = user._id;
  userToken = signUserToken({ userId: user._id.toString() });

  const ticket = await Ticket.create({
    title: 'Test ticket', description: 'Test description for comments',
    priority: 'medium', companyId: company._id, createdBy: userId,
  });
  ticketId = ticket._id;
});

describe('GET /api/comments/ticket/:ticketId', () => {
  test('empty list → 200', async () => {
    const res = await request(app)
      .get(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('owner sees comments → 200', async () => {
    await Comment.create([
      { ticketId, authorId: userId, authorRole: 'user', text: 'User comment 1' },
      { ticketId, authorId: new mongoose.Types.ObjectId(), authorRole: 'admin', text: 'Admin reply 1' },
    ]);

    const res = await request(app)
      .get(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  test('admin sees comments → 200', async () => {
    await Comment.create({ ticketId, authorId: userId, authorRole: 'user', text: 'User comment' });

    const res = await request(app)
      .get(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('other user → 403', async () => {
    const otherUser = await User.create({
      firstName: 'Other', lastName: 'User', email: 'other@test.az',
      password: await hashPassword('test123'), companyName: 'Other',
      companyId: (await Company.findOne()), isVerified: true,
    });
    const otherToken = signUserToken({ userId: otherUser._id.toString() });

    const res = await request(app)
      .get(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  test('no token → 401', async () => {
    const res = await request(app).get(`/api/comments/ticket/${ticketId}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/comments/ticket/:ticketId', () => {
  test('user posts to own ticket → 201', async () => {
    const res = await request(app)
      .post(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: 'Müraciətim haqqında əlavə məlumat' });

    expect(res.status).toBe(201);
    expect(res.body.data.authorRole).toBe('user');
    expect(res.body.data.text).toBe('Müraciətim haqqında əlavə məlumat');
    expect(sendAdminReplyEmail).not.toHaveBeenCalled();
  });

  test('admin posts to ticket → 201, email triggered', async () => {
    const res = await request(app)
      .post(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Admin cavab yazır' });

    expect(res.status).toBe(201);
    expect(res.body.data.authorRole).toBe('admin');
    expect(sendAdminReplyEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminReplyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@test.az', firstName: 'Test' })
    );
  });

  test('empty text → 400', async () => {
    const res = await request(app)
      .post(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: '' });

    expect(res.status).toBe(400);
  });

  test('text too long → 400', async () => {
    const res = await request(app)
      .post(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  test('other user posts → 403', async () => {
    const otherUser = await User.create({
      firstName: 'Other', lastName: 'User', email: 'other@test.az',
      password: await hashPassword('test123'), companyName: 'Other',
      companyId: (await Company.findOne()), isVerified: true,
    });
    const otherToken = signUserToken({ userId: otherUser._id.toString() });

    const res = await request(app)
      .post(`/api/comments/ticket/${ticketId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ text: 'Other user comment' });

    expect(res.status).toBe(403);
  });

  test('ticket not found → 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post(`/api/comments/ticket/${fakeId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: 'Comment' });

    expect(res.status).toBe(404);
  });
});
