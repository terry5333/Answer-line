const admin = require('firebase-admin');
const axios = require('axios');

// 確保 Firebase 只初始化一次
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
      
      // 新增身分組
      if (action === 'add') {
        if (!groupName) return res.status(400).json({ success: false, message: '請輸入身分組名稱' });
        const safeName = groupName.replace(/[.#$\[\]]/g, '').trim();
        if (!safeName) return res.status(400).json({ success: false, message: '名稱包含無效字元' });
        
        const existCheck = await db.ref(`groups/${safeName}`).once('value');
        if (existCheck.exists()) return res.status(400).json({ success: false, message: '此身分組名稱已存在' });
        
        await db.ref(`groups/${safeName}`).set({ createdAt: Date.now() });
        return res.status(200).json({ success: true, groupName: safeName });
      }
      
      // 刪除身分組
      if (action === 'delete') {
        if (!groupName) return res.status(400).json({ success: false, message: '缺少身分組名稱' });
        await db.ref(`groups/${groupName}`).remove();
        return res.status(200).json({ success: true });
      }
      
      // 🏆 新增身分組 ➔ 發送極簡藍調 Flex 推播卡片
      if (action === 'assign') {
        if (!seat || !groupName) return res.status(400).json({ success: false, message: '缺少座號或身分組' });
        await db.ref(`students/${seat}/groups/${groupName}`).set(true);
        
        const studentSnap = await db.ref(`students/${seat}`).once('value');
        if (studentSnap.exists()) {
          const studentData = studentSnap.val();
          if (studentData.lineId) {
            const assignFlex = {
              type: "bubble",
              size: "mega",
              body: {
                type: "box", layout: "vertical", paddingAll: "24px", backgroundColor: "#FFFFFF",
                contents: [
                  { type: "text", text: "✨ SmartEdu 系統通知", color: "#3A5FC4", size: "xs", weight: "bold" },
                  { type: "text", text: "已獲取新權限識別", color: "#0F172A", size: "xl", weight: "bold", margin: "md" },
                  {
                    type: "box", layout: "vertical", backgroundColor: "#EDF1FB", paddingAll: "16px", cornerRadius: "14px", margin: "lg",
                    contents: [
                      { type: "text", text: "新增身分組", color: "#3A5FC4", size: "xxs", weight: "bold" },
                      { type: "text", text: `【${groupName}】`, color: "#1E293B", size: "md", weight: "bold", margin: "xs" }
                    ]
                  },
                  { type: "text", text: "您現在可以點擊 LINE 主選單查看該組別的專屬解答與學習資源囉！", color: "#64748B", size: "xs", margin: "md", wrap: true }
                ]
              }
            };
            await sendFlexPushMessage(studentData.lineId, "✨ 獲取新身分組通知", assignFlex, LINE_TOKEN);
          }
        }
        return res.status(200).json({ success: true });
      }

      // 🏆 移除身分組 ➔ 發送莫蘭迪橘 Flex 推播卡片
      if (action === 'unassign') {
        if (!seat || !groupName) return res.status(400).json({ success: false, message: '缺少座號或身分組' });
        await db.ref(`students/${seat}/groups/${groupName}`).remove();
        
        const studentSnap = await db.ref(`students/${seat}`).once('value');
        if (studentSnap.exists()) {
          const studentData = studentSnap.val();
          if (studentData.lineId) {
            const unassignFlex = {
              type: "bubble",
              size: "mega",
              body: {
                type: "box", layout: "vertical", paddingAll: "24px", backgroundColor: "#FFFFFF",
                contents: [
                  { type: "text", text: "📌 SmartEdu 系統通知", color: "#D4654A", size: "xs", weight: "bold" },
                  { type: "text", text: "權限範圍異動異動", color: "#0F172A", size: "xl", weight: "bold", margin: "md" },
                  {
                    type: "box", layout: "vertical", backgroundColor: "#FDF0EC", paddingAll: "16px", cornerRadius: "14px", margin: "lg",
                    contents: [
                      { type: "text", text: "移除身分組", color: "#D4654A", size: "xxs", weight: "bold" },
                      { type: "text", text: `【${groupName}】`, color: "#1E293B", size: "md", weight: "bold", margin: "xs" }
                    ]
                  },
                  { type: "text", text: "管理員已將您自該身分組中移除，如有學習權限配置疑問，請洽詢課程負責教師。", color: "#64748B", size: "xs", margin: "md", wrap: true }
                ]
              }
            };
            await sendFlexPushMessage(studentData.lineId, "📌 身分組移除通知", unassignFlex, LINE_TOKEN);
          }
        }
        return res.status(200).json({ success: true });
      }
    }
    
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🏆 封裝 LINE 主動推播 Flex 訊息專用函式
async function sendFlexPushMessage(to, altText, flexContents, token) {
  if (!token) return;
  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: to,
      messages: [{
        type: "flex",
        altText: altText,
        contents: flexContents
      }]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    console.error('🔴 LINE Flex Push 通知發送失敗:', err.response ? err.response.data : err.message);
  }
}
