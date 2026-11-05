export const BOOK_TEMPLATES=[{id:'journal',name:'生活手帳'},{id:'album',name:'照片故事'}];
export function versionMedia(family,version){
 const selected=Array.isArray(version.selectedMedia)?new Set(version.selectedMedia):null;
 return (version.sourceIds||[]).flatMap(id=>{const moment=family.moments.find(m=>m.id===id);return (moment?.media||[]).map((media,index)=>({...media,key:`${id}:${index}`,sourceId:id,mediaIndex:index,author:moment.author}));}).filter(m=>!selected||selected.has(m.key));
}
export function bookSnapshot(family,draft){
 const ids=[...new Set(draft.diaryIds||[])];if(!ids.length)throw Error('先選一篇或幾天日記。');
 const chapters=ids.map(id=>{const diary=family.diaries.find(d=>d.id===id);if(!diary)throw Error('日記已更新，請重新選取。');return {diaryId:id,date:diary.date,...JSON.parse(JSON.stringify(diary.current))};});
 const template=BOOK_TEMPLATES.some(t=>t.id===draft.template)?draft.template:'journal';
 const book={title:String(draft.title||`${family.child}的小日子`).slice(0,100),template,cover:draft.cover||'',chapters};
 if(book.cover&&!chapters.some(ch=>versionMedia(family,ch).some(m=>m.key===book.cover&&m.kind==='image')))throw Error('請從已選日記中挑選封面照片。');
 return book;
}
