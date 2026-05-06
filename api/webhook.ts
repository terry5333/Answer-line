import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

// 建立對照表：把 Postback 的英文科目轉成 Firebase 裡的中文
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

  // ⚠️ 把所有的事件處理變成「任務 (Task)」陣列
  const tasks = events.map(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId; 

    // 🟢 狀況 1：監聽啟動選單傳來的「主選單」文字，幫他切換成 6 宮格
    if (event.type === 'message' && event.message.type === 'text') {
      if (event.message.text.trim() === '主選單') {
        const mainId = process.env.MENU_MAIN || '';
        if (mainId && userId) {
          // 將切換選單的 API 請求 return 出去，讓 Vercel 等待
          return switchRichMenu(userId, mainId, LINE_TOKEN);
        }
      }
    }

    // 🟢 狀況 2：處理圖文選單按下去的隱藏回傳 (Postback)
    else if (event.type === 'postback') {
      const data = event.postback.data;
      const params = new URLSearchParams(data);
      const action = params.get('action');

      // 切換選單 (社會、課本、回主選單)
      if (action === 'switchMenu' || action === 'switch') {
        const target = params.get('target');
        let targetMenuId = '';

        if (target === 'social') targetMenuId = process.env.MENU_SOCIAL || '';
        else if (target === 'textbook') targetMenuId = process.env.MENU_TEXTBOOK || '';
        else if (target === 'main') targetMenuId = process.env.MENU_MAIN || '';

        if (targetMenuId && userId) {
          return switchRichMenu(userId, targetMenuId, LINE_TOKEN);
        }
      } 
      
      // 查詢解答
      else if (action === 'listAnswers' || action === 'list') {
        const subKey = params.get('subject') || '';
        const dbSubject = subjectMap[subKey] || subKey; 
        
        return fetchData('answers', dbSubject, replyToken, LINE_TOKEN, `${dbSubject} 解答專區`);
      }

      // 查詢課本
      else if (action === 'view') {
        const type = params.get('type');
        const subKey = params.get('subject') || '';
        const dbSubject = subjectMap[subKey] || subKey;

        if (type === 'textbook') {
          return fetchData('textbooks', dbSubject, replyToken, LINE_TOKEN, `${dbSubject} 課本專區`);
        }
      }
    }
    
    // 如果使用者傳了無關的貼圖或文字，直接回傳一個已完成的空任務
    return Promise.resolve();
  });

  // ⚠️ 強制 Vercel 等待所有任務執行完畢，才關閉伺服器
  Promise.all(tasks)
    .then(function() {
      res.status(200).send('OK');
    })
    .catch(function(error) {
      console.error('任務執行失敗:', error);
      res.status(500).send('Error');
    });
}

// === 去 Firebase 抓資料並發送圖文卡片的模組 ===
function fetchData(dbNode: string, subject: string, replyToken: string, token: string | undefined, titlePrefix: string) {
  // 記得要 return，讓最外層的 Promise.all 抓得到
  return db.ref(`${dbNode}/${subject}`).once('value')
    .then(function(snapshot) {
      if (snapshot.exists()) {
        const dataList = Object.values(snapshot.val());
        return sendFilesMessage(replyToken, token, titlePrefix, dataList);
      } else {
        return replyText(replyToken, token, `目前「${subject}」還沒有上傳任何資料喔！`);
      }
    });
}

// === 傳送 LINE 動態卡片 ===
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
        backgroundColor: "#111111",
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

  return axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, 
    messages: [flexMessage] 
  }, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
}

// === 切換圖文選單 API ===
function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
}

// === 傳送純文字防呆 ===
function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, 
    messages: [{ type: 'text', text: text }] 
  }, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
}
