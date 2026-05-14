export interface AIConfig {
  provider: 'google' | 'openai' | 'anthropic' | 'deepseek';
  model: string;
  apiKey: string;
  customPrompt?: string;
  uploadedFilesCount?: number;
}

export const defaultAIConfig: AIConfig = {
  provider: 'google',
  model: 'gemini-3.1-pro-preview',
  apiKey: '',
  customPrompt: ''
};

const SYSTEM_INSTRUCTION = "Bạn là một công cụ dịch thuật Pali-Việt tự động. KHÔNG BAO GIỜ giao tiếp, giải thích, hay đưa ra bất kỳ bình luận nào. CHỈ TRẢ VỀ kết quả dịch theo đúng định dạng được yêu cầu. Tính uyên bác, thông thạo tiếng Pali, chuyên dịch thuật Tam Tạng (Tipitaka), Chú giải (Atthakatha) và Phụ chú giải (Tika) được thể hiện qua kết quả dịch chính xác nhất.";

async function callAIEndpoint(prompt: string, systemMessage: string, temperature: number, config: AIConfig) {
  const finalSystemMessage = config.customPrompt && config.customPrompt.trim() !== '' ? config.customPrompt : systemMessage;
  
  if (!config.apiKey && config.provider !== 'google') {
      throw new Error(`API Key is required for provider: ${config.provider}`);
  }

  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      let dataText = '';

      if (config.provider === 'google') {
          // You must secure the API Key. For this electron/browser local app, it's ok.
          const apiKey = config.apiKey || import.meta.env.VITE_GEMINI_API_KEY;
          if (!apiKey) throw new Error("Gemini API key is required");
          
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-3.1-pro-preview'}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  systemInstruction: { parts: [{ text: finalSystemMessage }] },
                  generationConfig: { temperature: temperature }
              })
          });
          if (!res.ok) throw new Error(`Google API Error: ${res.status} ${await res.text()}`);
          const data = await res.json();
          dataText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } 
      else if (config.provider === 'openai') {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.apiKey}`
              },
              body: JSON.stringify({
                  model: config.model || "gpt-4o",
                  messages: [
                      { role: "system", content: finalSystemMessage },
                      { role: "user", content: prompt }
                  ],
                  temperature: temperature,
              })
          });
          if (!res.ok) throw new Error(`OpenAI API Error: ${res.status} ${await res.text()}`);
          const data = await res.json();
          dataText = data.choices?.[0]?.message?.content || '';
      }
      else if (config.provider === 'anthropic') {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'x-api-key': config.apiKey,
                  'anthropic-version': '2023-06-01',
                  'anthropic-dangerous-direct-browser-access': 'true'
              },
              body: JSON.stringify({
                  model: config.model || "claude-3-5-sonnet-20240620",
                  system: finalSystemMessage,
                  messages: [
                      { role: "user", content: prompt }
                  ],
                  max_tokens: 4096,
                  temperature: temperature,
              })
          });
          if (!res.ok) throw new Error(`Anthropic API Error: ${res.status} ${await res.text()}`);
          const data = await res.json();
          dataText = data.content?.[0]?.text || '';
      }
      else if (config.provider === 'deepseek') {
          const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.apiKey}`
              },
              body: JSON.stringify({
                  model: config.model || "deepseek-chat",
                  messages: [
                      { role: "system", content: finalSystemMessage },
                      { role: "user", content: prompt }
                  ],
                  temperature: temperature,
              })
          });
          if (!res.ok) throw new Error(`DeepSeek API Error: ${res.status} ${await res.text()}`);
          const data = await res.json();
          dataText = data.choices?.[0]?.message?.content || '';
      }

      return dataText;

    } catch (err: any) {
      const errStr = err.message || err.toString();
      const isRateLimitOrOverload = errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503") || errStr.includes("high demand");
      
      attempts++;
      
      if (isRateLimitOrOverload && attempts < maxAttempts) {
        console.warn(`AI API overload/rate limit. Attempt ${attempts} of ${maxAttempts}. Retrying in ${attempts * 5} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempts * 5000));
      } else {
        throw err;
      }
    }
  }
}

export async function translatePali(text: string, mode: 'line-by-line' | 'summary' | 'vocabulary', config: AIConfig = defaultAIConfig): Promise<string> {
  let prompt = '';
  
  if (mode === 'line-by-line') {
    prompt = `Bạn là một máy dịch thuật Pali-Việt chuyên nghiệp và nghiêm ngặt. Hệ thống yêu cầu kết quả dịch chính xác từng phần.
TUYỆT ĐỐI KHÔNG sử dụng ngôn ngữ giao tiếp (không chào hỏi, không báo cáo, không nói "Vui lòng cung cấp", "Tôi đã sẵn sàng", "Đây là bản dịch" v.v.).
Chỉ xuất ra kết quả dịch thuật. 

Dịch đoạn văn bản Pali sau sang tiếng Việt. Yêu cầu định dạng:
Mỗi đoạn/câu Pali phải được theo ngay sau bởi một dòng dịch tiếng Việt. Bọc phần dịch tiếng Việt trong cặp thẻ <strong><em>...</em></strong>.

Định dạng CHUẨN:
[Văn bản Pali]
<strong><em>[Bản dịch tiếng Việt]</em></strong>

Văn bản cần dịch:
${text}`;
  } else if (mode === 'summary') {
    prompt = `Hãy đọc đoạn văn bản Pali dưới đây và đưa ra một bản dịch tóm tắt ý chính của đoạn văn bản này sang tiếng Việt. Giọng văn trang trọng, chuẩn xác theo thuật ngữ Phật giáo.\n\nVăn bản:\n${text}`;
  } else if (mode === 'vocabulary') {
    prompt = `Hãy phân tích các từ vựng Pali quan trọng xuất hiện trong đoạn văn bản sau, giải nghĩa từng từ sang tiếng Việt, phân tích từ nguyên (nếu cần) và chỉ ra ngữ pháp của từ đó.\n\nVăn bản:\n${text}`;
  }

  try {
    const textResult = await callAIEndpoint(prompt, SYSTEM_INSTRUCTION, 0.2, config);
    return textResult || '';
  } catch (error: any) {
    console.error("AI API Error:", error);
    throw error;
  }
}

export async function lookupVocabulary(word: string, context: string, config: AIConfig = defaultAIConfig): Promise<string> {
  const prompt = `Người dùng cần tra cứu từ vựng: "${word}" trong ngữ cảnh: "${context.substring(0, 500)}...".
Hãy phân tích chi tiết:
1. Từ vựng gốc: ${word}
2. Ngữ nguyên học (Etymology): Phân tích tiền tố, từ căn, tiếp vĩ ngữ cấu tạo nên từ.
3. Phân tích nghĩa khi ghép các thành tố.
4. Nghĩa tiếng Việt tương đương.
5. Ví dụ minh họa nghĩa (trong 1-2 ngữ cảnh khác).
Trình bày rõ ràng, tao nhã bằng Markdown.`;
  
  try {
    const textResult = await callAIEndpoint(prompt, "Bạn là Trợ lý AI Phật học Pāli tao nhã, uyên bác và tinh tế.", 0.2, config);
    return textResult || '';
  } catch (error: any) {
    console.error("AI API Error:", error);
    return `Xin lỗi, có lỗi xảy ra: ${error.message}`;
  }
}

export async function chatWithAI(question: string, context: string = '', history: any[] = [], config: AIConfig = defaultAIConfig): Promise<string> {
  let formattedHistory = history.map(h => `${h.role === 'user' ? 'Người dùng' : 'Trợ lý AI'}: ${h.content}`).join('\n\n');
  let prompt = `Bạn là Trợ lý AI Phật học Pāli tao nhã, uyên bác và tinh tế. Trả lời các câu hỏi về Phật học, tiếng Pāli, và Tam Tạng một cách trang trọng, từ bi và chính xác.\n\n${context ? `\n\n=== NGỮ CẢNH VĂN BẢN ĐANG ĐỌC CHUYÊN SÂU ===\n${context.substring(0, 5000)}\n====================================` : ''}\n\n=== LỊCH SỬ TRÒ CHUYỆN ===\n${formattedHistory}\n==========================\n\nNgười dùng hiện tại: ${question}`;
  
  try {
    const textResult = await callAIEndpoint(prompt, SYSTEM_INSTRUCTION, 0.4, config);
    return textResult || '';
  } catch (error: any) {
    console.error("AI API Error in chat:", error);
    return `Xin lỗi, có lỗi xảy ra: ${error.message}`;
  }
}
