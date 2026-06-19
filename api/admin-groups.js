const admin = require('firebase-admin');

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
    if (req.method === 'GET') {
      const snap = await db.ref('groups').once('value');
      return res.status(200).json({ success: true, groups: snap.val() || {} });
    }

    if (req.method === 'POST') {
      const { action, groupName, seat } = req.body;
      
      // [新增身分組]
      if (action === 'add') {
        if (!groupName) throw new Error('缺少身分組名稱');
        // 自動濾除 Firebase 不允許的特殊符號
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
    
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    console.error("Groups API Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
