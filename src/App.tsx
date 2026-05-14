import React, { useState, useEffect, useRef, memo } from 'react';
import { 
  BookOpen, ChevronRight, ChevronDown, FileText, Layout, Menu, Settings as SettingsIcon,
  Languages, Loader2, Sun, Moon, MessageCircle, Send, Sparkles, RotateCcw,
  PanelRightClose, PanelRightOpen, Cpu, Globe, PanelLeftClose, PanelLeftOpen, 
  ZoomIn, ZoomOut, Bookmark, BookMarked, BookmarkPlus, Trash2, Library, Compass, Check
} from 'lucide-react';
import { PaliNode, TranslationMode } from './data/paliTree';
import { translatePali, chatWithAI, lookupVocabulary, AIConfig, defaultAIConfig } from './services/ai';
import { fetchTipitakaTree, fetchTipitakaXml } from './services/tipitakaManager';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TreeNode: React.FC<{
  node: PaliNode;
  level?: number;
  onSelect: (node: PaliNode) => void;
  selectedId: string | number | null;
}> = ({ node, level = 0, onSelect, selectedId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedId === node.id || (node.a_attr?.href && selectedId === node.a_attr.href);
  const isFolder = node.children && node.children.length > 0;

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node);
    }
  };

  const displayText = node.text || node.name || "Untitled";

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 py-2 px-3 hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/10 cursor-pointer text-[13px] rounded-xl transition-all duration-300
          ${isSelected ? 'bg-white dark:bg-transparent font-semibold text-[#1E3A8A] dark:text-[#FFFFF0] shadow-[0_4px_12px_0_rgba(30,58,138,0.08)] border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30' : 'text-[#1E3A8A] dark:text-[#FFFFF0] border border-transparent'}
        `}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder ? (
          isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#FFFFF0] shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#FFFFF0] shrink-0" />
        ) : (
          <FileText className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${isSelected ? 'text-[#1E3A8A] dark:text-[#FFFFF0] scale-110' : 'text-[#1E3A8A] dark:text-[#FFFFF0]'}`} />
        )}
        <span className="truncate leading-relaxed">{displayText}</span>
      </div>
      {isFolder && isOpen && node.children && (
        <div className="flex flex-col mt-0.5">
          {node.children.map((child, idx) => (
            <TreeNode 
              key={child.id || idx} 
              node={child} 
              level={level + 1} 
              onSelect={onSelect} 
              selectedId={selectedId} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ClickableText: React.FC<{
  text: string;
  onWordClick: (word: string, context: string) => void;
  isActive: boolean;
  fontSize: number;
}> = memo(({ text, onWordClick, isActive, fontSize }) => {
  if (!text) return null;
  if (!isActive) {
    return <div className="whitespace-pre-wrap leading-[2.2] tracking-wide" style={{ fontSize: `${fontSize}px` }}>{text}</div>;
  }

  const tokens = text.split(/(\s+)/);

  return (
    <div className="whitespace-pre-wrap leading-[2.2] tracking-wide" style={{ fontSize: `${fontSize}px` }}>
      {tokens.map((token, i) => {
        if (/\s+/.test(token)) {
          return <React.Fragment key={i}>{token}</React.Fragment>;
        }
        const cleanWord = token.replace(/[^\p{L}\p{M}]/gu, '');
        return (
          <span 
            key={i} 
            onClick={() => cleanWord && onWordClick(cleanWord, text)}
            className="cursor-pointer hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/10 hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:hover:text-[#FFFFF0] rounded px-1 -mx-1 transition-all duration-300 relative"
          >
            {token}
          </span>
        );
      })}
    </div>
  );
});

const ParsedTranslatedBlock: React.FC<{
  htmlText: string;
  onWordClick: (word: string, context: string) => void;
  fontSize: number;
}> = memo(({ htmlText, onWordClick, fontSize }) => {
  if (!htmlText) return null;
  // Split by <strong><em> ... </em></strong>
  const regex = /(<strong><em>.*?<\/em><\/strong>)/gs;
  const parts = htmlText.split(regex);
  
  return (
    <div className="space-y-2 mb-6">
      {parts.map((part, index) => {
        if (part.startsWith('<strong><em>') && part.endsWith('</em></strong>')) {
          const vietText = part.replace(/<\/?strong>/g, '').replace(/<\/?em>/g, '');
          return (
            <div key={index} className="font-bold italic text-[#1E3A8A] dark:text-[#FFFFF0] mt-1 mb-5 font-sans leading-[1.8]" style={{ fontSize: `${Math.max(14, fontSize - 2)}px` }}>
              {vietText}
            </div>
          );
        } else {
          const paliText = part.trim();
          if (!paliText) return null;
          return (
            <div key={index} className="mb-0">
              <ClickableText text={paliText} isActive={true} onWordClick={onWordClick} fontSize={fontSize} />
            </div>
          );
        }
      })}
    </div>
  );
});

export default function App() {
  const { theme, setTheme } = useTheme();
  
  // Script selection
  const [script, setScript] = useState('romn');
  
  // UI Layout State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  // Document State
  const [treeData, setTreeData] = useState<PaliNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<PaliNode | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(true);

  // Reader Settings State
  const [readerFontSize, setReaderFontSize] = useState(20);
  const [bookmarks, setBookmarks] = useState<PaliNode[]>([]);
  
  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(defaultAIConfig);
  const [draftAiConfig, setDraftAiConfig] = useState<AIConfig>(defaultAIConfig);
  const [isAiConfigSaved, setIsAiConfigSaved] = useState(false);

  const [inlineTranslations, setInlineTranslations] = useState<Record<number, string>>({});
  const [activeTranslateIndex, setActiveTranslateIndex] = useState<number>(-1);

  // Tools Panel State (Translation/Dictionary/Bookmarks/Settings)
  const [activeTab, setActiveTab] = useState('translation');
  
  // Translation
  const [translationMode, setTranslationMode] = useState<TranslationMode>('line-by-line');
  const [translationResult, setTranslationResult] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Vocabulary
  const [vocabWord, setVocabWord] = useState('');
  const [vocabData, setVocabData] = useState('');
  const [isVocabLoading, setIsVocabLoading] = useState(false);
  
  // Chat
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch Tree
  useEffect(() => {
    setIsTreeLoading(true);
    fetchTipitakaTree(script)
      .then(data => {
         setTreeData(data); 
         setIsTreeLoading(false);
      })
      .catch(e => {
         console.error('Failed to load tree', e);
         setIsTreeLoading(false);
      });
  }, [script]);

  // Hydrate states from local storage
  useEffect(() => {
    const savedConfig = localStorage.getItem('tipitaka-ai-config');
    if (savedConfig) {
      try { 
        const parsed = JSON.parse(savedConfig);
        setAiConfig(parsed); 
        setDraftAiConfig(parsed);
      } catch (e) { }
    }
    const savedBookmarks = localStorage.getItem('tipitaka-bookmarks');
    if (savedBookmarks) {
      try { setBookmarks(JSON.parse(savedBookmarks)); } catch (e) { }
    }
  }, [script]);

  const saveAiConfig = () => {
    setAiConfig(draftAiConfig);
    localStorage.setItem('tipitaka-ai-config', JSON.stringify(draftAiConfig));
    setIsAiConfigSaved(true);
    setTimeout(() => setIsAiConfigSaved(false), 2000);
  };
  
  const clearAiConfig = () => {
    setAiConfig(defaultAIConfig);
    setDraftAiConfig(defaultAIConfig);
    localStorage.setItem('tipitaka-ai-config', JSON.stringify(defaultAIConfig));
  };
  
  const restoreDefaultAiConfig = () => {
    setDraftAiConfig(defaultAIConfig);
    setAiConfig(defaultAIConfig);
    localStorage.setItem('tipitaka-ai-config', JSON.stringify(defaultAIConfig));
  };

  const toggleBookmark = () => {
    if (!selectedNode) return;
    const exists = bookmarks.find(b => {
        const id1 = b.id || b.a_attr?.href;
        const id2 = selectedNode.id || selectedNode.a_attr?.href;
        return id1 === id2;
    });
    let newBookmarks;
    if (exists) {
        newBookmarks = bookmarks.filter(b => (b.id || b.a_attr?.href) !== (selectedNode.id || selectedNode.a_attr?.href));
    } else {
        newBookmarks = [...bookmarks, selectedNode];
    }
    setBookmarks(newBookmarks);
    localStorage.setItem('tipitaka-bookmarks', JSON.stringify(newBookmarks));
  };

  const isBookmarked = selectedNode && bookmarks.some(b => (b.id || b.a_attr?.href) === (selectedNode.id || selectedNode.a_attr?.href));

  const removeBookmark = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newBookmarks = bookmarks.filter(b => (b.id || b.a_attr?.href) !== id);
    setBookmarks(newBookmarks);
    localStorage.setItem('tipitaka-bookmarks', JSON.stringify(newBookmarks));
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatting, activeTab]);

  const loadDocumentContent = async (node: PaliNode, currentScript: string) => {
    setIsLoadingContent(true);
    setDocumentContent('');
    setTranslationResult('');
    setInlineTranslations({});
    setActiveTranslateIndex(-1);
    setIsMobileMenuOpen(false); 

    let content = '';
    try {
      if (node.a_attr && node.a_attr.href) {
        content = await fetchTipitakaXml(currentScript, node.a_attr.href);
      } else {
        content = node.content || 'Nội dung đang được cập nhật...';
      }
      setDocumentContent(content);
    } catch (e: any) {
      setDocumentContent(e.message || 'Đã có lỗi xảy ra khi tải nội dung từ xml tipitaka.');
    } finally {
      setIsLoadingContent(false);
    }
  };

  useEffect(() => {
    if (selectedNode) {
      loadDocumentContent(selectedNode, script);
    }
  }, [script]);

  const handleSelectNode = (node: PaliNode) => {
    setSelectedNode(node);
    loadDocumentContent(node, script);
  };

  const handleTranslate = async () => {
    if (!documentContent) return;
    setIsTranslating(true);
    
    if (translationMode === 'summary') {
      setTranslationResult('');
      if (window.innerWidth < 1024) setActiveTab('translation');
      try {
        const textToProcess = documentContent.slice(0, 4000); 
        const result = await translatePali(textToProcess, translationMode, aiConfig);
        setTranslationResult(result);
      } catch (e: any) {
        setTranslationResult("Đã có lỗi xảy ra: " + (e.message || e.toString()) + ". Xin vui lòng thử lại.");
      } finally {
        setIsTranslating(false);
      }
    } else if (translationMode === 'line-by-line') {
      if (window.innerWidth < 1024) setActiveTab('translation');
      setTranslationResult('Đang tiến hành dịch từng đoạn trực tiếp trên văn bản...');
      setInlineTranslations({});
      
      const blocks = documentContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      for (let i = 0; i < blocks.length; i++) {
         try {
            if (i > 0) await new Promise(r => setTimeout(r, 1000)); // 1s base delay between chunks
            const res = await translatePali(blocks[i] + '\n\n', 'line-by-line', aiConfig);
            
            // Lọc bỏ những câu giao tiếp không mong muốn nếu AI vi phạm prompt
            let filteredRes = res.trim();
            const badPhrases = [
               "Vui lòng cung cấp đoạn văn bản",
               "Tôi đã sẵn sàng",
               "đúng định dạng yêu cầu",
               "Vui lòng chọn đoạn văn bản"
            ];
            
            // Nếu AI chỉ trả về toàn câu giao tiếp mà không phải bản dịch, fallback về giữ nguyên văn bản gốc
            if (badPhrases.some(phrase => filteredRes.includes(phrase)) && !filteredRes.includes("<strong>")) {
               filteredRes = `${blocks[i]}\n<strong><em>[Không thể dịch đoạn này]</em></strong>`;
            } else {
               // Xóa bỏ các dòng thừa nếu có dính cụm từ giao tiếp mồ côi
               badPhrases.forEach(phrase => {
                  const regex = new RegExp(`.*${phrase}.*\n?`, 'gi');
                  filteredRes = filteredRes.replace(regex, '');
               });
            }
            
            setInlineTranslations(prev => ({...prev, [i]: filteredRes.trim()}));
         } catch (e: any) {
            const errStr = e.message || e.toString();
            setTranslationResult('Đã có lỗi xảy ra trong quá trình dịch: ' + errStr);
            setIsTranslating(false);
            return; 
         }
      }
      setIsTranslating(false);
      setTranslationResult('Đã hoàn tất quá trình biên dịch.');
    }
  };

  const handleWordClick = async (word: string, context: string) => {
    setVocabWord(word);
    setVocabData('');
    setActiveTab('dictionary');
    if (window.innerWidth < 1024) setIsRightPanelOpen(true);
    setIsVocabLoading(true);
    
    try {
      const res = await lookupVocabulary(word, context, aiConfig);
      setVocabData(res);
    } catch (e) {
      setVocabData("Lỗi khi tra từ vựng.");
    } finally {
      setIsVocabLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, {role: 'user', content: userMsg}]);
    setIsChatting(true);

    try {
      const context = documentContent ? documentContent.slice(0, 2000) : '';
      const res = await chatWithAI(userMsg, context, chatMessages, aiConfig);
      setChatMessages(prev => [...prev, {role: 'ai', content: res}]);
    } catch (e) {
      setChatMessages(prev => [...prev, {role: 'ai', content: 'Lỗi kết nối AI.'}]);
    } finally {
      setIsChatting(false);
    }
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-transparent dark:bg-transparent border-r border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30">
      <div className="px-5 py-5 font-bold text-xs text-[#1E3A8A] dark:text-[#FFFFF0] uppercase tracking-widest flex items-center justify-between shrink-0 mb-2">
        <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#1E3A8A] dark:text-[#FFFFF0]" /> Thư Viện Điển Phạm Pali</span>
      </div>
      <div className="flex-1 px-3 overflow-y-auto custom-scrollbar">
        <div className="pb-6 space-y-1">
          {isTreeLoading ? (
             <div className="flex justify-center p-8 text-[#1E3A8A] dark:text-[#FFFFF0]"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            treeData.map((node, idx) => (
              <TreeNode 
                key={node.id || idx} 
                node={node} 
                onSelect={handleSelectNode} 
                selectedId={selectedNode?.id || selectedNode?.a_attr?.href || null} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  const displayTitle = selectedNode?.text || selectedNode?.paliName || "Nội dung Tipiṭaka";

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-white dark:bg-transparent font-sans text-[#1E3A8A] dark:text-[#FFFFF0] overflow-hidden">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-5 h-16 border-b border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 glass-panel shrink-0 z-20 transition-all">
        <div className="flex items-center gap-3 sm:gap-4">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger className="md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent dark:bg-transparent transition-all hover:bg-[#1E3A8A]/10 hover:text-[#1E3A8A] dark:text-[#FFFFF0] dark:hover:bg-[#FFFFF0]/10 dark:hover:text-[#FFFFF0] h-10 w-10 ">
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[85%] sm:w-[350px] border-r-[#1E3A8A] dark:border-r-[#FFFFF0]">
              {SidebarContent}
            </SheetContent>
          </Sheet>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className={`h-10 w-10 rounded-xl hidden md:flex transition-all duration-300  ${isLeftPanelOpen ? 'bg-transparent dark:bg-transparent text-[#1E3A8A] dark:text-[#FFFFF0] shadow-sm' : 'text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:hover:text-[#FFFFF0] hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/10'}`}
          >
            {isLeftPanelOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </Button>

          <div className="flex items-center gap-3 group cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#1E3A8A] dark:from-[#FFFFF0] dark:to-[#FFFFF0] shadow-[0_4px_16px_rgba(30,58,138,0.4)] dark:shadow-[0_4px_16px_rgba(255,255,240,0.4)] text-white dark:text-[#2b2d31] group-hover:shadow-[0_8px_24px_rgba(30,58,138,0.6)] dark:group-hover:shadow-[0_8px_24px_rgba(255,255,240,0.6)] transition-all duration-500">
               <Library className="w-5 h-5 relative z-10 transition-transform group-hover:rotate-12 duration-500" />
               <Sparkles className="w-3.5 h-3.5 absolute -bottom-1 -right-1 text-[#1E3A8A] dark:text-[#FFFFF0] opacity-90 animate-pulse" />
            </div>
            <h1 className="font-serif font-bold text-[22px] tracking-wide text-[#1E3A8A] dark:text-[#FFFFF0] group-hover:text-[#1E3A8A] dark:group-hover:text-[#FFFFF0] transition-colors duration-300 uppercase">
              ĐIỂN PHẠM PALI
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Select value={script} onValueChange={setScript}>
            <SelectTrigger className="w-[110px] md:w-[140px] h-10 text-xs md:text-sm font-medium bg-white/50 dark:bg-[#FFFFF0]/10 text-[#1E3A8A] dark:text-[#FFFFF0] border border-[#1E3A8A]/20 dark:border-[#FFFFF0]/30 rounded-xl shrink-0 transition-all duration-300 hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/15 hover:shadow-sm focus:ring-1 focus:ring-[#1E3A8A]/30">
              <Globe className="w-4 h-4 mr-1.5 opacity-70 text-[#1E3A8A] dark:text-[#FFFFF0]" />
              <SelectValue placeholder="Văn tự" />
            </SelectTrigger>
            <SelectContent className="border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 bg-white/95 dark:bg-transparent backdrop-blur-xl">
              <SelectItem value="romn">Roman</SelectItem>
              <SelectItem value="mymr">Myanmar</SelectItem>
              <SelectItem value="thai">Thai</SelectItem>
              <SelectItem value="deva">Devanagari</SelectItem>
              <SelectItem value="sinh">Sinhala</SelectItem>
              <SelectItem value="khmr">Khmer</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 rounded-xl text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:hover:text-[#FFFFF0] hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/10 shrink-0 transition-all duration-300 "
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`h-10 w-10 rounded-xl hidden lg:flex shrink-0 transition-all duration-300  ${isRightPanelOpen ? 'bg-transparent dark:bg-transparent text-[#1E3A8A] dark:text-[#FFFFF0] shadow-sm' : 'text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:hover:text-[#FFFFF0] hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/10'}`}
          >
            {isRightPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </Button>
          
          <Sheet>
             <SheetTrigger className="lg:hidden inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors bg-transparent dark:bg-transparent text-[#1E3A8A] dark:text-[#FFFFF0] hover:bg-[#1E3A8A]/10 hover:text-[#1E3A8A] dark:text-[#FFFFF0] dark:hover:bg-[#FFFFF0]/10 dark:hover:text-white shrink-0 h-10 w-10">
                <Layout className="w-5 h-5" />
             </SheetTrigger>
             <SheetContent side="right" className="p-0 w-[85vw] sm:w-[400px] border-l-[#1E3A8A] dark:border-l-[#FFFFF0]">
                {/* Mobile Tools Panel content is managed within via tabs */}
             </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Framework */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar */}
        <div className={`hidden md:flex flex-col shrink-0 z-10 bg-transparent dark:bg-transparent border-r border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
          ${isLeftPanelOpen ? 'w-[300px] translate-x-0' : 'w-0 border-none -translate-x-full opacity-0'}`}
        >
          <div className="w-[300px] h-full flex flex-col">
             {SidebarContent}
          </div>
        </div>

        {/* Center Reader Area */}
        <div className="flex-1 flex flex-col relative z-0 min-w-0 bg-white/50 dark:bg-transparent">
          {selectedNode ? (
            <>
              <div className="flex flex-row items-center justify-between py-4 px-6 md:px-10 border-b border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 shrink-0 sticky top-0 glass-panel z-10">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="font-serif font-bold text-2xl text-[#1E3A8A] dark:text-[#FFFFF0] truncate">
                    {displayTitle}
                  </h2>
                </div>
                <div className="flex flex-row items-center gap-1 sm:gap-2 shrink-0 bg-transparent dark:bg-transparent p-1.5 rounded-2xl border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 hover-glow">
                   <Button variant="ghost" size="icon" onClick={() => setReaderFontSize(f => Math.max(12, f - 2))} className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:bg-white dark:hover:text-[#FFFFF0] dark:hover:bg-[#FFFFF0]/10 transition-colors">
                       <ZoomOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                   </Button>
                   <div className="text-sm font-semibold text-[#1E3A8A] dark:text-[#FFFFF0] w-6 sm:w-8 text-center select-none font-sans">{readerFontSize}</div>
                   <Button variant="ghost" size="icon" onClick={() => setReaderFontSize(f => Math.min(32, f + 2))} className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:bg-white dark:hover:text-[#FFFFF0] dark:hover:bg-[#FFFFF0]/10 transition-colors">
                       <ZoomIn className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                   </Button>
                   <div className="w-px h-5 bg-transparent dark:bg-transparent mx-1"></div>
                   <Button variant="ghost" size="icon" onClick={toggleBookmark} className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl transition-all duration-300 ${isBookmarked ? 'text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent dark:text-[#FFFFF0] dark:bg-transparent shadow-sm' : 'text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-[#1E3A8A] dark:text-[#FFFFF0] hover:bg-white dark:hover:text-[#FFFFF0] dark:hover:bg-[#FFFFF0]/10'}`}>
                       {isBookmarked ? <Bookmark className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" /> : <BookmarkPlus className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                   </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6 md:p-10 lg:p-16 max-w-4xl mx-auto">
                  {isLoadingContent ? (
                     <div className="space-y-8 pt-6">
                        <Skeleton className="h-6 w-[80%] rounded-lg bg-transparent dark:bg-transparent" />
                        <Skeleton className="h-6 w-[95%] rounded-lg bg-transparent dark:bg-transparent" />
                        <Skeleton className="h-6 w-[85%] rounded-lg bg-transparent dark:bg-transparent" />
                        <Skeleton className="h-6 w-[40%] rounded-lg bg-transparent dark:bg-transparent" />
                     </div>
                  ) : (
                    <div className="prose prose-sky dark:prose-invert max-w-none font-serif text-[#1E3A8A] dark:text-[#FFFFF0] tracking-wide">
                      {documentContent ? (
                        <div className="space-y-6">
                          {documentContent.split(/\n\s*\n/).filter(p => p.trim() !== '').map((para, i) => (
                            <div key={i} className="mb-6 relative">
                               {inlineTranslations[i] ? (
                                  <ParsedTranslatedBlock 
                                     htmlText={inlineTranslations[i]}
                                     onWordClick={handleWordClick}
                                     fontSize={readerFontSize}
                                  />
                               ) : (
                                  <ClickableText 
                                     text={para} 
                                     isActive={true} 
                                     onWordClick={handleWordClick}
                                     fontSize={readerFontSize}
                                  />
                               )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-[#1E3A8A] dark:text-[#FFFFF0]">
                           <FileText className="w-16 h-16 mb-6" />
                           <p className="font-sans text-lg">Không tìm thấy nội dung.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center bg-white/20 dark:bg-transparent w-full h-full p-6 text-center text-[#1E3A8A] dark:text-[#FFFFF0]">
              <div className="relative mb-10 interactive-bounce">
                <Compass className="w-24 h-24 stroke-[1]" />
                <div className="absolute inset-0 bg-transparent blur-3xl opacity-10 rounded-full" />
              </div>
              <p className="font-serif text-3xl font-bold tracking-wide text-[#1E3A8A] dark:text-[#FFFFF0]">Bắt đầu Khảo Cứu</p>
              <p className="font-sans mt-3 text-base text-[#1E3A8A] dark:text-[#FFFFF0] max-w-md mx-auto leading-relaxed">
                Xin hãy lựa chọn một bộ kinh ở mục lục bên trái để mở ra trí tuệ giải thoát cổ xưa. Từng đoạn văn, từng từ một đều được phân tích sâu sắc.
              </p>
            </div>
          )}
        </div>

        {/* Right Tools Panel */}
        <div 
          className={`flex-col shrink-0 border-l border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 bg-transparent dark:bg-transparent transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] hidden lg:block backdrop-blur-sm
            ${isRightPanelOpen ? 'w-[420px] translate-x-0' : 'w-0 border-none translate-x-full opacity-0'}`}
        >
          <div className="h-full flex flex-col w-[420px]">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col pt-3">
               <div className="px-4 pb-2 shrink-0">
                 <TabsList className="flex w-full items-center justify-between bg-transparent dark:bg-transparent rounded-2xl p-1.5 h-12 shadow-inner">
                   <TabsTrigger value="translation" className="flex-1 px-1 h-full text-[13px] font-semibold rounded-xl data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] dark:data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-sm transition-all"><Sparkles className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">Dịch</span></TabsTrigger>
                   <TabsTrigger value="dictionary" className="flex-1 px-1 h-full text-[13px] font-semibold rounded-xl data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] dark:data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-sm transition-all"><BookOpen className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">Từ Điển</span></TabsTrigger>
                   <TabsTrigger value="chat" className="flex-1 px-1 h-full text-[13px] font-semibold rounded-xl data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] dark:data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-sm transition-all"><MessageCircle className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">Hỏi Đáp</span></TabsTrigger>
                   <TabsTrigger value="bookmarks" className="flex-1 px-1 h-full text-[13px] font-semibold rounded-xl data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] dark:data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-sm transition-all"><Library className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">Lưu</span></TabsTrigger>
                   <TabsTrigger value="settings" className="flex-1 px-1 h-full text-[13px] font-semibold rounded-xl data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] dark:data-[state=active]:text-[#1E3A8A] dark:text-[#FFFFF0] bg-transparent data-[state=active]:bg-white dark:data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-sm transition-all"><SettingsIcon className="w-4 h-4"/></TabsTrigger>
                 </TabsList>
               </div>

               {/* TRANSLATION TAB */}
               <TabsContent value="translation" className="flex-1 flex flex-col m-0 outline-none fade-in-0 h-full overflow-hidden">
                 <div className="p-5 shrink-0 border-b border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 bg-white/70 dark:bg-transparent">
                    <div className="flex gap-3">
                       <Select value={translationMode} onValueChange={(v: any) => setTranslationMode(v)}>
                         <SelectTrigger className="flex-1 h-11 rounded-xl bg-white dark:bg-transparent border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 font-medium">
                           <SelectValue placeholder="Chế độ dịch" />
                         </SelectTrigger>
                         <SelectContent className="border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 bg-white/95 dark:bg-transparent backdrop-blur-xl">
                           <SelectItem value="line-by-line">Dịch Đối Chiếu Từng Dòng</SelectItem>
                           <SelectItem value="summary">Dịch Tóm Tắt Ý Chính</SelectItem>
                         </SelectContent>
                       </Select>
                       <Button 
                         onClick={handleTranslate} 
                         disabled={!documentContent || isTranslating}
                         className="h-11 px-7 btn-exquisite rounded-xl h-11"
                       >
                         {isTranslating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bắt Đầu'}
                       </Button>
                    </div>
                    <div className="mt-4 text-[11px] text-[#1E3A8A] dark:text-[#FFFFF0] font-semibold uppercase tracking-widest flex items-center gap-1.5 justify-center">
                       <Cpu className="w-3.5 h-3.5" /> Chạy bởi {aiConfig.provider} : {aiConfig.model}
                    </div>
                 </div>
                 <div className="flex-1 bg-white/40 dark:bg-transparent overflow-y-auto custom-scrollbar">
                    <div className="p-6 md:p-8">
                       {translationResult ? (
                         <div className="markdown-body prose prose-sky dark:prose-invert max-w-none text-[#1E3A8A] dark:text-[#FFFFF0]">
                           <Markdown remarkPlugins={[remarkGfm]}>{translationResult}</Markdown>
                         </div>
                       ) : isTranslating ? (
                         <div className="space-y-6">
                           <Skeleton className="h-4 w-full rounded-md bg-transparent dark:bg-transparent" />
                           <Skeleton className="h-4 w-[90%] rounded-md bg-transparent dark:bg-transparent" />
                           <Skeleton className="h-4 w-[95%] rounded-md bg-transparent dark:bg-transparent" />
                           <Skeleton className="h-4 w-[80%] rounded-md bg-transparent dark:bg-transparent" />
                         </div>
                       ) : (
                         <div className="flex flex-col items-center justify-center h-48 text-[#1E3A8A] dark:text-[#FFFFF0]">
                           <Languages className="w-12 h-12 mb-4" />
                           <p className="text-sm font-medium">Bấm Bắt Đầu để biên dịch nội dung.</p>
                         </div>
                       )}
                    </div>
                 </div>
               </TabsContent>

               {/* DICTIONARY TAB */}
               <TabsContent value="dictionary" className="flex-1 flex flex-col m-0 outline-none fade-in-0 h-full overflow-hidden relative bg-white/40 dark:bg-transparent">
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 md:p-8">
                      {vocabWord ? (
                        <div className="mb-6">
                           <h3 className="font-serif text-3xl font-bold text-[#1E3A8A] dark:text-[#FFFFF0] mb-5">{vocabWord}</h3>
                           {isVocabLoading ? (
                             <div className="flex items-center gap-3 text-[#1E3A8A] dark:text-[#FFFFF0]">
                               <Loader2 className="w-5 h-5 animate-spin" />
                               <span className="text-sm font-medium">Đang phân tích sâu sắc...</span>
                             </div>
                           ) : (
                             <div className="markdown-body prose prose-sky dark:prose-invert max-w-none text-[#1E3A8A] dark:text-[#FFFFF0]">
                               <Markdown remarkPlugins={[remarkGfm]}>{vocabData}</Markdown>
                             </div>
                           )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-[#1E3A8A] dark:text-[#FFFFF0]">
                           <BookOpen className="w-20 h-20 mb-6 stroke-[1]" />
                           <p className="text-center font-serif text-2xl font-bold text-[#1E3A8A] dark:text-[#FFFFF0]">Từ Điển Pāḷi</p>
                           <p className="text-center text-sm font-sans mt-3 px-4 leading-relaxed">Bấm vào bất kỳ từ nào trong đoạn văn để hiển thị phân tích cấu trúc, ngữ pháp và gốc từ chi tiết.</p>
                        </div>
                      )}
                    </div>
                  </div>
               </TabsContent>

               {/* CHAT TAB */}
               <TabsContent value="chat" className="flex-1 flex flex-col m-0 outline-none fade-in-0 h-full overflow-hidden bg-white/40 dark:bg-transparent">
                  <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-[#1E3A8A] dark:text-[#FFFFF0]">
                         <MessageCircle className="w-16 h-16 mb-5 stroke-[1]" />
                         <p className="text-base font-semibold">Bạn có thắc mắc gì về Phật học?</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-[24px] px-6 py-4 text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' 
                            ? 'bg-transparent text-white rounded-br-none shadow-[0_4px_14px_0_rgba(30,58,138,0.3)]' 
                            : 'bg-white dark:bg-transparent border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 text-[#1E3A8A] dark:text-[#FFFFF0] rounded-bl-none'}`}>
                            <div className="markdown-body prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                              <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {isChatting && (
                       <div className="flex justify-start">
                         <div className="bg-white dark:bg-transparent border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 rounded-[24px] rounded-bl-none px-6 py-5 flex gap-2 items-center shadow-sm">
                            <div className="w-2 h-2 bg-transparent rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-transparent rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-2 h-2 bg-transparent rounded-full animate-bounce [animation-delay:0.4s]" />
                         </div>
                       </div>
                    )}
                  </div>
                  <div className="p-5 glass-panel border-t border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 shrink-0">
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                        placeholder="Nhập câu hỏi của bạn..."
                        className="w-full bg-white dark:bg-transparent rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/50 transition-all font-medium border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 shadow-sm"
                      />
                      <Button 
                        onClick={handleSendChat}
                        disabled={!chatInput.trim() || isChatting}
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 w-10 h-10 rounded-full btn-exquisite shadow-md disabled:opacity-50"
                      >
                        <Send className="w-4.5 h-4.5" />
                      </Button>
                    </div>
                  </div>
               </TabsContent>

               {/* BOOKMARKS TAB */}
               <TabsContent value="bookmarks" className="flex-1 flex flex-col m-0 outline-none fade-in-0 h-full overflow-hidden bg-white/40 dark:bg-transparent">
                  <div className="p-5 px-6 border-b border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 font-semibold text-sm text-[#1E3A8A] dark:text-[#FFFFF0] flex items-center gap-2.5 tracking-wide uppercase">
                     <Library className="w-4.5 h-4.5 text-[#1E3A8A] dark:text-[#FFFFF0]" /> Kinh Điển Đã Lưu
                  </div>
                  <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                     {bookmarks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-[#1E3A8A] dark:text-[#FFFFF0]">
                           <Bookmark className="w-12 h-12 mb-4" />
                           <p className="text-sm font-medium">Bạn chưa lưu văn bản nào.</p>
                        </div>
                     ) : (
                        <div className="space-y-3">
                           {bookmarks.map((bm, idx) => (
                              <div key={bm.id || bm.a_attr?.href || idx} 
                                 onClick={() => handleSelectNode(bm)}
                                 className="group flex flex-col p-4 rounded-2xl border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 bg-white dark:bg-transparent hover:bg-[#1E3A8A]/10 dark:hover:bg-[#FFFFF0]/10 hover:border-[#1E3A8A]/50 dark:hover:border-[#FFFFF0]/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md">
                                 <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                       <h4 className="font-serif font-bold text-[#1E3A8A] dark:text-[#FFFFF0] truncate text-base">{bm.text || bm.paliName || "Văn bản đã lưu"}</h4>
                                       <p className="font-sans text-sm text-[#1E3A8A] dark:text-[#FFFFF0] line-clamp-1 mt-1">{bm.name}</p>
                                    </div>
                                    <Button 
                                       variant="ghost" 
                                       size="icon" 
                                       onClick={(e) => removeBookmark(bm.id || bm.a_attr?.href || idx, e)}
                                       className="w-8 h-8 text-[#1E3A8A] dark:text-[#FFFFF0] hover:text-white hover:bg-[#1E3A8A] dark:hover:bg-[#FFFFF0]/80 dark:hover:text-[#3A3F47] opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl shrink-0"
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </Button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </TabsContent>

               {/* SETTINGS TAB */}
               <TabsContent value="settings" className="flex-1 flex flex-col m-0 outline-none fade-in-0 h-full overflow-hidden bg-white/40 dark:bg-transparent">
                 <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <div className="p-6 md:p-8 space-y-8">
                     <div className="space-y-6">
                       <div>
                         <h3 className="font-bold text-[#1E3A8A] dark:text-[#FFFFF0] mb-1.5 flex items-center gap-2"><Cpu className="w-4 h-4 text-[#1E3A8A] dark:text-[#FFFFF0]" /> Cấu Hình AI</h3>
                         <p className="text-xs font-medium text-[#1E3A8A] dark:text-[#FFFFF0] mb-4">Cung cấp lựa chọn công nghệ tương tác phù hợp nhất cho việc tìm kiếm.</p>
                         
                         <label className="block text-sm font-semibold mb-2 text-[#1E3A8A] dark:text-[#FFFFF0]">Nhà cung cấp Mô hình</label>
                         <Select value={draftAiConfig.provider} onValueChange={(val: any) => setDraftAiConfig({...draftAiConfig, provider: val})}>
                           <SelectTrigger className="w-full rounded-xl bg-white dark:bg-transparent h-12 border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 focus:ring-[#1E3A8A]/50 transition-all font-medium mb-5 shadow-sm">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 bg-white/95 dark:bg-transparent backdrop-blur-xl">
                             <SelectItem value="google">Google Gemini API </SelectItem>
                             <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                             <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                             <SelectItem value="deepseek">DeepSeek AI</SelectItem>
                           </SelectContent>
                         </Select>

                         <label className="block text-sm font-semibold mb-2 text-[#1E3A8A] dark:text-[#FFFFF0]">Tên Mô hình (Model Name)</label>
                         <input 
                           type="text" 
                           value={draftAiConfig.model}
                           onChange={(e) => setDraftAiConfig({...draftAiConfig, model: e.target.value})}
                           className="w-full bg-white dark:bg-transparent rounded-xl px-4 py-3 text-sm border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/50 transition-all focus:border-[#1E3A8A]/50 font-medium shadow-sm mb-5"
                           placeholder="Ví dụ: gpt-4o, claude-3-opus..."
                         />

                         <label className="block text-sm font-semibold mb-2 text-[#1E3A8A] dark:text-[#FFFFF0]">API Key Khách Hàng</label>
                         <p className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#FFFFF0] mb-2 leading-relaxed">Bộ khóa được lưu trữ an toàn trong trình duyệt cục bộ của bạn, không gửi đi bất kỳ hệ thống lưu trữ bên ngoài nào khác.</p>
                         <input 
                           type="password" 
                           value={draftAiConfig.apiKey}
                           onChange={(e) => setDraftAiConfig({...draftAiConfig, apiKey: e.target.value})}
                           className="w-full bg-white dark:bg-transparent rounded-xl px-4 py-3 text-sm border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/50 transition-all focus:border-[#1E3A8A]/50 font-medium shadow-sm"
                           placeholder="Nhập API Key của bạn..."
                         />
                         {draftAiConfig.provider === 'google' && (
                           <div className="bg-transparent dark:bg-transparent p-3 rounded-lg mt-3 border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30">
                             <p className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#FFFFF0]">Ghi chú: Nếu hệ thống không nhận được khóa Google mới, nó sẽ tiếp tục dùng cấu hình máy chủ chung.</p>
                           </div>
                         )}
                         <div className="mt-5 space-y-3">
                           <label className="block text-sm font-semibold text-[#1E3A8A] dark:text-[#FFFFF0]">Prompt Tùy Chỉnh (Tối thiểu 10.000 ký tự)</label>
                           <p className="text-[11px] font-medium text-[#1E3A8A] dark:text-[#FFFFF0] leading-relaxed">Bộ Prompt này sẽ điều hướng lại cách thức hỗ trợ và văn phong của trợ lý AI (áp dụng cho dịch thuật, tra từ điển, từ nguyên học...).</p>
                           <textarea
                             value={draftAiConfig.customPrompt || ''}
                             onChange={(e) => setDraftAiConfig({...draftAiConfig, customPrompt: e.target.value})}
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
                                   setDraftAiConfig({...draftAiConfig, uploadedFilesCount: (draftAiConfig.uploadedFilesCount || 0) + e.target.files.length});
                                 }
                               }}
                             />
                             <div className="w-full bg-white dark:bg-transparent rounded-xl px-4 py-10 text-sm border-2 border-dashed border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 group-hover:border-[#1E3A8A] dark:group-hover:border-[#FFFFF0] group-hover:bg-[#1E3A8A]/5 dark:group-hover:bg-[#FFFFF0]/5 transition-all flex flex-col items-center justify-center text-[#1E3A8A] dark:text-[#FFFFF0] text-center shadow-sm pointer-events-none relative z-0">
                                <FileText className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform duration-300" />
                                <span className="font-semibold text-[13px]">Bấm hoặc kéo thả tài liệu vào đây</span>
                                <span className="text-[11px] font-medium mt-1">Đã chọn: {draftAiConfig.uploadedFilesCount || 0} tệp</span>
                             </div>
                           </div>
                         </div>

                         <div className="flex items-center gap-3 mt-5">
                            <Button 
                              onClick={saveAiConfig}
                              className="flex-1 btn-exquisite rounded-xl h-11"
                            >
                               {isAiConfigSaved ? (
                                  <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Đã Lưu Cấu Hình!</span>
                               ) : "Lưu Cấu Hình"}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={clearAiConfig}
                              className="w-14 rounded-xl h-11 btn-outline-exquisite"
                            >
                               <Trash2 className="w-5 h-5" />
                            </Button>
                         </div>
                       </div>
                     </div>
                     
                     <div className="bg-transparent dark:bg-transparent p-5 rounded-2xl border border-[#1E3A8A]/50 dark:border-[#FFFFF0]/30 shadow-sm mt-8">
                        <div className="flex items-center gap-2 font-bold mb-3 text-sm text-[#1E3A8A] dark:text-[#FFFFF0]">
                          <RotateCcw className="w-4.5 h-4.5 text-[#1E3A8A] dark:text-[#FFFFF0]"/> Khôi Phục Hệ Thống
                        </div>
                        <p className="text-xs text-[#1E3A8A] dark:text-[#FFFFF0] mb-4 font-medium">Bạn có thể quay trở về thiết lập trí tuệ nhân tạo mặc định bất kỳ lúc nào.</p>
                        <Button 
                          variant="outline" 
                          className="w-full btn-outline-exquisite rounded-xl text-xs py-5 shadow-sm"
                          onClick={() => {
                             restoreDefaultAiConfig();
                             setIsAiConfigSaved(true);
                             setTimeout(() => setIsAiConfigSaved(false), 2000);
                          }}
                        >
                          Thiết Lập Lại Mô Hình Mặc Định Của Hệ Thống
                        </Button>
                     </div>
                   </div>
                 </div>
               </TabsContent>

             </Tabs>
          </div>
        </div>
        
      </div>
    </div>
  );
}
