import {NoteWorkspace} from '@/components/note-workspace';
export default async function NoteArticlePage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{id?:string;mode?:string}>}){
 const [{slug},query]=await Promise.all([params,searchParams]);
 return <NoteWorkspace category="food" slug={slug} id={query.id} initialMode={query.mode==='edit'?'edit':'public'} />;
}
