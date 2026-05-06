import * as admin from 'firebase-admin';

// 確保 Firebase 只初始化一次
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // 處理私鑰中的換行符號
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    // 假設你使用的是 Realtime Database，如果用 Firestore 則這行可省略
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com` 
  });
}

// 匯出 Realtime Database (若用 Firestore 請改成 admin.firestore())
export const db = admin.database();
