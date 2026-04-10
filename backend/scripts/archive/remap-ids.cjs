// remap-ids.cjs
'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aunqa_db';

console.log('Script starting...');
console.log('MONGO_URI:', MONGO_URI);

const S = new mongoose.Schema({}, { strict: false, timestamps: false });
const Ind = mongoose.model('Ind', S, 'indicators');
const QC  = mongoose.model('QC',  S, 'quality_components');
const AS  = mongoose.model('AS',  S, 'assessment_sessions');
const Ev  = mongoose.model('Ev',  S, 'evaluations');
const Eva = mongoose.model('Eva', S, 'evaluations_actual');
const CE  = mongoose.model('CE',  S, 'committee_evaluations');
const Rnd = mongoose.model('Rnd', S, 'rounds');

(async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!\n');

    // Build maps
    async function buildMap(Model, label) {
      const docs = await Model.find({ _firebaseId: { $exists: true } }).lean();
      const map = new Map();
      docs.forEach(function(d) { if (d._firebaseId) map.set(String(d._firebaseId), String(d._id)); });
      console.log(label + ': ' + map.size + ' entries');
      return map;
    }

    async function remapField(Model, col, field, map) {
      const docs = await Model.find({}).lean();
      var u = 0, s = 0;
      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var v = String(doc[field] || '');
        if (!v || /^[0-9a-f]{24}$/i.test(v)) { s++; continue; }
        var nv = map.get(v);
        if (!nv) { s++; continue; }
        var upd = {};
        upd[field] = nv;
        await Model.updateOne({ _id: doc._id }, { $set: upd });
        u++;
      }
      console.log(col + '.' + field + ': updated=' + u + ' skipped=' + s);
    }

    console.log('Building ID maps...');
    var indMap  = await buildMap(Ind, 'indicators');
    var compMap = await buildMap(QC,  'quality_components');
    var sessMap = await buildMap(AS,  'assessment_sessions');

    console.log('\nRemapping fields...');
    await remapField(Ev,  'evaluations',           'indicator_id', indMap);
    await remapField(Ev,  'evaluations',           'session_id',   sessMap);
    await remapField(Eva, 'evaluations_actual',    'indicator_id', indMap);
    await remapField(Eva, 'evaluations_actual',    'session_id',   sessMap);
    await remapField(CE,  'committee_evaluations', 'indicator_id', indMap);
    await remapField(CE,  'committee_evaluations', 'session_id',   sessMap);
    await remapField(Ind, 'indicators',            'component_id', compMap);

    console.log('\nFixing year fields...');
    var ar = await Rnd.findOne({ is_active: true }).lean();
    var yr = ar ? ar.year : null;
    console.log('Active year: ' + yr);

    var sessions = await AS.find({}).lean();
    var sessionYearMap = new Map();
    sessions.forEach(function(s) {
      var y = s.round_year || s.year || yr;
      if (y) sessionYearMap.set(String(s._id), String(y));
    });

    async function fixYear(Model, name) {
      var docs = await Model.find({}).lean();
      var fixed = 0;
      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        if (doc.year && doc.year !== '' && doc.year !== null) continue;
        var y = sessionYearMap.get(String(doc.session_id)) || yr;
        if (!y) continue;
        await Model.updateOne({ _id: doc._id }, { $set: { year: y } });
        fixed++;
      }
      console.log(name + ' year fixed: ' + fixed);
    }

    await fixYear(Ev,  'evaluations');
    await fixYear(Eva, 'evaluations_actual');
    await fixYear(CE,  'committee_evaluations');

    if (yr) {
      var r4 = await QC.updateMany({ $or: [{ year: null }, { year: '' }] }, { $set: { year: yr } });
      console.log('quality_components year fixed: ' + r4.modifiedCount);
      var r5 = await Ind.updateMany({ $or: [{ year: null }, { year: '' }] }, { $set: { year: yr } });
      console.log('indicators year fixed: ' + r5.modifiedCount);
    }

    console.log('\nVerification:');
    var s1 = await Eva.findOne({}).lean();
    if (s1) {
      var i1 = await Ind.findById(s1.indicator_id).lean();
      console.log('evaluations_actual->indicator: ' + (i1 ? 'OK: ' + i1.indicator_name : 'NOT FOUND'));
      console.log('year=' + s1.year + ' major=' + s1.major_name);
    }
    var s2 = await CE.findOne({}).lean();
    if (s2) {
      var i2 = await Ind.findById(s2.indicator_id).lean();
      console.log('committee_evaluations->indicator: ' + (i2 ? 'OK: ' + i2.indicator_name : 'NOT FOUND'));
    }
    var s3 = await Ev.findOne({}).lean();
    if (s3) {
      var i3 = await Ind.findById(s3.indicator_id).lean();
      console.log('evaluations->indicator: ' + (i3 ? 'OK score=' + s3.score : 'NOT FOUND'));
    }

    console.log('\nDONE');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR: ' + e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
