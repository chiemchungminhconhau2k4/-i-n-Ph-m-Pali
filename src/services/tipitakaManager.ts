import { getFromCache, saveToCache } from './db';

export async function fetchTipitakaTree(script: string) {
  const cacheKey = `tree_${script}`;
  const cachedData = await getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const response = await fetch(`https://raw.githubusercontent.com/VipassanaTech/tipitaka-xml/main/tipitaka.org/${script}/tree.json`);
  if (!response.ok) throw new Error("Failed to fetch tree.json for script: " + script);
      
  const buffer = await response.arrayBuffer();
  let text = new TextDecoder('utf-16le').decode(buffer);
  
  // Some formatting cleanup
  text = text.replace(/^\uFEFF/, '');
  let data;
  try {
      data = JSON.parse(text);
  } catch (err) {
      text = new TextDecoder('utf-8').decode(buffer);
      text = text.replace(/^\uFEFF/, '');
      data = JSON.parse(text);
  }

  // Recursive function to unify chunks to main file or fix paths for frontend
  const fixTreePaths = (nodes: any[]) => {
      nodes.forEach(node => {
        if (node.type === 'leaf' && node.a_attr && node.a_attr.href) {
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
  saveToCache(cacheKey, data).catch(console.error);
  return data;
}

export async function fetchTipitakaXml(script: string, filename: string) {
  const cacheKey = `xml_${script}_${filename}`;
  const cachedData = await getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const githubUrl = `https://raw.githubusercontent.com/VipassanaTech/tipitaka-xml/main/${script}/${filename}`;

  const response = await fetch(githubUrl);
  if (!response.ok) {
    if (response.status === 404) {
        throw new Error(`Tài liệu không được tìm thấy ở văn bản: ${script}. Có thể tài liệu chưa được số hóa.`);
    }
    throw new Error(`Failed to fetch from ${githubUrl}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  let xml = new TextDecoder('utf-16le').decode(buffer);
  if (!xml.startsWith('<?xml') && !xml.includes('<?xml')) {
      xml = new TextDecoder('utf-8').decode(buffer);
  }

  let textContent = xml;
  
  textContent = textContent.replace(/<teiHeader>[\s\S]*?<\/teiHeader>/g, '');
  textContent = textContent.replace(/<note[^>]*>[\s\S]*?<\/note>/g, ''); 
  textContent = textContent.replace(/<pb[^>]*>/g, ''); 
  textContent = textContent.replace(/<\/(p|head)>/gi, '\n\n');
  textContent = textContent.replace(/<(p|head)[^>]*>/gi, '');
  textContent = textContent.replace(/<[^>]+>/g, '');
  textContent = textContent.replace(/[ \t]+/g, ' '); 
  textContent = textContent.replace(/\n\s*\n/g, '\n\n');
  textContent = textContent.trim();

  saveToCache(cacheKey, textContent).catch(console.error);
  return textContent;
}
