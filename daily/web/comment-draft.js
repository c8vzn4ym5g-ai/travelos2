// Small member-scoped text draft. Sending remains an explicit user action.
export function commentPayload(draft){return {text:String(draft.text||''),recipientId:draft.privateOpen?String(draft.recipientId||''):'',requestId:draft.requestId};}
export function sameComment(a,b){return String(a.text||'')===String(b.text||'')&&String(a.recipientId||'')===String(b.recipientId||'');}
export function readCommentDraft(storage,key,uid){let value;try{value=JSON.parse(storage.getItem(key)||'null');}catch{}return {text:'',privateOpen:false,recipientId:'',requestId:uid(),revision:0,attempt:null,...(value&&typeof value==='object'?value:{})};}
export function saveCommentDraft(storage,key,draft){storage.setItem(key,JSON.stringify(draft));return draft;}
export function reconcileCommentDraft(draft,comments,authorId,uid){
 const attempt=draft.attempt;if(!attempt)return {draft,status:''};
 const prior=comments.find(c=>c.requestId===attempt.requestId&&c.authorId===authorId);
 if(!prior)return {draft,status:'尚未確認送達，留言已保留，可重試。'};
 const same=sameComment(commentPayload(draft),prior)&&(draft.revision||0)===(attempt.revision||0);
 return {draft:same?{text:'',privateOpen:false,recipientId:'',requestId:uid(),revision:0,attempt:null}:{...draft,requestId:uid(),attempt:null},status:same?'先前留言已送達。':'先前留言已送達，後續修改仍保留，尚未送出。'};
}
