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
      const apiKey = config.apiKey || import.meta.env.VITE_GEMINI_API_KEY;

      const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              provider: config.provider,
              model: config.model,
              systemMessage: finalSystemMessage,
              prompt: prompt,
              apiKey: apiKey,
              temperature: temperature
          })
      });

      if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Backend API Error: ${res.status}`);
      }
      const data = await res.json();
      return data.text || '';

    } catch (err: any) {
      const errStr = err.message || err.toString();
      const isRateLimitOrOverload = errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503") || errStr.includes("high demand") || errStr.includes("Rate exceeded");
      
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
    prompt = `Hãy đọc đoạn văn bản Pali dưới đây và đưa ra một bản dịch tóm tắt ý chính của đoạn văn bản này sang tiếng Việt. Giọng văn trang trọng, chuẩn xác theo thuật ngữ Phật giáo. YÊU CẦU: Chỉ trình bày mang tính chất liệt kê ngắn gọn thông qua các bullets số hoặc gạch đầu dòng các ý chính được đề cập trong nội dung tài liệu.\n\nVăn bản:\n${text}`;
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
  const prompt = `Bạn là một từ điển bách khoa Pāḷi chuyên nghiệp, đa chiều và khoa học. Yêu cầu phân tích chi tiết từ vựng Pāḷi: "${word}" dựa trên ngữ cảnh: "${context.substring(0, 500)}...".

Vui lòng trình bày theo cấu trúc khoa học sau một cách tường minh, trực quan và sang trọng bằng Markdown, có sử dụng các biểu tượng phù hợp. LƯU Ý: Tránh sử dụng gạch đầu dòng (bullets) quá đà gây mất thẩm mỹ, thay vào đó hãy trình bày bằng văn xuôi gãy gọn trong mỗi mục:

1. 🎯 **Định nghĩa tổng quan (Nghĩa cốt lõi)**
2. 🔬 **Phân tích hình thái & Từ nguyên (Etymology & Morphology)** (Cách cấu tạo từ, chia thì, chia cách, tiền tố, từ căn, hậu tố...)
3. 📚 **Tính đa nghĩa & Đa dụng (Polysemy & Usage)** (Các nét nghĩa khác nhau trong những ngữ cảnh khác nhau của Tipitaka, Atthakatha...)
4. 🧠 **Hàm ý triết học / Đạo lý (Philosophical / Doctrinal Implications)** (Ý nghĩa sâu xa trong ngữ cảnh tu tập, giáo lý)
5. 📖 **Ví dụ minh họa (Examples)** (Tối thiểu 1 ví dụ trích dẫn điển hình khác nếu có)`;
  
  try {
    const textResult = await callAIEndpoint(prompt, "Bạn là Trợ lý AI Phật học Pāli tao nhã, uyên bác, phân tích khoa học đa chiều và tinh tế.", 0.2, config);
    return textResult || '';
  } catch (error: any) {
    console.error("AI API Error:", error);
    return `Xin lỗi, có lỗi xảy ra: ${error.message}`;
  }
}

export async function chatWithAI(question: string, context: string = '', history: any[] = [], config: AIConfig = defaultAIConfig): Promise<string> {
  let formattedHistory = history.map(h => `${h.role === 'user' ? 'Người dùng' : 'Trợ lý AI'}: ${h.content}`).join('\n\n');
  const systemPrompt = `Bạn là Trợ lý AI Phật học Pāli tao nhã, uyên bác và tinh tế. Bạn trả lời các câu hỏi bằng cấu trúc khoa học, trực quan, giải thích dễ hiểu, phân tích đa tầng nghĩa, đa khía cạnh để giúp người dùng có thể nắm bắt ý nghĩa sâu sắc. CẤM lai tạp văn phong ngoại đạo, phải thấm nhuần tinh hoa Theravāda. Thông tin phải bám sát Tam Tạng (Tipiṭaka), Chú giải (Aṭṭhakathā) và Phụ chú giải (Ṭīkā).

Kết thúc phần trả lời, bạn BẮT BUỘC PHẢI đưa ra đúng 3 câu hỏi gợi ý mở rộng nằm ở cuối cùng, dùng để hỏi sâu hơn về khía cạnh Pháp học hoặc chủ đề liên quan. 
Sử dụng chính xác định dạng sau (không giải thích thêm):

---SUGGESTIONS---
1. [Câu hỏi gợi ý 1]
2. [Câu hỏi gợi ý 2]
3. [Câu hỏi gợi ý 3]`;

  let prompt = `Trả lời câu hỏi sau bằng cấu trúc phân tích đa tầng (VD: 1. Ý nghĩa căn bản -> 2. Khía cạnh chuyên sâu / Vi diệu pháp -> 3. Ứng dụng thực tiễn / Tu tập). Dùng Markdown để trình bày. LƯU Ý TRỌNG TÂM: Trình bày nội dung bằng văn xuôi nằm gọn trong các đề mục phân tích được đánh số 1, 2, 3, 4 một cách mô phạm, trôi chảy. Khuyến khích viết thành các đoạn văn mạch lạc thay vì dùng quá nhiều gạch đầu dòng (bullets).
  
${context ? `\n=== NGỮ CẢNH VĂN BẢN ĐANG ĐỌC CHUYÊN SÂU ===\n${context.substring(0, 5000)}\n====================================` : ''}\n\n=== LỊCH SỬ TRÒ CHUYỆN ===\n${formattedHistory}\n==========================\n\nNgười dùng hiện tại: ${question}`;
  
  try {
    const textResult = await callAIEndpoint(prompt, systemPrompt, 0.4, config);
    return textResult || '';
  } catch (error: any) {
    console.error("AI API Error in chat:", error);
    return `Xin lỗi, có lỗi xảy ra: ${error.message}`;
  }
}
