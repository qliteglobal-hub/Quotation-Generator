require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const DRY_RUN = false;

async function setTerritory() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();

    const collections = ['products', 'leddisplays', 'lightingcontrols'];
    
    for (const collection of collections) {
      console.log(`\n=== ${collection.toUpperCase()} ===`);
      
      const items = await db.collection(collection)
        .find({ 
          $or: [
            { territory: { $exists: false } },
            { territory: null },
            { territory: '' }
          ]
        }).toArray();
      
      console.log(`Found ${items.length} items without territory`);
      
      if (!DRY_RUN && items.length > 0) {
        const result = await db.collection(collection).updateMany(
          { 
            $or: [
              { territory: { $exists: false } },
              { territory: null },
              { territory: '' }
            ]
          },
          { $set: { territory: 'Middle East' } }
        );
        console.log(`Updated ${result.modifiedCount} items`);
      } else if (DRY_RUN) {
        console.log(`[DRY RUN] Would update ${items.length} items to 'Middle East'`);
      }
    }

    console.log('\n=== DONE ===');
    if (DRY_RUN) console.log('⚠️  DRY RUN — No changes made!');

  } finally {
    await client.close();
  }
}

setTerritory();
