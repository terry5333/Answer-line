import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

// 建立對照表：把你的 Postback 英文科目轉成 Firebase 裡的中文
const subjectMap: Record<string, string> = {
  'chinese': '國文',
  'math': '數學',
  'english': '英文',
  'history': '歷史',
  'geography': '地理',
  'civics': '公民',
  'others': '其他'
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }
  const events = req.body.events;
  if (!events || events.length === 0) { res.status(200).send('OK'); return; }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  events.forEach(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId; // 切換圖文選單需要 userId

    // 👉 專門處理你圖文選單上的 Postback Data
    if (event.type === 'postback') {
      const data = event.postback.data;
      const params = new URLSearchParams(data);
      const action = params.get('action');

      // 🟢 1. 切換選單 (對應：action=switchMenu 或 action=switch)
      if (action === 'switchMenu' || action === 'switch') {
        const target = params.get('target');
        let targetMenuId = '';

        if (target === 'social') targetMenuId = process.env.MENU_SOCIAL || '';
        else if (target === 'textbook') targetMenuId = process.env.MENU_TEXTBOOK || '';
        else if (target === 'main') targetMenuId = process.env.MENU_MAIN || '';

        if (targetMenuId && userId) {
          switchRichMenu(userId, targetMenuId, LINE_TOKEN)
            .then(function() {})
            .catch(function(e) { console.error('切換選單失敗', e); });
        }
      } 
      
      // 🟢 2. 查詢解答 (對應主選單 action=listAnswers 或社會選單 action=list)
      else if (action === 'listAnswers' || action === 'list') {
        const subKey = params.get('subject') || '';
        const dbSubject = subjectMap[subKey] || subKey; // 把 chinese 轉成 國文
        
        fetchData('answers', dbSubject, replyToken, LINE_TOKEN, `${dbSubject} 解答專區`);
      }

      // 🟢 3. 查詢課本 (對應課本選單 action=view)
      else if (action === 'view') {
        const type = params.get('type');
        const subKey = params.get('subject') || '';
        const dbSubject = subjectMap[subKey] || subKey;

        if (type === 'textbook') {
          fetchData('textbooks', dbSubject, replyToken, LINE_TOKEN, `${dbSubject} 課本專區`);
        }
      }
    }
  });
  
  res.status(200).send('OK');
}

// === 去 Firebase 抓資料並發送圖文卡片的模組 ===
function fetchData(dbNode: string, subject: string, replyToken: string, token: string | undefined, titlePrefix: string) {
  db.ref(`${dbNode}/${subject}`).once('value')
    .then(function(snapshot) {
      if (snapshot.exists()) {
        const dataList = Object.values(snapshot.val());
        sendFilesMessage(replyToken, token, titlePrefix, dataList);
      } else {
        // 如果資料庫沒東西，溫馨提醒一下
        replyText(replyToken, token, `目前「${subject}」還沒有上傳任何資料喔！`);
      }
    })
    .catch(function(error) { console.error(error); });
}

// === 傳送 LINE 動態卡片 (檔案按鈕列表) ===
function sendFilesMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  const buttons = items.map(function(item: any) {
    return { 
      type: "button", 
      style: "secondary", 
      margin: "sm", 
      height: "sm", 
      action: { type: "uri", label: item.title, uri: item.url } 
    };
  });

  const flexMessage = {
    type: "flex", 
    altText: titleText,
    contents: {
      type: "bubble", 
      size: "kilo",
      header: {
        type: "box", 
        layout: "vertical", 
        backgroundColor: "#111111", // 極簡黑底風格
        contents: [
          { type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "點擊下方按鈕開啟檔案", color: "#aaaaaa", size: "xs", margin: "md" }
        ]
      },
      body: { 
        type: "box", 
        layout: "vertical", 
        spacing: "md", 
        contents: buttons 
      }
    }
  };

  axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, 
    messages: [flexMessage] 
  }, { 
    headers: { Authorization: `Bearer ${token}` } 
  })
  .then(function(){})
  .catch(function(e){ console.error(e); });
}

// === 切換圖文選單 API ===
function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
}

// === 傳送純文字 (防呆用) ===
function replyText(replyToken: string, token: string | undefined, text: string) {
  axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, 
    messages: [{ type: 'text', text: text }] 
  }, { 
    headers: { Authorization: `Bearer ${token}` } 
  })
  .then(function(){})
  .catch(function(e){});
}
