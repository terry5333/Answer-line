<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>身分認證 | Smart Education</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh; display: flex; justify-content: center; align-items: center;
      padding: 24px; font-family: 'Noto Sans TC', sans-serif; overflow: hidden;
    }
    .orb { position: absolute; border-radius: 50%; filter: blur(80px); z-index: -1; }
    .orb-1 { width: 300px; height: 300px; background: rgba(102, 126, 234, 0.5); top: -10%; left: -10%; }
    .orb-2 { width: 400px; height: 400px; background: rgba(118, 75, 162, 0.5); bottom: -10%; right: -10%; }

    .glass-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.1);
      border-radius: 40px; width: 100%; max-width: 420px; padding: 48px;
    }
    input::placeholder { color: rgba(255, 255, 255, 0.5); }
    .btn-confirm { background: linear-gradient(135deg, #06C755 0%, #05b34c 100%); }
  </style>
</head>
<body>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>

  <div class="glass-card text-center" id="step1">
    <div class="w-20 h-20 bg-white/20 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-inner">
      <span class="text-4xl">🎓</span>
    </div>
    <h1 class="text-3xl font-black text-white mb-2 tracking-tight">身分認證</h1>
    <p class="text-white/70 text-sm mb-10 font-medium">請輸入老師為您預設的座號代碼</p>
    
    <input type="text" id="seatInput" class="w-full p-5 rounded-2xl bg-white/10 border border-white/20 text-white outline-none focus:border-white/50 text-2xl text-center tracking-widest font-black transition mb-6 shadow-inner" placeholder="例如 30125">
    
    <button onclick="checkSeat()" id="checkBtn" class="w-full bg-white text-[#764ba2] font-black py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition duration-200">
      下一步
    </button>
    <p id="errMsg" class="text-red-300 text-sm font-bold mt-6 hidden"></p>
  </div>

  <div class="glass-card text-center hidden" id="step2">
    <div class="w-20 h-20 bg-white/20 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-inner">
      <span class="text-4xl">👋</span>
    </div>
    <h1 class="text-3xl font-black text-white mb-2 tracking-tight">確認身分</h1>
    <p class="text-white/70 text-sm mb-10 font-medium">請確認以下是否為您的正確姓名</p>
    
    <div class="bg-black/10 p-8 rounded-3xl border border-white/10 mb-10 shadow-inner">
      <p class="text-white/40 text-xs font-black mb-2 uppercase tracking-widest">系統偵測姓名</p>
      <p class="text-4xl font-black text-white" id="nameDisplay"></p>
    </div>
    
    <div class="flex flex-col gap-4">
      <button onclick="confirmBind()" id="bindBtn" class="w-full btn-confirm text-white font-black py-5 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition duration-200">
        正確無誤，確認綁定
      </button>
      <button onclick="goBack()" class="text-white/60 font-bold text-sm hover:text-white transition">這不是我，重新輸入</button>
    </div>
  </div>

  <script>
    // ⚠️ 請填入你的 LIFF ID
    var myLiffId = "2009698922-Ili8ydt3";
    var userLineId = "";
    var currentSeat = "";

    liff.init({ liffId: myLiffId }).then(function() {
      if (!liff.isLoggedIn()) liff.login();
      liff.getProfile().then(function(profile) { userLineId = profile.userId; });
    });

    function checkSeat() {
      var seat = document.getElementById('seatInput').value.trim();
      var btn = document.getElementById('checkBtn');
      var err = document.getElementById('errMsg');
      if (!seat) return;

      btn.innerText = "驗證中..."; btn.disabled = true; err.classList.add('hidden');

      fetch('/api/student-bind', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', seat: seat })
      }).then(function(res){ return res.json(); }).then(function(data){
        btn.innerText = "下一步"; btn.disabled = false;
        if (data.success) {
          currentSeat = seat;
          document.getElementById('nameDisplay').innerText = data.name;
          document.getElementById('step1').classList.add('hidden');
          document.getElementById('step2').classList.remove('hidden');
        } else { err.innerText = data.message; err.classList.remove('hidden'); }
      }).catch(function(){ 
        err.innerText = "網路異常"; err.classList.remove('hidden');
        btn.innerText = "下一步"; btn.disabled = false; 
      });
    }

    function goBack() {
      document.getElementById('step2').classList.add('hidden');
      document.getElementById('step1').classList.remove('hidden');
    }

    function confirmBind() {
      var btn = document.getElementById('bindBtn');
      btn.innerText = "正在綁定..."; btn.disabled = true;
      fetch('/api/student-bind', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', seat: currentSeat, lineId: userLineId })
      }).then(function(res){ return res.json(); }).then(function(data){
        if (data.success) {
          liff.sendMessages([{ type: 'text', text: '【系統指令：綁定成功】' }])
            .then(function() { liff.closeWindow(); })
            .catch(function() { liff.closeWindow(); });
        } else { alert("失敗: " + data.message); btn.innerText = "確認綁定"; btn.disabled = false; }
      }).catch(function(){
        alert("網路異常"); btn.innerText = "確認綁定"; btn.disabled = false;
      });
    }
  </script>
</body>
</html>
