const admin = require('firebase-admin');

// 確保 Firebase 只初始化一次，且加入環境變數安全網
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
  }
}

const db = admin.database();

module.exports = async function(req, res) {
  // 設定 CORS 跨網域存取權限
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { type, subject, title, url, group } = req.body;
    
    // 驗證必要欄位
    if (!type || !subject || !title || !url) {
      return res.status(400).json({ success: false, message: '缺少必要發佈參數' });
    }

    // 🏆 關鍵修正：確保寫入 Firebase 時，有將身分組權限（若無選擇則預設全體）一併封裝寫入資料庫
    const targetGroup = group || '全體';

    // 於對應資源庫（answers 或 textbooks）的科目下建立新節點
    const newRef = db.ref(`${type}/${subject}`).push();
    await newRef.set({
      title: title,
      url: url,
      group: targetGroup,
      createdAt: Date.now()
    });

    return res.status(200).json({ success: true, id: newRef.key });
  } catch (error) {
    console.error("發佈系統核心錯誤:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
