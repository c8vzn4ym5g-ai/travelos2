import type { TripDetail, JournalEntry } from './types';
import { isTripPhotoVideo } from '@/lib/trip-photo';

export const JOURNAL_SHELVES = [
  {id:'cover',title:'封面',hint:'選一張最能代表旅程的照片。'},
  {id:'summary',title:'開場介紹',hint:'一句話也可以，說說這趟旅程。'},
  {id:'story',title:'沿途故事',hint:'一個地方、一頓飯、一件難忘的事；段落可增加。'},
  {id:'film',title:'旅程短片',hint:'放入影片，或用現有照片播放小影集。'},
  {id:'album',title:'素材與相簿',hint:'照片、影片可以一次放進來，不必先分類。'},
  {id:'closing',title:'旅程收尾',hint:'留下一句感想，也可以先空著。'},
] as const;

export function createJournal(title:string,id:string,now:string):TripDetail {
  return {id,userId:'user_travelos_owner',title:title.trim(),slug:id.replaceAll('_','-'),summary:'',country:'',city:'',startDate:'',endDate:'',publicDateLabel:'',showEntryDates:false,closingNote:'',coverPhotoId:null,visibility:'private',rating:null,totalCost:null,coordinates:null,createdAt:now,updatedAt:now,journalEntries:[],photos:[],places:[],travelRoute:[],costs:[],musicTracks:[]};
}

/** A source-based first arrangement: preserve authored stories and never invent events. */
export function arrangeJournal(trip:TripDetail,now:string):TripDetail {
  const used=new Set(trip.journalEntries.map(entry=>entry.storyPhotoId));
  const photos=trip.photos.filter(photo=>!isTripPhotoVideo(photo));
  const count=Math.min(6,photos.length);
  const selected=Array.from({length:count},(_,index)=>photos[count===1?0:Math.floor(index*(photos.length-1)/(count-1))]);
  const available=selected.filter(photo=>!used.has(photo.id));
  const entries:JournalEntry[]=available.map((photo,index)=>({
    id:`journal_${trip.id}_${photo.id}`,tripId:trip.id,title:`旅途片刻 ${trip.journalEntries.length+index+1}`,
    body:photo.caption?.trim()??'',storyPhotoId:photo.id,entryDate:photo.takenAt?.slice(0,10)??'',entryKind:'unreviewed',mood:null,weatherSummary:null,aiSummary:null,createdAt:now,updatedAt:now,
  }));
  return {...trip,coverPhotoId:trip.coverPhotoId??trip.photos.find(photo=>!isTripPhotoVideo(photo))?.id??null,journalEntries:[...trip.journalEntries,...entries]};
}

export function addJournalStory(trip:TripDetail,id:string,now:string):TripDetail {
  return {...trip,journalEntries:[...trip.journalEntries,{id,tripId:trip.id,title:'新的故事',body:'',entryDate:'',storyPhotoId:null,entryKind:'unreviewed',mood:null,weatherSummary:null,aiSummary:null,createdAt:now,updatedAt:now}]};
}

export function journalShelfState(trip: Pick<TripDetail, "coverPhotoId" | "summary" | "journalEntries" | "photos" | "closingNote">) {
  const photos = trip.photos ?? [];
  return [
    { title: "封面", ready: Boolean(trip.coverPhotoId) },
    { title: "開場介紹", ready: Boolean(trip.summary?.trim()) },
    { title: "沿途故事", ready: trip.journalEntries.length > 0 },
    { title: "旅程短片", ready: photos.some(photo => isTripPhotoVideo(photo)) },
    { title: "素材與相簿", ready: photos.length > 0 },
    { title: "旅程收尾", ready: Boolean(trip.closingNote?.trim()) },
  ];
}
