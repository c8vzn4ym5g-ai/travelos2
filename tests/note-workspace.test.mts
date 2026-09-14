import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript/lib/typescript.js';
import {articleToNote,noteToArticle,newNote} from '../lib/note-article.ts';

const item={...newNote('原本筆記','coffee','coffee_one','2026-09-14T12:00:00.000Z'),visibility:'public' as const,comments:'原本評論'};
async function workspace(){
  const states:unknown[]=[item,'',false,false,'',false,null,0];const effects:Array<()=>unknown>=[];let cursor=0;
  const jsx=(type:unknown,props:unknown)=>({type,props});
  const modules:Record<string,unknown>={
    react:{useState:(value:unknown)=>{const index=cursor++;return [index<states.length?states[index]:value,(next:unknown)=>{states[index]=typeof next==='function'?next(states[index]):next;}];},useEffect:(effect:()=>unknown)=>effects.push(effect),useRef:()=>({current:0})},
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/navigation':{useRouter:()=>({push:()=>{},replace:()=>{}})},'next/link':{default:'a'},
    '@/components/journal-reader':{JournalReader:'reader'},'@/components/visual-journal-editor':{VisualJournalEditor:'editor'},'@/components/reader-media':{ReaderPhoto:'photo'},
    '@/lib/note-article':{articleToNote,noteToArticle,newNote},
  };
  const source=await readFile(new URL('../components/note-workspace.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exported:any={};new Function('require','exports',compiled)((name:string)=>modules[name]??{},exported);
  return {render:(props:unknown)=>{cursor=0;return exported.NoteWorkspace(props);},states,effects};
}

test('selected coffee and food use the actual shared reader with category-local navigation',async()=>{
  for(const category of ['coffee','food']){
    const ui=await workspace();const view=ui.render({category,id:item.id});
    assert.equal(view.type,'reader');assert.equal(view.props.trip.title,'原本筆記');
    assert.equal(view.props.navigation.catalogHref,`/${category}?mode=public`);
    assert.ok(view.props.navigation.editHref.startsWith(`/${category}/`));
    assert.ok(view.props.navigation.articleHref.startsWith(`/${category}/`));
  }
});

test('direct editor title changes map to the selected original note while keeping original fields',async()=>{
  const ui=await workspace();const view=ui.render({category:'coffee',id:item.id,initialMode:'edit'});
  const editor=view.props.children[0];assert.equal(editor.type,'editor');
  editor.props.onChange({...editor.props.trip,title:'改好的標題'});
  assert.equal((ui.states[0] as typeof item).name,'改好的標題');
  assert.equal((ui.states[0] as typeof item).id,item.id);
  assert.equal((ui.states[0] as typeof item).comments,'原本評論');
  assert.equal(ui.states[5],true);
});

test('opening a selected note requests only its item endpoint and mode',async()=>{
  const originalFetch=globalThis.fetch;const requests:string[]=[];
  globalThis.fetch=async input=>{requests.push(String(input));return Response.json({item});};
  try{
    const ui=await workspace();ui.render({category:'coffee',id:item.id,initialMode:'edit'});
    const cleanup=ui.effects[0]() as ()=>void;
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests.length,1);
    const url=new URL(requests[0],'https://example.test');
    assert.equal(url.pathname,'/api/notes/item');assert.equal(url.searchParams.get('id'),item.id);assert.equal(url.searchParams.get('mode'),'edit');
    cleanup();
  }finally{globalThis.fetch=originalFetch;}
});

test('failed selected-note save preserves unsaved content and exposes the server message',async()=>{
  const originalFetch=globalThis.fetch;const requests:Array<{url:string;body:any}>=[];
  globalThis.fetch=async(input,options)=>{requests.push({url:String(input),body:JSON.parse(String(options?.body))});return Response.json({error:'有較新的版本，請先保留修改。'},{status:409});};
  try{
    const ui=await workspace();ui.states[5]=true;const view=ui.render({category:'coffee',id:item.id,initialMode:'edit'});
    view.props.children[0].props.onSave();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests[0].url,'/api/notes/item');assert.equal(requests[0].body.item.id,item.id);
    assert.equal(requests[0].body.baseUpdatedAt,item.updatedAt);assert.equal(requests[0].body.publish,false);
    assert.equal(ui.states[0],item);assert.equal(ui.states[5],true);assert.equal(ui.states[4],'有較新的版本，請先保留修改。');assert.equal(ui.states[2],false);
  }finally{globalThis.fetch=originalFetch;}
});

test('leaving and reopening restores a matching selected draft; successful save clears only that draft',async()=>{
  const originalFetch=globalThis.fetch;const originalWindow=(globalThis as any).window;
  const saved=new Map<string,string>();
  (globalThis as any).window={sessionStorage:{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value),removeItem:(key:string)=>saved.delete(key)}};
  globalThis.fetch=async(_input,options)=>Response.json({item:options?.method==='PUT'?{...JSON.parse(String(options.body)).item,updatedAt:'saved-new-version'}:item});
  try{
    const first=await workspace();const editor=first.render({category:'coffee',id:item.id,initialMode:'edit'}).props.children[0];
    editor.props.onChange({...editor.props.trip,title:'還沒儲存的文字'});
    assert.equal(JSON.parse(saved.get(`travelos-note-draft-coffee-${item.id}`)!).item.name,'還沒儲存的文字');
    const reopened=await workspace();reopened.render({category:'coffee',id:item.id,initialMode:'edit'});reopened.effects[0]();await new Promise(resolve=>setImmediate(resolve));
    assert.equal((reopened.states[0] as typeof item).name,'還沒儲存的文字');assert.equal(reopened.states[5],true);
    saved.set('travelos-note-draft-food-other','preserve-other-article');
    reopened.render({category:'coffee',id:item.id,initialMode:'edit'}).props.children[0].props.onSave();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(saved.has(`travelos-note-draft-coffee-${item.id}`),false);assert.equal(saved.get('travelos-note-draft-food-other'),'preserve-other-article');
    assert.equal(reopened.states[5],false);
  }finally{globalThis.fetch=originalFetch;(globalThis as any).window=originalWindow;}
});

test('a draft against an older base is retained without replacing the newer saved article',async()=>{
  const originalFetch=globalThis.fetch;const originalWindow=(globalThis as any).window;
  const key=`travelos-note-draft-coffee-${item.id}`;
  const draft=JSON.stringify({baseUpdatedAt:'older-version',item:{...item,name:'舊版未存文字'}});const saved=new Map([[key,draft]]);
  (globalThis as any).window={sessionStorage:{getItem:(name:string)=>saved.get(name)??null,setItem:(name:string,value:string)=>saved.set(name,value),removeItem:(name:string)=>saved.delete(name)}};
  globalThis.fetch=async()=>Response.json({item});
  try{
    const ui=await workspace();ui.render({category:'coffee',id:item.id,initialMode:'edit'});ui.effects[0]();await new Promise(resolve=>setImmediate(resolve));
    assert.equal((ui.states[0] as typeof item).name,'原本筆記');assert.equal(ui.states[5],false);
    assert.equal(saved.get(key),draft);assert.equal(saved.get(`${key}:conflict:older-version`),draft);
    assert.match(String(ui.states[4]),/先前工作稿仍保留/);
    const publicView=await workspace();publicView.render({category:'coffee',id:item.id});publicView.effects[0]();await new Promise(resolve=>setImmediate(resolve));
    assert.equal((publicView.states[0] as typeof item).name,'原本筆記');assert.equal(publicView.states[5],false);
  }finally{globalThis.fetch=originalFetch;(globalThis as any).window=originalWindow;}
});
