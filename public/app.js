import { brokers, products, won, parseAmount, status, reward, rewardLabel, toggleSelection } from './model.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? esc(url.href) : '#'; } catch { return '#'; } };
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
let product = 'ISA', page = 'home', selected = [], catalog;
let favorites = stored('omgim-favorites',[]);
if (!Array.isArray(favorites)) favorites = [];
let raw = String(stored('omgim-amount','10000000'));
if (!/^\d{0,16}$/.test(raw)) raw = '10000000';
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
function formatInput(digits, caretDigits = digits.length) {
  raw=digits; const formatted=digits.replace(/\B(?=(\d{3})+(?!\d))/g,','); const input=$('#amount'); input.value=formatted;
  let position=0,count=0; while(position<formatted.length && count<caretDigits) { if(/\d/.test(formatted[position]))count++; position++; }
  input.setSelectionRange(position,position);
  persist('omgim-amount',raw); $('#amount-help').textContent=digits && parseAmount(digits)===null ? '1원부터 1,000억 원까지 입력해 주세요.' : '금액에 따라 달라지는 기본 혜택을 확인하세요.';
  input.setAttribute('aria-invalid',String(Boolean(digits && parseAmount(digits)===null)));
}
$('#amount').addEventListener('input',event=>{ const input=event.target; const value=input.value; const caret=(value.slice(0,input.selectionStart).match(/\d/g)||[]).length;
  if(!/^[\d,\s]*$/.test(value) || value.replace(/\D/g,'').length>16) { formatInput(raw); return; }
  formatInput(value.replace(/\D/g,''),caret); render();
});
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>{const next=(parseAmount(raw)||0)+Number(button.dataset.add); if(next>100_000_000_000)return toast('입력 가능한 최대 금액은 1,000억 원이에요.');formatInput(String(next));render();}));
$('#reset').addEventListener('click',()=>{formatInput('');render();$('#amount').focus();});
document.querySelectorAll('[data-product]').forEach(button=>button.addEventListener('click',()=>{ product=button.dataset.product;selected=[];document.querySelectorAll('[data-product]').forEach(tab=>tab.setAttribute('aria-selected',String(tab===button)));render(); }));
document.querySelectorAll('[role=tab]').forEach(button=>button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return; event.preventDefault(); const tabs=[...document.querySelectorAll('[role=tab]')];let index=tabs.indexOf(button);index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();tabs[index].focus();}));
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{page=button.dataset.page;document.querySelectorAll('[data-page]').forEach(item=>item.classList.toggle('active',item===button));render();}));
$('#sort').addEventListener('change',render);
function render() {
  if(!catalog)return;
  const amount=parseAmount(raw);
  let events=catalog.events.filter(event=>event.product===product && (page!=='favorites'||favorites.includes(event.id)));
  if($('#sort').value==='reward')events.sort((a,b)=>(b.rewardUnit==='원'?reward(b,amount)??-1:-2)-(a.rewardUnit==='원'?reward(a,amount)??-1:-2));
  $('#result-title').innerHTML=`${page==='favorites'?'관심 있는 이전 혜택':'증권사별 이전 혜택'} <span>${events.length}</span>`;
  $('#favorite-count').textContent=favorites.length;
  $('#results').innerHTML=events.length?events.map(event=>{
    const broker=brokers.find(b=>b[0]===event.brokerageId); const value=reward(event,amount);
    return `<article class="event"><div class="broker"><label><input type="checkbox" data-select="${esc(event.id)}" ${selected.includes(event.id)?'checked':''} aria-label="${broker[1]} 비교 선택"><span class="broker-logo">${broker[2]}</span><strong>${broker[1]}<small>${products[product]}</small></strong></label></div><div class="reward ${value===null?'pending':''}"><strong>${esc(rewardLabel(event,amount))}</strong><small>${value===null?esc(status(event)):esc('조건부 예상 · '+event.kind)}</small></div><div class="retention">${esc(event.retentionText)}</div><div class="actions"><button class="save ${favorites.includes(event.id)?'saved':''}" data-save="${esc(event.id)}" aria-label="${broker[1]} 관심 저장" aria-pressed="${favorites.includes(event.id)}">${favorites.includes(event.id)?'♥':'♡'}</button><button class="detail" data-detail="${esc(event.id)}">조건 보기 ›</button></div></article>`;
  }).join(''):'<p class="empty">저장한 이벤트가 없어요.<br>하트를 눌러 관심 목록에 담아 보세요.</p>';
  $('#dock').hidden=!selected.length;$('#selection-count').textContent=`${selected.length}개 선택 / 최대 3개`;
}
$('#results').addEventListener('change',event=>{const id=event.target.dataset.select;if(!id)return;const next=toggleSelection(selected,id);if(next===selected)toast('최대 3개까지 비교할 수 있어요.');selected=next;render();});
$('#results').addEventListener('click',event=>{
  const save=event.target.closest('[data-save]');if(save){const id=save.dataset.save;favorites=favorites.includes(id)?favorites.filter(item=>item!==id):[...favorites,id];persist('omgim-favorites',favorites);render();return;}
  const detail=event.target.closest('[data-detail]');if(detail)showDetail(catalog.events.find(item=>item.id===detail.dataset.detail));
});
const pair=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
function showDetail(event) {
  const broker=brokers.find(b=>b[0]===event.brokerageId);
  $('#detail-content').innerHTML=`<h2 class="detail-title">${broker[1]} · ${products[event.product]}</h2><p class="detail-subtitle">${esc(event.title)}</p><div class="detail-reward">${esc(rewardLabel(event,parseAmount(raw)))}</div><p class="detail-subtitle">${esc(event.kind)} · ${esc(status(event))}</p><dl class="details">${pair('행사 기간',`${event.startDate||'미확인'} ~ ${event.endDate||'미확인'}`)}${pair('인정 기준',event.calculationNote)}${pair('별도 신청',event.applicationText)}${pair('잔고 유지',event.retentionText)}${pair('지급 시기',event.paymentText)}</dl><h2>참여 전 확인해요</h2><ul class="conditions">${event.conditions.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>${event.tiers.length?`<h2>인정 금액별 기본 혜택</h2><p class="detail-subtitle">실제 이전 금액에 위 인정 기준을 적용한 구간입니다.</p><table class="tiers"><thead><tr><th>인정 금액 이상</th><th>기본 혜택</th></tr></thead><tbody>${event.tiers.map(tier=>`<tr><td>${won(tier.minimumWon)}원</td><td>${won(tier.rewardWon)}${esc(event.rewardUnit)}</td></tr>`).join('')}</tbody></table>`:'<p class="detail-subtitle">혜택 구간을 확인하지 못해 금액을 계산하지 않습니다.</p>'}<a class="primary detail-source" href="${safeUrl(event.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 안내에서 최종 조건 확인 ↗</a><p class="verified">확인 시각 ${esc(event.verifiedAt)}<br>조건 충족 여부에 따라 실제 지급액이 달라질 수 있습니다.</p>`;
  $('#detail').showModal();
}
$('#clear-selection').addEventListener('click',()=>{selected=[];render();});
$('#compare').addEventListener('click',()=>{
  const events=selected.map(id=>catalog.events.find(event=>event.id===id));
  const rows=[['조건부 예상 혜택',event=>`${rewardLabel(event,parseAmount(raw))} · ${event.kind}`],['행사 기간',event=>`${event.startDate||'미확인'} ~ ${event.endDate||'미확인'}`],['인정 기준',event=>event.calculationNote],['잔고 유지',event=>event.retentionText],['별도 신청',event=>event.applicationText],['지급 시기',event=>event.paymentText],['추가 조건',event=>event.conditions.join('\n')],['확인 상태',event=>status(event)]];
  $('#comparison-content').innerHTML=`<p class="detail-subtitle">${products[product]} · ${parseAmount(raw)===null?'금액 미입력':won(parseAmount(raw))+'원'} · 좌우로 밀어 비교하세요.</p><div class="compare-scroll" tabindex="0" aria-label="가로 스크롤 비교표"><table class="compare-table"><thead><tr><th scope="col">비교 항목</th>${events.map(event=>`<th scope="col">${brokers.find(b=>b[0]===event.brokerageId)[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(([title,get])=>`<tr><th scope="row">${title}</th>${events.map(event=>`<td>${esc(get(event)).replace(/\n/g,'<br>')}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">공식 출처</th>${events.map(event=>`<td><a href="${safeUrl(event.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 안내 ↗</a></td>`).join('')}</tr></tbody></table></div>`;
  $('#comparison').showModal();
});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
formatInput(raw);
try {
  const response=await fetch('/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('fetch');catalog=await response.json();
  if(catalog.schemaVersion!==1||catalog.events.length!==30||new Set(catalog.events.map(event=>event.id)).size!==30)throw Error('schema');
  $('#snapshot').textContent=`자료 반영 ${catalog.snapshotAt.slice(0,10).replaceAll('-','.')} · 현재 버전 기준`;render();
} catch {catalog=null;$('#snapshot').textContent='자료를 불러오지 못했어요';$('#results').innerHTML='<p class="empty">행사 자료를 불러오지 못했습니다.<br>잠시 후 페이지를 새로고침해 주세요.</p>';}
// Re-evaluate expiry on a long-open tab, including a tab returning from sleep.
setInterval(render,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
