export const DEFAULT_FAMILY_ZONE='Asia/Taipei';
// Read only when creating a family. Missing device data stays missing, not a claimed phone zone.
export function deviceFamilyZone(intl=Intl){try{const value=intl.DateTimeFormat().resolvedOptions().timeZone;return typeof value==='string'&&value?value:null;}catch{return null;}}
// New families only; never use this to rewrite an existing family's stored schedule zone.
export function initialFamilyZone(value){try{if(typeof value!=='string'||!value||value.length>100||/^[+-]/.test(value))return DEFAULT_FAMILY_ZONE;const zone=new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone;return zone&&!/^[+-]/.test(zone)?zone:DEFAULT_FAMILY_ZONE;}catch{return DEFAULT_FAMILY_ZONE;}}
