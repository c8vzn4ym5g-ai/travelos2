import type { CoffeeShop, TripDetail } from '@/lib/types';

export type NoteCategory = 'coffee' | 'food';

export function noteToArticle(note: CoffeeShop): TripDetail {
  const entries = note.journalEntries ?? (note.lifeNote ? [{id:`story_${note.id}`,tripId:note.id,title:note.name,body:note.lifeNote,entryDate:note.visitedAt,entryKind:'public' as const,mood:null,weatherSummary:null,aiSummary:null,createdAt:note.createdAt,updatedAt:note.updatedAt}] : []);
  return {
    id:note.id,userId:note.userId,title:note.name,slug:note.slug,summary:note.comments,country:note.country,city:note.city,
    startDate:note.visitedAt,endDate:note.visitedAt,publicDateLabel:note.publicDateLabel,showEntryDates:note.showEntryDates,closingNote:note.closingNote,
    visibility:note.visibility ?? 'public',coverPhotoId:note.coverPhotoId ?? note.photos[0]?.id ?? null,rating:note.rating,totalCost:null,coordinates:note.coordinates,
    createdAt:note.createdAt,updatedAt:note.updatedAt,journalEntries:entries,
    photos:note.photos.map(photo=>({...photo,tripId:note.id,coordinates:null,cameraMake:null,cameraModel:null})),
    places:[],travelRoute:[],costs:[],musicTracks:[],
    ...(note.publishedSnapshot ? {publishedSnapshot:noteToArticle({...note.publishedSnapshot,publishedSnapshot:undefined})} : {}),
  };
}

export function articleToNote(article: TripDetail, original: CoffeeShop): CoffeeShop {
  return {...original,name:article.title,comments:article.summary,country:article.country,city:article.city,coordinates:article.coordinates,
    publicDateLabel:article.publicDateLabel,showEntryDates:article.showEntryDates,closingNote:article.closingNote,coverPhotoId:article.coverPhotoId,
    journalEntries:article.journalEntries,lifeNote:article.journalEntries.map(entry=>entry.body).join('\n\n'),
    photos:article.photos.map(photo=>({...original.photos.find(item=>item.id===photo.id),id:photo.id,coffeeShopId:original.id,storageKey:photo.storageKey,originalFilename:photo.originalFilename,caption:photo.caption,takenAt:photo.takenAt,createdAt:photo.createdAt})),
  };
}

export function newNote(title: string, category: NoteCategory, id: string, now: string): CoffeeShop {
  return {id,userId:'user_travelos_owner',name:title.trim(),slug:`${category}-${id}`,country:'',city:'',address:'',mapUrl:null,websiteUrl:null,visitedAt:'',coffeeOrdered:'',rating:null,mood:'other',tags:[],comments:'',lifeNote:'',linkedTripId:null,coordinates:null,photos:[],createdAt:now,updatedAt:now,visibility:'private',publicDateLabel:'',showEntryDates:false,journalEntries:[],closingNote:'',coverPhotoId:null};
}
