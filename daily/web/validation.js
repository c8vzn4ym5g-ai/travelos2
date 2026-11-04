export const normalizeHandle = value => String(value || '').normalize('NFKC').trim().toLowerCase();
export function authErrors(input, mode) {
  const errors = {};
  if (!/^[\p{L}\p{N}_-]{2,40}$/u.test(normalizeHandle(input.handle))) errors.handle = '登入名稱請用2–40個中文字、英數字、底線或連字號。';
  if (String(input.password || '').length < 8 || String(input.password).length > 128) errors.password = '密碼請用8–128個字。';
  if (mode !== 'login' && !String(input.name || '').trim()) errors.name = '請填家人怎麼稱呼你。';
  if (mode === 'register' && !String(input.child || '').trim()) errors.child = '請填孩子的小名。';
  if (mode === 'join' && !String(input.invite || '').trim()) errors.invite = '請填家人給你的邀請碼。';
  return errors;
}
