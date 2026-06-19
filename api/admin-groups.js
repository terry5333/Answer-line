const admin = require('firebase-admin');

// 確保 Firebase 只初始化一次，且加入環境變數安全網
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // 加入防呆：如果抓不到 key，就不執行 replace 避免 500 當機
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
  }
}

const db = admin.database();

// 🏆 關鍵修正：改用 module.exports，解決 Vercel ES Module 語法衝突導致的 500 錯誤
module.exports = async function(req, res) {
  // 設定 CORS，允許前端呼叫
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const snap = await db.ref('groups').once('value');
      return res.status(200).json({ success: true, groups: snap.val() || {} });
    }

    if (req.method === 'POST') {
      const { action, groupName, seat } = req.body;
      
      // [新增身分組]
      if (action === 'add') {
        if (!groupName) throw new Error('缺少身分組名稱');
        const safeName = groupName.replace(/[.#$\[\]]/g, '');
        if (!safeName) throw new Error('名稱包含無效字元');
        
        await db.ref(`groups/${safeName}`).set({ createdAt: Date.now() });
        return res.status(200).json({ success: true, groupName: safeName });
      }
      
      // [刪除身分組]
      if (action === 'delete') {
        if (!groupName) throw new Error('缺少身分組名稱');
        await db.ref(`groups/${groupName}`).remove();
        return res.status(200).json({ success: true });
      }
      
      // [指派：新增一個身分組給學生]
      if (action === 'assign') {
        if (!seat || !groupName) throw new Error('缺少座號或身分組');
        await db.ref(`students/${seat}/groups/${groupName}`).set(true);
        return res.status(200).json({ success: true });
      }

      // [拔除：移除學生的某個身分組]
      if (action === 'unassign') {
        if (!seat || !groupName) throw new Error('缺少座號或身分組');
        await db.ref(`students/${seat}/groups/${groupName}`).remove();
        return res.status(200).json({ success: true });
      }
    }
    
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    console.error("API 執行錯誤:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
