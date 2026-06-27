require('dotenv').config();
const { connectDB, disconnectDB } = require('./db');
const Admin = require('../models/Admin');
const { hashPassword } = require('../utils/password');

async function seed() {
  await connectDB();

  const existingAdmin = await Admin.findOne({ username: 'admin' });
  if (existingAdmin) {
    console.log('✅ Admin artıq mövcuddur:', existingAdmin.username);
  } else {
    const hashed = await hashPassword('admin123');
    await Admin.create({
      username: 'admin',
      password: hashed,
      email: 'info@zootrend.az',
      fullName: 'Administrator',
    });
    console.log('✅ Default admin yaradıldı (admin / admin123)');
  }

  await disconnectDB();
  console.log('✅ Seed tamamlandı');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('❌ Seed xətası:', err);
    process.exit(1);
  });
}

module.exports = seed;
