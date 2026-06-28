const request = require('supertest');
const app = require('../server');
const setup = require('./setup');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
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

async function createCompanyWithTickets(email, displayName, ticketCount) {
  const user = await User.create({
    firstName: 'Owner', lastName: 'Test',
    email, password: 'hashed', companyName: displayName, isVerified: true,
  });
  const company = await Company.create({
    displayName, originalName: displayName, ownerUserId: user._id,
  });
  user.companyId = company._id;
  await user.save();

  for (let i = 0; i < ticketCount; i++) {
    await Ticket.create({
      title: `Ticket ${i}`, description: 'Test description for ticket',
      priority: 'medium', companyId: company._id, createdBy: user._id,
    });
  }
  return { user, company };
}

describe('GET /api/companies — ticketCount field (Task 6)', () => {
  test('hər şirkətdə ticketCount field mövcuddur', async () => {
    await createCompanyWithTickets('c1@test.az', 'C1', 3);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty('ticketCount', 3);
  });

  test('0 ticket olan şirkət → ticketCount=0', async () => {
    await createCompanyWithTickets('c0@test.az', 'C0', 0);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].ticketCount).toBe(0);
  });

  test('5 ticket olan şirkət → ticketCount=5', async () => {
    await createCompanyWithTickets('c5@test.az', 'C5', 5);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].ticketCount).toBe(5);
  });

  test('sortBy=ticketCount&order=desc → ən çox ticket birinci', async () => {
    await createCompanyWithTickets('a@test.az', 'Alpha', 3);
    await createCompanyWithTickets('b@test.az', 'Beta', 7);
    await createCompanyWithTickets('c@test.az', 'Gamma', 1);

    const res = await request(app).get('/api/companies?sortBy=ticketCount&order=desc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].displayName).toBe('Beta');
    expect(res.body.data[1].displayName).toBe('Alpha');
    expect(res.body.data[2].displayName).toBe('Gamma');
  });

  test('sortBy=ticketCount&order=asc → ən az ticket birinci', async () => {
    await createCompanyWithTickets('a@test.az', 'Alpha', 3);
    await createCompanyWithTickets('b@test.az', 'Beta', 7);
    await createCompanyWithTickets('c@test.az', 'Gamma', 1);

    const res = await request(app).get('/api/companies?sortBy=ticketCount&order=asc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].displayName).toBe('Gamma');
    expect(res.body.data[2].displayName).toBe('Beta');
  });

  test('default sort createdAt desc qorunur (sortBy olmadan)', async () => {
    await createCompanyWithTickets('first@test.az', 'First', 0);
    await new Promise(r => setTimeout(r, 10));
    await createCompanyWithTickets('last@test.az', 'Last', 0);

    const res = await request(app).get('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data[0].displayName).toBe('Last');
    expect(res.body.data[1].displayName).toBe('First');
  });
});