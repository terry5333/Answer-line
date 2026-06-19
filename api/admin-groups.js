const admin = require('firebase-admin');

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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 【讀取清單】
    if (req.method === 'GET') {
      const answersSnap = await db.ref('answers').once('value');
      const textbooksSnap = await db.ref('textbooks').once('value');
      return res.status(200).json({ 
        success: true, 
        answers: answersSnap.val() || {}, 
        textbooks: textbooksSnap.val() || {} 
      });
    }

    if (req.method === 'POST') {
      const { action, type, subject, key, group } = req.body;
      
      // 【刪除資源】
      if (action === 'delete') {
        if (!type || !subject) throw new Error('缺少必要參數');
        if (key) {
          await db.ref(`${type}/${subject}/${key}`).remove();
        } else {
          await db.ref(`${type}/${subject}`).remove();
        }
        return res.status(200).json({ success: true });
      }
      
      // 🏆 【新增功能：變更以前解答的身分組】
      if (action === 'updateGroup') {
        if (!type || !subject || !key || !group) throw new Error('缺少必要修改參數');
        await db.ref(`${type}/${subject}/${key}/group`).set(group);
        return res.status(200).json({ success: true });
      }
    }
    
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
