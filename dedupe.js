const mongoose = require('mongoose');
const { EvaluationActual } = require('./server-mongo.cjs'); // We'll need to export models or mock them

async function deduplicate() {
  console.log('--- Starting Deduplication ---');
  const uri = 'mongodb://localhost:27017/aunqa'; // Adjust if needed
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const all = await EvaluationActual.find().sort({ created_at: -1 });
  const seen = new Set();
  const toDelete = [];

  for (const doc of all) {
    const key = `${doc.session_id}-${doc.indicator_id}-${doc.major_name}`;
    if (seen.has(key)) {
      toDelete.push(doc._id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Found ${toDelete.length} duplicate records to delete.`);
  if (toDelete.length > 0) {
    const res = await EvaluationActual.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${res.deletedCount} records.`);
  }

  await mongoose.disconnect();
  console.log('--- Done ---');
}

// Check if models are exported, otherwise we might need a different approach.
// server-mongo.cjs uses ESM-like structure with require.
// Let's just define the schema locally to be safe.

const evaluationActualSchema = new mongoose.Schema({
  session_id:          String,
  indicator_id:        String,
  operation_result:    String,
  status:              String,
  major_name:          String,
  created_at:          Date,
});
const Model = mongoose.model('EvaluationActualDedupe', evaluationActualSchema, 'evaluations_actual');

async function run() {
  const uri = 'mongodb://localhost:27017/aunqa';
  await mongoose.connect(uri);
  const all = await Model.find().sort({ created_at: -1 });
  const seen = new Set();
  const toDelete = [];
  for (const doc of all) {
    const key = `${doc.session_id}-${doc.indicator_id}-${doc.major_name}`;
    if (seen.has(key)) {
      toDelete.push(doc._id);
    } else {
      seen.add(key);
    }
  }
  if (toDelete.length > 0) {
    await Model.deleteMany({ _id: { $in: toDelete } });
    console.log(`Successfully deleted ${toDelete.length} duplicates.`);
  } else {
    console.log('No duplicates found.');
  }
  await mongoose.disconnect();
}

run().catch(console.error);
