// Legacy invitations belong to generation0 until the first member removal.
export function currentInvitation(invite,family,now=Date.now()){
 return !!invite&&!!family&&!invite.used&&Date.parse(invite.expiresAt)>now&&(invite.generation||0)===(family.inviteGeneration||0);
}
