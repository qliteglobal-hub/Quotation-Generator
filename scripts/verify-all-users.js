require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function verifyExistingUsers() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();

    const result = await db.collection('users').updateMany(
      {},
      { $set: { emailVerified: true } }
    );
    
    console.log(`Updated ${result.modifiedCount} users to be emailVerified.`);
    console.log('Done!');
  } finally {
    await client.close();
  }
}

verifyExistingUsers();
