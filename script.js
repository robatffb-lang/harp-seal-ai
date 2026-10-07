const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatStream = document.getElementById('chat-stream');
const welcomeScreen = document.getElementById('welcome-screen');
const newChatBtn = document.getElementById('new-chat-btn');

let conversationHistory = [];

// 动态注入打字光标与淡入动画
if (!document.getElementById('harp-seal-animations')) {
  const animStyle = document.createElement('style');
  animStyle.id = 'harp-seal-animations';
  animStyle.innerHTML = `
    @keyframes sealMessageSlide {
      0% { opacity: 0; transform: translateY(12px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes sealPulseGlow {
      0% { opacity: 0.3; transform: scale(0.95); box-shadow: 0 0 4px rgba(34, 211, 238, 0.4); }
      100% { opacity: 1; transform: scale(1.05); box-shadow: 0 0 12px rgba(34, 211, 238, 0.9); }
    }
    .message-row { animation: sealMessageSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .typing-cursor {
      display: inline-block; width: 7px; height: 15px; background: #22d3ee;
      margin-left: 5px; vertical-align: middle; border-radius: 2px;
      animation: sealPulseGlow 0.6s infinite alternate ease-in-out;
    }
  `;
  document.head.appendChild(animStyle);
}

userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 180)}px`;
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  if (welcomeScreen) welcomeScreen.style.display = 'none';

  appendMessage('user', text);
  userInput.value = '';
  userInput.style.height = 'auto';

  // 保存对话历史（Gemini API 要求的格式）
  conversationHistory.push({
    role: 'user',
    parts: [{ text: text }]
  });

  const assistantBubble = appendMessage('assistant', '<span class="typing-cursor"></span>');
  let fullResponseText = '';

  try {
    // 请求 Vercel 的 Serverless Function 接口
    // ⚠️ 替换为你 Vercel Dashboard 上的完整域名
const response = await fetch('https://harp-seal-ai-wkio.vercel.app/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: conversationHistory })
});

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          try {
            const parsed = JSON.parse(dataStr);
            const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunkText) {
              fullResponseText += chunkText;
              const parsedHtml = window.marked ? marked.parse(fullResponseText) : fullResponseText;
              assistantBubble.innerHTML = parsedHtml + '<span class="typing-cursor"></span>';
              chatStream.scrollTo({ top: chatStream.scrollHeight, behavior: 'smooth' });
            }
          } catch (err) {
            console.error('SSE JSON 解析错误:', err);
          }
        }
      }
    }

    // 完成回答后移除打字光标，并保存 Model 的回复到历史记忆中
    assistantBubble.innerHTML = window.marked ? marked.parse(fullResponseText) : fullResponseText;
    conversationHistory.push({
      role: 'model',
      parts: [{ text: fullResponseText }]
    });

  } catch (err) {
    console.error(err);
    assistantBubble.textContent = 'Icy turbulence! Could not fetch a response.';
  }
});

function appendMessage(sender, content) {
  const row = document.createElement('div');
  row.classList.add('message-row', sender);

  const bubble = document.createElement('div');
  bubble.classList.add('message-bubble');
  bubble.innerHTML = content;

  row.appendChild(bubble);
  chatStream.appendChild(row);
  chatStream.scrollTo({ top: chatStream.scrollHeight, behavior: 'smooth' });
  return bubble;
}

if (newChatBtn) {
  newChatBtn.addEventListener('click', () => {
    conversationHistory = [];
    chatStream.innerHTML = '';
    if (welcomeScreen) {
      chatStream.appendChild(welcomeScreen);
      welcomeScreen.style.display = 'block';
    }
  });
}
