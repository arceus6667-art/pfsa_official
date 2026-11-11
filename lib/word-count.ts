export function countWords(value:string){return value.normalize('NFKC').replace(/\u200B/g,' ').trim().split(/\s+/u).filter(Boolean).length;}
