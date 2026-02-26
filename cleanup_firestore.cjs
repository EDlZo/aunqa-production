const admin = require('firebase-admin');
const fs = require('fs');

let db;
try {
    const possiblePaths = ['./firebase-service-account.json', './isar-aun-qa-firebase-adminsdk-fbsvc-44d56d7870.json'];
    let serviceAccount = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            break;
        }
    }
    if (serviceAccount && !admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (!admin.apps.length) {
        admin.initializeApp();
    }
    db = admin.firestore();
} catch (e) {
    console.error("Failed to init admin:", e.message);
    process.exit(1);
}

async function cleanup() {
    console.log("Starting cleanup of evaluations collection...");
    const snap = await db.collection('evaluations').get();
    let count = 0;

    const batch = db.batch();
    snap.docs.forEach(doc => {
        const d = doc.data();
        const year = String(d.year || '');
        if (year.includes(',')) {
            const parts = year.split(',');
            const singleYear = parts[0].trim();
            console.log(`Fixing doc ${doc.id}: "${year}" -> "${singleYear}"`);
            batch.update(doc.ref, { year: singleYear });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`Successfully fixed ${count} records.`);
    } else {
        console.log("No records needed fixing.");
    }
}

cleanup();
