import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as catalog } from '../app/api/notes/catalog/route.ts';
import { GET as getItem, POST as createItem, PUT as saveItem } from '../app/api/notes/item/route.ts';
import { POST as uploadPhoto } from '../app/api/notes/photos/route.ts';
import { seedCoffeeShops } from '../lib/coffee.ts';
import { resetDriveWarehouseForTests, setDriveWarehouseFetchForTests } from '../lib/drive-warehouse.ts';

const privateNote = {...seedCoffeeShops[0],id:'coffee_private_fixture',slug:'private-fixture',name:'Private fixture',comments:'Private summary',lifeNote:'Unpublished private body',visibility:'private',updatedAt:'2099-01-02T00:00:00Z'};
const coffee = {shops:[...seedCoffeeShops,privateNote],updatedAt:'2099-01-02T00:00:00Z',schemaVersion:1};
const records = new Map<string,unknown>([['travelos__coffee.json',coffee]]);
let reads=0; let writes=0;
const request: typeof fetch = async (input,init) => {
  const url=new URL(String(input));
  const body=typeof init?.body==='string'?JSON.parse(init.body):null;
  const op=body?.op??url.searchParams.get('op');
  if(op==='drive-access')return Response.json({token:'fixture',folderId:'family'});
  if(url.searchParams.get('uploadType')==='resumable')return new Response(null,{headers:{location:'https://www.googleapis.com/upload/drive/fixture'}});
  if(init?.method==='PUT')return Response.json({id:'original-upload',name:'photo.jpg'});
  assert.equal(op,'item');
  const name=body?.name??url.searchParams.get('name');
  assert.ok(['travelos__coffee.json','travelos__food.json'].includes(name));
  if(body){writes++;records.set(name,JSON.parse(body.text));return Response.json({ok:true,name});}
  reads++;
  return Response.json(records.has(name)?{moment:records.get(name)}:{error:'not found'});
};
const endpoint=(path:string)=>new Request('https://travelos.test'+path);
const mutation=(method:string,body:unknown)=>new Request('https://travelos.test/api/notes/item',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});

// One mocked lifecycle avoids sharing cache state across independent artificial warehouses.
test('category metadata, private create, selected editing and explicit publication form one coherent flow',async()=>{
  setDriveWarehouseFetchForTests(request);
  const original=globalThis.fetch;globalThis.fetch=request;
  try{
    const beforeReads=reads;
    const edit=await (await catalog(endpoint('/api/notes/catalog?category=coffee&mode=edit&limit=2'))).json();
    assert.equal(edit.total,4);assert.equal(edit.items[0].id,privateNote.id);assert.equal(edit.hasMore,true);
    assert.equal(edit.items[0].lifeNote,undefined);assert.equal(edit.items[0].photos,undefined);
    await catalog(endpoint('/api/notes/catalog?category=coffee&mode=edit&offset=2&limit=2'));
    const publicCards=await (await catalog(endpoint('/api/notes/catalog?category=coffee&mode=public'))).json();
    assert.equal(publicCards.total,3);assert.equal(reads-beforeReads,1,'pagination and public projection reuse metadata cache');
    const search=await (await catalog(endpoint('/api/notes/catalog?category=coffee&mode=edit&q=Private'))).json();
    assert.equal(search.total,1);
    assert.equal((await getItem(endpoint('/api/notes/item?category=coffee&id='+privateNote.id))).status,404);
    const selected=await (await getItem(endpoint('/api/notes/item?category=coffee&id='+privateNote.id+'&mode=edit'))).json();
    assert.equal(selected.item.lifeNote,privateNote.lifeNote);assert.equal(selected.content,undefined);
    const empty=await (await catalog(endpoint('/api/notes/catalog?category=food&mode=edit'))).json();
    assert.equal(empty.total,0,'food has no invented seed articles');
    const input={...privateNote,id:'food_fixture',slug:'food-fixture',name:'My meal',visibility:'public',lifeNote:'Draft one'};
    const createdResponse=await createItem(mutation('POST',{category:'food',item:input,publish:true}));
    assert.equal(createdResponse.status,200,await createdResponse.clone().text());
    const created=(await createdResponse.json()).item;
    assert.equal(created.visibility,'private');assert.equal(created.publishedSnapshot,undefined);
    assert.equal((await (await catalog(endpoint('/api/notes/catalog?category=food&mode=edit'))).json()).total,1,'save invalidates metadata cache');
    assert.equal((await getItem(endpoint('/api/notes/item?category=food&id=food_fixture&mode=public'))).status,404);
    const publishedResponse=await saveItem(mutation('PUT',{category:'food',item:created,baseUpdatedAt:created.updatedAt,publish:true}));
    assert.equal(publishedResponse.status,200);
    const published=(await publishedResponse.json()).item;
    assert.equal(published.publishedSnapshot.lifeNote,'Draft one');
    const editedResponse=await saveItem(mutation('PUT',{category:'food',item:{...published,lifeNote:'Unpublished draft two',name:'Unpublished title'},baseUpdatedAt:published.updatedAt}));
    assert.equal(editedResponse.status,200);
    const publicRead=await (await getItem(endpoint('/api/notes/item?category=food&slug=food-fixture'))).json();
    assert.equal(publicRead.item.lifeNote,'Draft one');assert.equal(publicRead.item.name,'My meal');assert.equal(publicRead.item.publishedSnapshot,undefined);
    const writesBeforeConflict=writes;
    assert.equal((await saveItem(mutation('PUT',{category:'food',item:published,baseUpdatedAt:'stale'}))).status,409);
    assert.equal(writes,writesBeforeConflict);
    const serializedBefore=JSON.stringify(records.get('travelos__coffee.json'));
    const form=new FormData();form.set('category','coffee');form.set('itemId',privateNote.id);form.set('file',new File(['fixture'],'original.jpg',{type:'image/jpeg'}));
    const upload=await uploadPhoto(new Request('https://travelos.test/api/notes/photos',{method:'POST',body:form}));
    assert.equal(upload.status,200,await upload.clone().text());
    const photo=(await upload.json()).photo;
    assert.equal(photo.takenAt,null);assert.equal(photo.storageKey,'/api/trips/media?id=original-upload');
    assert.equal(JSON.stringify(records.get('travelos__coffee.json')),serializedBefore,'binary upload must not replace unsaved article or update its version');
    assert.equal((await catalog(endpoint('/api/notes/catalog?category=unsupported'))).status,400);
  }finally{globalThis.fetch=original;resetDriveWarehouseForTests();}
});

test('public note projection excludes plan-only paragraphs and ignores unpublished working copy',async()=>{
  const {publishedCategoryNote}=await import('../lib/category-notes.ts');
  const legacy={...seedCoffeeShops[0],journalEntries:[{id:'plan',entryKind:'plan',body:'Unconfirmed plan'},{id:'actual',entryKind:'actual',body:'Recorded visit'}]} as unknown as import('../lib/types.ts').CoffeeShop;
  const projected=publishedCategoryNote({...legacy,lifeNote:'Unsaved reader text',publishedSnapshot:legacy});
  assert.equal(projected?.lifeNote,legacy.lifeNote);
  assert.deepEqual(projected?.journalEntries?.map(entry=>entry.id),['actual']);
  assert.equal(legacy.journalEntries?.length,2,'saved source plan remains intact');
  assert.equal(publishedCategoryNote({...legacy,visibility:'private'}),null);
});
