const admin = require('firebase-admin');
const fs = require('fs');

// Try to find service account key
let db;

try {
    const possiblePaths = [
        './firebase-service-account.json',
        './isar-aun-qa-firebase-adminsdk-fbsvc-44d56d7870.json',
        './serviceAccountKey.json'
    ];

    let serviceAccount = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`Using key: ${p}`);
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            break;
        }
    }

    if (serviceAccount && !admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else if (!admin.apps.length) {
        console.log("No key found, trying default init...");
        admin.initializeApp();
    }
    db = admin.firestore();
} catch (e) {
    console.error("Failed to init admin:", e.message);
    process.exit(1);
}

async function checkData() {
    const major = 'วิศวกรรมคอมพิวเตอร์';
    console.log(`Checking evaluations for major: ${major}`);

    const snap = await db.collection('evaluations')
        .where('major_name', '==', major)
        .get();

    console.log(`Found ${snap.size} records.`);
    snap.docs.forEach(doc => {
        const d = doc.data();
        console.log(`- ID: ${doc.id}, Indicator: ${d.indicator_id}, Year: ${d.year}, Score: ${d.score}, Target: ${d.target_value}`);
    });
}

checkData();
