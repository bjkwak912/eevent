export const MAX_AMOUNT = 100_000_000_000;
export const brokers = [['mirae','미래에셋증권','미래'],['samsung','삼성증권','삼성'],['korea','한국투자증권','한투'],['nh','NH투자증권','NH'],['kb','KB증권','KB'],['shinhan','신한투자증권','신한'],['kiwoom','키움증권','키움'],['daishin','대신증권','대신'],['toss','토스증권','토스'],['kakao','카카오페이증권','카페']];
// Legacy fallback only. The current ten firms and their names are published in the DB catalog.
export function catalogBrokers(catalog) { return catalog?.brokerages?.map(b=>[b.id,b.name,b.shortName]) ?? brokers; }
export const products = { ISA: '중개형 ISA', PENSION: '연금저축', IRP: 'IRP' };
export const statuses = { ACTIVE: '조건부 예상', RESTRICTED: '참여 조건 제한', DETAILS_PENDING: '세부 조건 검증 중', UNVERIFIED: '현재 행사 확인 필요', PREPARING: '이전 기능 준비 중' };
export const won = value => Number(value).toLocaleString('ko-KR');
export const todayKorea = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
export function parseAmount(raw) { return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 && Number(raw) <= MAX_AMOUNT ? Number(raw) : null; }
export function status(event, today = todayKorea()) {
  if (event.endDate && today > event.endDate) return '종료된 행사';
  if (event.startDate && today < event.startDate) return '시작 예정';
  return statuses[event.status];
}
export function reward(event, amount, today = todayKorea()) {
  if (!Number.isSafeInteger(amount) || amount < event.minimumTransferWon || amount > MAX_AMOUNT || event.status !== 'ACTIVE' || !event.startDate || !event.endDate || today < event.startDate || today > event.endDate) return null;
  const boosted = amount >= event.multiplierMinimum;
  const numerator = boosted ? event.multiplierNumerator : 1;
  const denominator = boosted ? event.multiplierDenominator : 1;
  return event.tiers.filter(tier => amount * numerator >= tier.minimumWon * denominator).at(-1)?.rewardWon ?? null;
}
export function rewardLabel(event, amount, today = todayKorea()) {
  if (status(event,today) !== statuses.ACTIVE) return status(event,today);
  if (amount === null) return '금액 입력 필요';
  const value = reward(event,amount,today);
  return value === null ? '해당 구간 없음' : `${won(value)}${event.rewardUnit}`;
}
export function toggleSelection(selected, id) {
  if (selected.includes(id)) return selected.filter(item => item !== id);
  return selected.length < 3 ? [...selected,id] : selected;
}
