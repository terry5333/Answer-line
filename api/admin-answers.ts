import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
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
      // 🏆 極限防禦：相容 Vercel 的 Buffer 與字串型 Body 解析
      let body = req.body;
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { action, type, subject, key, group } = body || {};
      
      if (action === 'delete') {
        if (!type || !subject) throw new Error('缺少必要參數');
        if (key) {
          await db.ref(`${type}/${subject}/${key}`).remove();
        } else {
          await db.ref(`${type}/${subject}`).remove();
        }
        return res.status(200).json({ success: true });
      }
      
      if (action === 'updateGroup') {
        // 🏆 終極除錯：如果少了任何一個參數，精準回報到底少了誰！
        if (!type || !subject || !key || !group) {
            throw new Error(`缺少修改參數! 類型:${type}, 科目:${subject}, 檔案鍵值:${key}, 身分組:${group}`);
        }
        await db.ref(`${type}/${subject}/${key}/group`).set(group);
        return res.status(200).json({ success: true });
      }

      throw new Error(`未知的系統指令: ${action}`);
    }
    
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: (error as Error).message });
  }
}
