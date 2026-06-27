require('dotenv').config();
const { connectDB, disconnectDB } = require('./db');
const User = require('../models/User');
const Company = require('../models/Company');

async function migrate() {
  await connectDB();

  const usersWithoutCompany = await User.find({ companyId: null });
  console.log(`Found ${usersWithoutCompany.length} users without companyId`);

  let created = 0;
  let skipped = 0;

  for (const user of usersWithoutCompany) {
    try {
      const existing = await Company.findOne({ ownerUserId: user._id });
      if (existing) {
        user.companyId = existing._id;
        await user.save();
        skipped += 1;
        console.log(`↪ User ${user.email}: linked to existing company`);
        continue;
      }

      const company = await Company.create({
        displayName: user.companyName,
        originalName: user.companyName,
        ownerUserId: user._id,
      });

      user.companyId = company._id;
      await user.save();

      created += 1;
      console.log(`✓ User ${user.email}: created company ${company.displayName}`);
    } catch (err) {
      console.error(`✗ User ${user.email}: migration failed:`, err.message);
    }
  }

  console.log(`\nMigration complete: ${created} created, ${skipped} linked, ${usersWithoutCompany.length} total`);

  await disconnectDB();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
}

module.exports = migrate;
