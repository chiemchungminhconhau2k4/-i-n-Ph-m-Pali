import express from "express";
import path from "path";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Define an async wrapper to catch errors in Express routes
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Fetch full TOC tree from GitHub repository
  app.get("/api/tipitaka/tree", asyncHandler(async (req, res) => {
    const { script = 'romn' } = req.query;
    try {
      const response = await fetch(`https://raw.githubusercontent.com/VipassanaTech/tipitaka-xml/main/tipitaka.org/${script}/tree.json`);
      if (!response.ok) throw new Error("Failed to fetch tree.json for script: " + script);
      
      const buffer = await response.arrayBuffer();
      let text = new TextDecoder('utf-16le').decode(buffer);
      
      // Some formatting cleanup
      text = text.replace(/^\uFEFF/, '');
      const data = JSON.parse(text);

      // Recursive function to unify chunks to main file or fix paths for frontend
      const fixTreePaths = (nodes: any[]) => {
         nodes.forEach(node => {
            if (node.type === 'leaf' && node.a_attr && node.a_attr.href) {
               // convert 'cscd/vin01m.mul0.xml' -> 'vin01m.mul.xml' (to fetch full book)
               let href = node.a_attr.href;
               href = href.replace('cscd/', '');
               href = href.replace(/([0-9]+)\.xml$/, '.xml');
               
               node.a_attr.originalHref = node.a_attr.href;
               node.a_attr.href = href;
            }
            if (node.children) {
               fixTreePaths(node.children);
            }
         });
      };
      
      fixTreePaths(data);
      res.json(data);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Failed to load Tipitaka Tree" });
    }
  }));

  // Endpoint to fetch XML from Github and parse it
  app.get("/api/tipitaka/xmlcontent", asyncHandler(async (req, res) => {
    const { filename, script = 'romn' } = req.query;
    
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: "Missing 'filename' parameter" });
    }

    // construct github path. e.g. script = 'romn', filename= 'vin01m.mul.xml'
    const githubUrl = `https://raw.githubusercontent.com/VipassanaTech/tipitaka-xml/main/${script}/${filename}`;

    const response = await fetch(githubUrl);
    if (!response.ok) {
      if (response.status === 404) {
          return res.status(404).json({ error: `Tài liệu không được tìm thấy ở văn bản: ${script}. Có thể tài liệu chưa được số hóa.` });
      }
      throw new Error(`Failed to fetch from ${githubUrl}: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    // VRI XML usually UTF-16LE, but let's be safe. If it starts with FEFF or FFFE it's standard utf16.
    let xml = new TextDecoder('utf-16le').decode(buffer);
    if (!xml.startsWith('<?xml') && !xml.includes('<?xml')) {
       // fallback, maybe utf-8?
       xml = new TextDecoder('utf-8').decode(buffer);
    }

    // VERY BASIC XML text extraction
    let textContent = xml;
    
    // Remove headers and notes
    textContent = textContent.replace(/<teiHeader>[\s\S]*?<\/teiHeader>/g, '');
    textContent = textContent.replace(/<note[^>]*>[\s\S]*?<\/note>/g, ''); 
    // Remove page boundaries
    textContent = textContent.replace(/<pb[^>]*>/g, ''); 
    
    // Replace structural tags closing with double newlines
    textContent = textContent.replace(/<\/(p|head)>/gi, '\n\n');
    // Remove the opening structural tags
    textContent = textContent.replace(/<(p|head)[^>]*>/gi, '');
    
    // Remove all remaining tags
    textContent = textContent.replace(/<[^>]+>/g, '');
    
    // Clean up multiple spaces and empty lines
    textContent = textContent.replace(/[ \t]+/g, ' '); 
    textContent = textContent.replace(/\n\s*\n/g, '\n\n');
    textContent = textContent.trim();

    res.json({ content: textContent });
  }));

  // Proxy endpoint to scrape Tipitaka.org (Keeping for fallback)
  app.get("/api/proxy/content", asyncHandler(async (req, res) => {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Missing 'url' parameter" });
    }

    if (!url.startsWith('https://tipitaka.org/')) {
       return res.status(400).json({ error: "Only tipitaka.org is allowed" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${url}: ${response.status}`);
    }

    // Attempt to decode arrays buffers if necessary, but Tipitaka is usually UTF-16 or UTF-8. 
    // fetch gives text based on headers. Let's assume text() works.
    const html = await response.text();
    const document = cheerio.load(html);
    
    // Tipitaka.org stores content mostly in paragraphs with classes.
    // Let's grab all text-containing elements within body.
    let textContent = '';
    
    // The main content is often in p elements or div.pali
    const contentNodes = document('p, .bld, .center, .gatha1, .gatha2, .gatha3, .bodytext, .subhead, .title');
    
    if (contentNodes.length > 0) {
      contentNodes.each((_, el) => {
         const text = document(el).text().replace(/\s+/g, ' ').trim();
         if (text && !textContent.includes(text)) {
            // Keep formatting somewhat clean
            textContent += text + "\n\n";
         }
      });
    } else {
      // Fallback
      textContent = document('body').text().replace(/\n\s*\n/g, '\n\n').trim();
    }

    res.json({ content: textContent });
  }));

  // Unified AI Endpoint
  app.post("/api/ai", asyncHandler(async (req, res) => {
    const { provider, model, systemMessage, prompt, apiKey, temperature = 0.2 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    let resultText = "";

    try {
      if (provider === "google") {
        const genAIKey = apiKey || process.env.GEMINI_API_KEY;
        if (!genAIKey) throw new Error("Gemini API key is required");
        
        const ai = new GoogleGenAI({ apiKey: genAIKey });
        const response = await ai.models.generateContent({
          model: model || "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            systemInstruction: systemMessage,
            temperature: temperature,
          }
        });
        resultText = response.text || "";
      } 
      else if (provider === "openai") {
        if (!apiKey) throw new Error("OpenAI API key is required");
        const openai = new OpenAI({ apiKey });
        
        const response = await openai.chat.completions.create({
          model: model || "gpt-4o",
          messages: [
            { role: "system", content: systemMessage || "" },
            { role: "user", content: prompt }
          ],
          temperature: temperature,
        });
        resultText = response.choices[0]?.message?.content || "";
      }
      else if (provider === "anthropic") {
        if (!apiKey) throw new Error("Anthropic API key is required");
        const anthropic = new Anthropic({ apiKey });
        
        const response = await anthropic.messages.create({
          model: model || "claude-3-5-sonnet-20240620",
          system: systemMessage,
          messages: [
            { role: "user", content: prompt }
          ],
          max_tokens: 4096,
          temperature: temperature,
        });
        
        resultText = response.content?.[0]?.type === 'text' ? response.content[0].text : "";
      }
      else if (provider === "deepseek") {
        if (!apiKey) throw new Error("DeepSeek API key is required");
        const openai = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" });
        
        const response = await openai.chat.completions.create({
          model: model || "deepseek-chat",
          messages: [
            { role: "system", content: systemMessage || "" },
            { role: "user", content: prompt }
          ],
          temperature: temperature,
        });
        resultText = response.choices[0]?.message?.content || "";
      }
      else {
        throw new Error("Unsupported AI provider");
      }

      res.json({ text: resultText });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      let statusCode = 500;
      let errMsg = error.message || "Failed to generate AI response";
      
      const originalErrMsg = errMsg;

      try {
        if (typeof errMsg === 'string' && errMsg.includes('"error"')) {
           const match = errMsg.match(/(\{[\s\S]*\})/);
           if (match) {
             const parsed = JSON.parse(match[1]);
             if (parsed?.error?.message) {
               errMsg = parsed.error.message;
             }
             if (parsed?.error?.code) {
               statusCode = parsed.error.code;
             }
           }
        }
      } catch (e) {}

      if (error.status === 429 || originalErrMsg.includes('429') || originalErrMsg.includes('quota') || originalErrMsg.includes('Rate exceeded') || originalErrMsg.includes('RESOURCE_EXHAUSTED')) statusCode = 429;
      if (error.status === 503 || originalErrMsg.includes('503') || originalErrMsg.includes('high demand')) statusCode = 503;
      
      res.status(statusCode).json({ error: errMsg });
    }
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
