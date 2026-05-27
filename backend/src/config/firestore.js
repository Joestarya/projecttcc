const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let isMock = false;

// Attempt to load Firestore using Service Account
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = require(resolvedPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      console.log('✅ Firestore (NoSQL) initialized successfully from service account.');
    } else {
      console.warn(`⚠️ Firebase service account file not found at: ${resolvedPath}`);
    }
  } else {
    console.log('ℹ️ FIREBASE_SERVICE_ACCOUNT_PATH environment variable is empty.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
}

// Fallback Mock DB
if (!db) {
  console.warn('⚠️ Running Firestore in mock/in-memory mode.');
  isMock = true;
  
  // Simulated database storage
  const storage = {};

  const getCollectionData = (collName) => {
    if (!storage[collName]) storage[collName] = new Map();
    return storage[collName];
  };

  db = {
    collection: (collName) => {
      const collMap = getCollectionData(collName);
      
      const queryObj = {
        where: () => queryObj,
        orderBy: () => queryObj,
        limit: () => queryObj,
        get: async () => {
          const docs = [];
          for (const [id, value] of collMap.entries()) {
            docs.push({
              id,
              data: () => value
            });
          }
          return {
            docs,
            forEach: (callback) => docs.forEach(callback),
            empty: docs.length === 0,
            size: docs.length
          };
        }
      };

      return {
        ...queryObj,
        doc: (docId) => {
          const id = docId || Math.random().toString(36).substring(2, 15);
          return {
            id,
            get: async () => {
              const value = collMap.get(id);
              return {
                id,
                exists: value !== undefined,
                data: () => value || null
              };
            },
            set: async (data, options) => {
              if (options && options.merge && collMap.has(id)) {
                const existing = collMap.get(id);
                collMap.set(id, { ...existing, ...data });
              } else {
                collMap.set(id, data);
              }
              return { writeTime: new Date() };
            },
            delete: async () => {
              collMap.delete(id);
              return { writeTime: new Date() };
            }
          };
        },
        add: async (data) => {
          const id = Math.random().toString(36).substring(2, 15);
          collMap.set(id, data);
          return {
            id,
            get: async () => ({
              id,
              exists: true,
              data: () => data
            })
          };
        }
      };
    }
  };
}

module.exports = {
  db,
  isMock,
  FieldValue: admin.apps.length > 0 && admin.firestore ? admin.firestore.FieldValue : {
    serverTimestamp: () => new Date()
  }
};
