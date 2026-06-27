const request = require('supertest');
const app = require('../server');
const setup = require('./setup');

jest.mock('../services/emailService', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const { sendOtpEmail } = require('../services/emailService');
const User = require('../models/User');
const Otp = require('../models/Otp');

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

describe('POST /api/auth/register', () => {
  const validPayload = {
    firstName: 'Ali',
    lastName: 'Məmmədov',
    email: 'ali@test.az',
    password: 'test123',
    companyName: 'Test MMC',
  };

  test('valid data → 201, user created, OTP email göndərilir', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe('ali@test.az');

    const user = await User.findOne({ email: 'ali@test.az' });
    expect(user).toBeTruthy();
    expect(user.isVerified).toBe(false);
    expect(user.password).not.toBe('test123');

    expect(sendOtpEmail).toHaveBeenCalledTimes(1);
    expect(sendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ali@test.az',
        purpose: 'register',
      })
    );
  });

  test('email format yanlışdır → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validPayload, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  test('password çox qısadır (<6) → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validPayload, password: '123' });
    expect(res.status).toBe(400);
  });

  test('firstName çox qısadır (<2) → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validPayload, firstName: 'A' });
    expect(res.status).toBe(400);
  });

  test('companyName yoxdur → 400', async () => {
    const { companyName, ...payload } = validPayload;
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(400);
  });

  test('duplicate email → 400', async () => {
    await request(app).post('/api/auth/register').send(validPayload);
    const res = await request(app).post('/api/auth/register').send(validPayload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/artıq mövcuddur/);
  });
});

describe('POST /api/auth/verify-otp', () => {
  let plainOtpCode;

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov', email: 'ali@test.az', password: 'test123', companyName: 'Test MMC',
    });
    plainOtpCode = sendOtpEmail.mock.calls[0][0].code;
  });

  test('valid OTP → 200, isVerified=true', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({
      email: 'ali@test.az', code: plainOtpCode,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await User.findOne({ email: 'ali@test.az' });
    expect(updated.isVerified).toBe(true);
  });

  test('yanlış OTP → 400', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({
      email: 'ali@test.az', code: '000000',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yanlışdır/);
  });

  test('5 yanlış cəhd → 429', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/verify-otp').send({
        email: 'ali@test.az', code: '000000',
      });
    }
    const res = await request(app).post('/api/auth/verify-otp').send({
      email: 'ali@test.az', code: plainOtpCode,
    });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov', email: 'ali@test.az', password: 'test123', companyName: 'Test MMC',
    });
    const otpCode = sendOtpEmail.mock.calls[0][0].code;
    await request(app).post('/api/auth/verify-otp').send({
      email: 'ali@test.az', code: otpCode,
    });
  });

  test('valid credentials → 200, token qaytarılır', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ali@test.az', password: 'test123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('ali@test.az');
  });

  test('yanlış password → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ali@test.az', password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  test('email mövcud deyil → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.az', password: 'test123',
    });
    expect(res.status).toBe(401);
  });

  test('email təsdiqlənməyib → 403', async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Vəli', lastName: 'Əliyev', email: 'veli@test.az', password: 'test123', companyName: 'Vəli MMC',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'veli@test.az', password: 'test123',
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov', email: 'ali@test.az', password: 'test123', companyName: 'Test MMC',
    });
    const otpCode = sendOtpEmail.mock.calls[0][0].code;
    await request(app).post('/api/auth/verify-otp').send({
      email: 'ali@test.az', code: otpCode,
    });
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'ali@test.az', password: 'test123',
    });
    token = loginRes.body.token;
  });

  test('valid token → 200, user info', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ali@test.az');
  });

  test('token yoxdur → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('admin token ilə user endpoint-ə giriş → 401 (cross-panel blok)', async () => {
    const Admin = require('../models/Admin');
    const { hashPassword } = require('../utils/password');
    await Admin.create({
      username: 'testadmin', password: await hashPassword('admin123'),
      email: 'admin@test.az', fullName: 'Test Admin',
    });
    const adminLogin = await request(app).post('/api/admin/auth/login').send({
      username: 'testadmin', password: 'admin123',
    });
    const adminToken = adminLogin.body.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password + reset-password', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      firstName: 'Ali', lastName: 'Məmmədov', email: 'ali@test.az', password: 'test123', companyName: 'Test MMC',
    });
    const otpCode = sendOtpEmail.mock.calls[0][0].code;
    await request(app).post('/api/auth/verify-otp').send({
      email: 'ali@test.az', code: otpCode,
    });
    jest.clearAllMocks();
  });

  test('forgot-password mövcud email ilə → 200', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ali@test.az' });
    expect(res.status).toBe(200);
    expect(sendOtpEmail).toHaveBeenCalledTimes(1);
  });

  test('forgot-password mövcud olmayan email ilə → 200 (email enumeration qarşısının alınması)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.az' });
    expect(res.status).toBe(200);
    expect(sendOtpEmail).not.toHaveBeenCalled();
  });

  test('reset-password valid OTP ilə → 200, yeni şifrə ilə login olur', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'ali@test.az' });
    const resetCode = sendOtpEmail.mock.calls[0][0].code;

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'ali@test.az', code: resetCode, newPassword: 'newpass123',
    });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'ali@test.az', password: 'newpass123',
    });
    expect(loginRes.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({
      email: 'ali@test.az', password: 'test123',
    });
    expect(oldLogin.status).toBe(401);
  });
});
