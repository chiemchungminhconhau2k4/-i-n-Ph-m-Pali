const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                         {aiConfig.provider === 'google' && (
                           <div className="bg-transparent dark:bg-transparent p-3 rounded-lg mt-3 border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30">
                             <p className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#FFFFF0]">Ghi chú: Nếu hệ thống không nhận được khóa Google mới, nó sẽ tiếp tục dùng cấu hình máy chủ chung.</p>
                           </div>
                         )}`;

const insertText = `
                         <div className="mt-5 space-y-3">
                           <label className="block text-sm font-semibold text-[#1E3A8A] dark:text-[#FFFFF0]">Prompt Tùy Chỉnh (Tối thiểu 10.000 ký tự)</label>
                           <p className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#FFFFF0] leading-relaxed">Bộ Prompt này sẽ điều hướng lại cách thức hỗ trợ và văn phong của trợ lý AI (áp dụng cho dịch thuật, tra từ điển, từ nguyên học...).</p>
                           <textarea
                             value={aiConfig.customPrompt || ''}
                             onChange={(e) => saveAiConfig({...aiConfig, customPrompt: e.target.value})}
                             className="w-full bg-white dark:bg-transparent rounded-xl px-4 py-3 text-sm border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/50 transition-all font-medium shadow-sm min-h-[220px] resize-y custom-scrollbar text-[#1E3A8A] dark:text-[#FFFFF0]"
                             placeholder="Nhập Prompt tùy chỉnh (như văn phong, nguyên tắc dịch thuật)..."
                           />
                         </div>

                         <div className="mt-5 space-y-3">
                           <label className="block text-sm font-semibold text-[#1E3A8A] dark:text-[#FFFFF0]">Tải Tài Liệu Huấn Luyện (RAG/LLM) - PDF/CSV</label>
                           <p className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#FFFFF0] leading-relaxed">Tải lên ít nhất 300 tệp PDF/CSV làm ngữ cảnh tham khảo đặc biệt (ngữ nguyên, đặc điểm từ vựng,...).</p>
                           <div className="relative group">
                             <input 
                               type="file" 
                               multiple 
                               accept=".pdf,.csv"
                               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                               onChange={(e) => {
                                 if(e.target.files && e.target.files.length > 0) {
                                   saveAiConfig({...aiConfig, uploadedFilesCount: (aiConfig.uploadedFilesCount || 0) + e.target.files.length});
                                 }
                               }}
                             />
                             <div className="w-full bg-white dark:bg-transparent rounded-xl px-4 py-10 text-sm border-2 border-dashed border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 group-hover:border-[#1E3A8A] dark:group-hover:border-[#FFFFF0] group-hover:bg-[#1E3A8A]/5 dark:group-hover:bg-[#FFFFF0]/5 transition-all flex flex-col items-center justify-center text-[#1E3A8A] dark:text-[#FFFFF0] text-center shadow-sm pointer-events-none relative z-0">
                                <FileText className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform duration-300" />
                                <span className="font-semibold text-[13px]">Bấm hoặc kéo thả tài liệu vào đây</span>
                                <span className="text-[11px] font-medium mt-1">Đã chọn: {aiConfig.uploadedFilesCount || 0} tệp</span>
                             </div>
                           </div>
                         </div>
`;

if (code.includes(target)) {
  code = code.replace(target, target + insertText);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Success");
} else {
  console.log("Target not found");
}
