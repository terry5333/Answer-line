import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }
  const events = req.body.events;
  if (!events || events.length === 0) { res.status(200).send('OK'); return; }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  events.forEach(function(event: any) {
    const replyToken = event.replyToken;

    // 👉 1. 當用戶「加入好友」時，發送主選單卡片
    if (event.type === 'follow') {
      sendMainMenu(replyToken, LINE_TOKEN);
    }
    
    // 👉 2. 殺手鐧：處理「Postback」隱藏回傳，聊天室不會出現文字
    else if (event.type === 'postback') {
      const data = event.postback.data;
      const params = new URLSearchParams(data);
      const action = params.get('action');

      // (A) 切換卡片選單
      if (action === 'menu') {
        const target = params.get('target');
        if (target === 'social') {
          sendSocialMenu(replyToken, LINE_TOKEN);
        } else if (target === 'textbook') {
          sendTextbookMenu(replyToken, LINE_TOKEN);
        } else if (target === 'main') {
          sendMainMenu(replyToken, LINE_TOKEN);
        }
      } 
      // (B) 撈取資料 (解答或課本)
      else if (action === 'fetch') {
        const type = params.get('type') || 'answers'; // 'answers' 或 'textbooks'
        const subject = params.get('subject') || '';
        const titlePrefix = type === 'textbooks' ? `${subject} 課本專區` : `${subject} 解答專區`;
        
        fetchData(type, subject, replyToken, LINE_TOKEN, titlePrefix);
      }
    }
    
    // 👉 3. 備用：如果學生找不到選單，手動打「主選單」還是會跳出來
    else if (event.type === 'message' && event.message.type === 'text') {
      if (event.message.text.trim() === '主選單') {
        sendMainMenu(replyToken, LINE_TOKEN);
      }
    }
  });
  
  res.status(200).send('OK');
}

// === 以下是去 Firebase 抓資料的模組 (純 Callback) ===
function fetchData(dbNode: string, subject: string, replyToken: string, token: string | undefined, titlePrefix: string) {
  db.ref(`${dbNode}/${subject}`).once('value')
    .then(function(snapshot) {
      if (snapshot.exists()) {
        const dataList = Object.values(snapshot.val());
        sendFilesMessage(replyToken, token, titlePrefix, dataList);
      } else {
        replyText(replyToken, token, `目前「${subject}」還沒有上傳任何資料喔！`);
      }
    })
    .catch(function(error) { console.error(error); });
}

// === 以下是傳送 LINE 動態卡片的模組 (全部改用 postback) ===

// 1. 傳送「主選單」卡片
function sendMainMenu(replyToken: string, token: string | undefined) {
  const flexMessage = {
    type: "flex", altText: "主選單",
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#0f172a",
        contents: [
          { type: "text", text: "📚 學習資源中樞", weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "請點擊下方按鈕選擇功能", color: "#94a3b8", size: "xs", margin: "md" }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          // 注意 action 全部改成 postback，且使用 data 帶參數
          { type: "button", style: "primary", color: "#3b82f6", action: { type: "postback", label: "📝 國文解答", data: "action=fetch&type=answers&subject=國文" } },
          { type: "button", style: "primary", color: "#3b82f6", action: { type: "postback", label: "📝 英文解答", data: "action=fetch&type=answers&subject=英文" } },
          { type: "button", style: "primary", color: "#3b82f6", action: { type: "postback", label: "📝 數學解答", data: "action=fetch&type=answers&subject=數學" } },
          { type: "button", style: "secondary", margin: "md", action: { type: "postback", label: "🌍 社會科專區", data: "action=menu&target=social" } },
          { type: "button", style: "secondary", action: { type: "postback", label: "📚 課本電子檔", data: "action=menu&target=textbook" } }
        ]
      }
    }
  };
  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}

// 2. 傳送「社會選單」卡片
function sendSocialMenu(replyToken: string, token: string | undefined) {
  const flexMessage = {
    type: "flex", altText: "社會科專區",
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#047857",
        contents: [
          { type: "text", text: "🌍 社會科專區", weight: "bold", color: "#ffffff", size: "xl" }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#059669", action: { type: "postback", label: "📜 歷史解答", data: "action=fetch&type=answers&subject=歷史" } },
          { type: "button", style: "primary", color: "#059669", action: { type: "postback", label: "🗺️ 地理解答", data: "action=fetch&type=answers&subject=地理" } },
          { type: "button", style: "primary", color: "#059669", action: { type: "postback", label: "⚖️ 公民解答", data: "action=fetch&type=answers&subject=公民" } },
          { type: "button", style: "secondary", margin: "md", action: { type: "postback", label: "🏠 回主選單", data: "action=menu&target=main" } }
        ]
      }
    }
  };
  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}

// 3. 傳送「課本選單」卡片
function sendTextbookMenu(replyToken: string, token: string | undefined) {
  const flexMessage = {
    type: "flex", altText: "課本專區",
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#b45309",
        contents: [
          { type: "text", text: "📚 課本專區", weight: "bold", color: "#ffffff", size: "xl" }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#d97706", action: { type: "postback", label: "📖 國文課本", data: "action=fetch&type=textbooks&subject=國文" } },
          { type: "button", style: "primary", color: "#d97706", action: { type: "postback", label: "📖 英文課本", data: "action=fetch&type=textbooks&subject=英文" } },
          { type: "button", style: "primary", color: "#d97706", action: { type: "postback", label: "📖 數學課本", data: "action=fetch&type=textbooks&subject=數學" } },
          { type: "button", style: "secondary", margin: "md", action: { type: "postback", label: "🏠 回主選單", data: "action=menu&target=main" } }
        ]
      }
    }
  };
  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}

// 4. 傳送資料庫撈出來的檔案清單 (解答/課本按鈕)
function sendFilesMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  const buttons = items.map(function(item: any) {
    return { type: "button", style: "secondary", margin: "sm", height: "sm", action: { type: "uri", label: item.title, uri: item.url } };
  });

  const flexMessage = {
    type: "flex", altText: titleText,
    contents: {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#334155",
        contents: [
          { type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "點擊下方按鈕開啟檔案", color: "#cbd5e1", size: "xs", margin: "md" }
        ]
      },
      body: { type: "box", layout: "vertical", spacing: "md", contents: buttons }
    }
  };

  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}

// 5. 傳送純文字
function replyText(replyToken: string, token: string | undefined, text: string) {
  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}
