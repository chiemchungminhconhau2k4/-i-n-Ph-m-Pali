export async function fetchTipitakaTree(script: string) {
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
  return data;
}

export async function fetchTipitakaXml(script: string, filename: string) {
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

  return textContent;
}
