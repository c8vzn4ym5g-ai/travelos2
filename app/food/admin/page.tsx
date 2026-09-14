import {NoteWorkspace} from '@/components/note-workspace';
import {CategoryCatalog} from '@/components/category-catalog';
export default async function NoteAdminPage({searchParams}:{searchParams:Promise<{id?:string;shop?:string;new?:string}>}){
 const query=await searchParams;const id=query.id??query.shop;
 return id||query.new==='1'?<NoteWorkspace category="food" id={id} initialMode="edit" create={query.new==='1'} />:<CategoryCatalog category="food" initialMode="edit" />;
}
