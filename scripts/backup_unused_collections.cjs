const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Identify unused collections
const UNUSED_COLLECTIONS = ['main_topic', 'sub_topic', 'roles'];

let db;
try {
    const possiblePaths = [
        path.join(__dirname, '../firebase-service-account.json'),
        path.join(__dirname, '../isar-aun-qa-firebase-adminsdk-fbsvc-44d56d7870.json'),
        './firebase-service-account.json'
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

async function backupAndDelete() {
    console.log("--- Firestore Cleanup Tool ---");

    for (const collectionName of UNUSED_COLLECTIONS) {
        console.log(`\nProcessing collection: [${collectionName}]`);

        const snapshot = await db.collection(collectionName).get();
        if (snapshot.empty) {
            console.log(`- Collection is already empty.`);
            continue;
        }

        const data = {};
        snapshot.forEach(doc => {
            data[doc.id] = doc.data();
        });

        const backupFile = path.join(__dirname, `../backups/backup_${collectionName}_${new Date().toISOString().split('T')[0]}.json`);

        if (!fs.existsSync(path.join(__dirname, '../backups'))) {
            fs.mkdirSync(path.join(__dirname, '../backups'));
        }

        fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
        console.log(`- Backup saved to: ${backupFile} (${snapshot.size} records)`);

        // To perform deletion, uncomment the following block in a real environment
        /*
        console.log(`- Deleting ${snapshot.size} documents...`);
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`- Successfully deleted [${collectionName}] documents.`);
        */
        console.log(`- [INFO] Deletion is currently commented out for safety. Please check the backup first.`);
    }

    console.log("\nCleanup process finished.");
}

backupAndDelete().catch(err => {
    console.error("Error during cleanup:", err);
});
