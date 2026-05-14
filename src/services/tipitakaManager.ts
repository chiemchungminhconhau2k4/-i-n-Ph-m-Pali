import { getFromCache, saveToCache } from './db';

export async function fetchTipitakaTree(script: string) {
  const cacheKey = `tree_${script}`;
  const cachedData = await getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const response = await fetch(`/api/tipitaka/tree?script=${script}`);
  if (!response.ok) throw new Error("Failed to fetch tree.json for script: " + script);
      
  const data = await response.json();
  saveToCache(cacheKey, data).catch(console.error);
  return data;
}

export async function fetchTipitakaXml(script: string, filename: string) {
  const cacheKey = `xml_${script}_${filename}`;
  const cachedData = await getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const response = await fetch(`/api/tipitaka/xmlcontent?script=${script}&filename=${filename}`);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch from backend: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.content;

  saveToCache(cacheKey, textContent).catch(console.error);
  return textContent;
}
