import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import axios from 'axios';

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
      const snap = await db.ref('groups').once('value');
      return res.status(200).json({ success: true, groups: snap.val() || {} });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { action, groupName, seat } = body || {};
      const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
      
      if (action === 'add') {
        if (!groupName) return res.status(400).json({ success: false, message: '請輸入身分組名稱' });
        const safeName = groupName.replace(/[.#$\[\]]/g, '').trim();
        if (!safeName) return res.status(400).json({ success: false, message: '名稱包含無效字元' });
        
        const existCheck = await db.ref(`groups/${safeName}`).once('value');
        if (existCheck.exists()) return res.status(400).json({ success: false, message: '此身分組名稱已存在' });
        
        await db.ref(`groups/${safeName}`).set({ createdAt: Date.now() });
        return res.status(200).json({ success: true, groupName: safeName });
      }
      
      if (action === 'delete') {
        if (!groupName) return res.status(400).json({ success: false, message: '缺少身分組名稱' });
        await db.ref(`groups/${groupName}`).remove();
        return res.status(200).json({ success: true });
      }
      
      // 🏆 功能 2：被新增身分組時，發送 LINE 通知給學生
      if (action === 'assign') {
        if (!seat || !groupName) return res.status(400).json({ success: false, message: '缺少座號或身分組' });
        await db.ref(`students/${seat}/groups/${groupName}`).set(true);
        
        // 異步撈取學生綁定的 LINE 裝置 ID
        const studentSnap = await db.ref(`students/${seat}`).once('value');
        if (studentSnap.exists()) {
          const studentData = studentSnap.val();
          if (studentData.lineId) {
            await sendPushMessage(
              studentData.lineId, 
              `✨ 系統權限異動通知\n管理員已將您加入【${groupName}】身分組。您現在可以點擊主選單查看此組別的專屬資源囉！`, 
              LINE_TOKEN
            );
          }
        }
        return res.status(200).json({ success: true });
      }

      // 🏆 功能 2：被移除身分組時，發送 LINE 通知給學生
      if (action === 'unassign') {
        if (!seat || !groupName) return res.status(400).json({ success: false, message: '缺少座號或身分組' });
        await db.ref(`students/${seat}/groups/${groupName}`).remove();
        
        const studentSnap = await db.ref(`students/${seat}`).once('value');
        if (studentSnap.exists()) {
          const studentData = studentSnap.val();
          if (studentData.lineId) {
            await sendPushMessage(
              studentData.lineId, 
              `📌 系統權限異動通知\n管理員已將您從【${groupName}】身分組中移除。`, 
              LINE_TOKEN
            );
          }
        }
        return res.status(200).json({ success: true });
      }
    }
    
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: (error as Error).message });
  }
}

// 🏆 封裝 LINE Push 核心主動推播函式
async function sendPushMessage(to: string, text: string, token: string | undefined) {
  if (!token) return;
  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: to,
      messages: [{ type: 'text', text: text }]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    console.error('🔴 LINE Push 通知發送失敗:', err);
  }
}
