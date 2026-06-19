const admin = require('firebase-admin');

// 確保 Firebase 只初始化一次
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

export default async function handler(req, res) {
  try {
    // [讀取] 取得所有身分組
    if (req.method === 'GET') {
      const snap = await db.ref('groups').once('value');
      return res.status(200).json({ success: true, groups: snap.val() || {} });
    }

    if (req.method === 'POST') {
      const { action, groupName, seat } = req.body;
      
      // [新增] 建立新身分組
      if (action === 'add') {
        if (!groupName) throw new Error('缺少身分組名稱');
        await db.ref(`groups/${groupName}`).set({ createdAt: Date.now() });
        return res.status(200).json({ success: true });
      }
      
      // [刪除] 刪除身分組
      if (action === 'delete') {
        if (!groupName) throw new Error('缺少身分組名稱');
        await db.ref(`groups/${groupName}`).remove();
        return res.status(200).json({ success: true });
      }
      
      // [指派] 將學生指派到特定身分組
      if (action === 'assign') {
        if (!seat) throw new Error('缺少座號');
        if (groupName === '全體') {
          // 選擇全體代表「無特定分組」，直接移除節點
          await db.ref(`students/${seat}/group`).remove(); 
        } else {
          await db.ref(`students/${seat}/group`).set(groupName);
        }
        return res.status(200).json({ success: true });
      }
    }
    
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
