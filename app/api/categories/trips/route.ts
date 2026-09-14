import {readEditorTripCatalog} from '@/lib/editor-trip-catalog';
import {readPublicHubState} from '@/lib/public-hub';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,edit=params.get('mode')==='edit',q=(params.get('q')??'').trim().toLowerCase();
  try{
    const [catalog,hub]=await Promise.all([edit?readEditorTripCatalog():Promise.resolve([]),readPublicHubState()]);
    if(!edit&&!hub.ready)return Response.json({error:'旅行目錄暫時未能讀取。'},{status:503});
    const publicById=new Map(hub.trips.map(trip=>[trip.id,trip]));
    const records=edit?catalog.map(item=>{const published=publicById.get(item.id);return {id:item.id,slug:item.slug??published?.slug,title:item.title,summary:published?.summary??'',city:published?.city??'',country:published?.country??'',coverPhoto:published?.coverPhoto??null,visibility:published?'public':'private',updatedAt:item.updatedAt||item.startDate};}):hub.trips.map(item=>({...item,updatedAt:item.startDate}));
    const filtered=records.filter(item=>[item.title,item.summary,item.city,item.country].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    const offset=Math.max(0,Number(params.get('offset'))||0),limit=Math.max(1,Math.min(500,Number(params.get('limit'))||12));
    return Response.json({items:filtered.slice(offset,offset+limit),total:filtered.length,hasMore:offset+limit<filtered.length},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'旅行目錄暫時未能讀取。'},{status:503});}
}

