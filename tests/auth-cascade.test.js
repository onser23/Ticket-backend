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
