const $=id=>document.getElementById(id);
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pctFmt=(v,d=2)=>v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const num=id=>{const v=parseFloat(String($(id).value).replace(',','.'));return isFinite(v)&&v>=0?v:0};

/* CDI de reserva: série 4389 do Banco Central (CDI anualizado, base 252) */
const CDI_RESERVA={v:13.65,date:'2026-10-08'};
const CDI_API='https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json';
let cdiOficial={...CDI_RESERVA,live:false}, cdiEditado=false;

/* Motor de cálculo (validado em 13 cenários) */
const irRate=d=>d<=180?.225:d<=360?.20:d<=720?.175:.15;
const daysOf=m=>Math.round(m*30.44);
const monthlyGross=(cdi,pct)=>Math.pow(1+(Math.pow(1+cdi/100,1/252)-1)*pct/100,21)-1;
const netFactor=(g,m,ir)=>1+(Math.pow(1+g,m)-1)*(1-(ir?irRate(daysOf(m)):0));
const pmtOf=(card,k,i)=>i>0?card*i/(1-Math.pow(1+i,-k)):card/k;
function rateFromTotal(card,k,total){
  if(k<=1||card<=0||total<=card)return 0;
  let lo=0,hi=1;for(let it=0;it<80;it++){const mid=(lo+hi)/2;pmtOf(card,k,mid)*k>total?hi=mid:lo=mid}
  return (lo+hi)/2;
}
function scenario(k,o){
  const pmt=pmtOf(o.card,k,o.i),g=o.g;
  let L=o.pix,prev=o.pix,falta=0;const rows=[];
  for(let m=1;m<=k;m++){
    const N=netFactor(g,m,o.ir),avail=L>0?L*N:0,r=avail-(L>0?prev:0);let saldo;
    if(avail>=pmt){L-=pmt/N;saldo=L*N}else{falta+=pmt-avail;L=0;saldo=0}
    rows.push({m,r:Math.max(r,0),pmt,b:saldo-falta});prev=saldo;
  }
  return {k,pmt,total:pmt*k,sobra:L>0?L*netFactor(g,k,o.ir):-falta,rows,parado:o.pix*netFactor(g,k,o.ir)};
}

/* Estado */
let n=10,juros=false,modo='parc',ultimo='desc';
const chips=$('chips');
for(let i=1;i<=12;i++){const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=i+'x';b.dataset.n=i;b.setAttribute('aria-label',i+(i>1?' parcelas':' parcela'));b.onclick=()=>{n=i;calc()};chips.appendChild(b)}
$('semj').onclick=()=>{juros=false;calc()};
$('comj').onclick=()=>{juros=true;calc()};
$('mParc').onclick=()=>{modo='parc';calc()};
$('mTaxa').onclick=()=>{modo='taxa';calc()};

function syncPrices(){
  const card=num('cartao');
  if(ultimo==='desc'){$('pix').value=(card*(1-Math.min(num('desc'),100)/100)).toFixed(2)}
  else if(card>0){$('desc').value=((1-num('pix')/card)*100).toFixed(2).replace(/\.?0+$/,'')}
}
$('cartao').addEventListener('input',()=>{syncPrices();calc()});
$('desc').addEventListener('input',()=>{ultimo='desc';syncPrices();calc()});
$('pix').addEventListener('input',()=>{ultimo='pix';syncPrices();calc()});
['parc','taxa','pct','ir'].forEach(id=>$(id).addEventListener('input',calc));
const setPct=v=>{$('pct').value=v;calc()};
[...$('pctPresets').children].forEach(b=>b.onclick=()=>setPct(+b.dataset.pct));
document.querySelectorAll('[data-sim]').forEach(b=>b.onclick=()=>{setPct(+b.dataset.sim);$('verdict').scrollIntoView({behavior:'smooth',block:'center'})});
$('indMP').addEventListener('click',()=>{if(typeof gtag==='function')gtag('event','clique_indicacao',{parceiro:'mercado_pago'})});
function renderTeto(pix){
  const p=num('pct'),el=$('tetoNote');
  [...$('pctPresets').children].forEach(b=>b.setAttribute('aria-pressed',+b.dataset.pct===p));
  if(p<=100){el.hidden=true;return}
  let t=`Contas digitais costumam pagar mais de 100% do CDI só até um teto (por exemplo, R$ 5 mil a 115% ou R$ 10 mil a 120%) e com condições. Acima do teto, o valor rende 100%.`;
  const teto=p>=120?10000:5000;
  if(pix>teto)t+=` Com ${brl(pix)} guardados, parte do valor passaria do teto, e a sobra real seria menor que a mostrada.`;
  el.textContent=t;el.hidden=false;
}
$('cdi').addEventListener('input',()=>{cdiEditado=Math.abs(num('cdi')-cdiOficial.v)>0.004;renderCdi();calc()});

function dataBR(iso){const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`}
function renderCdi(){
  const el=$('cdiNote'),dias=(Date.now()-Date.parse(cdiOficial.date))/864e5;
  let h=`<span>CDI oficial: <span class="src">${pctFmt(cdiOficial.v)}% a.a.</span>, Banco Central, ${dataBR(cdiOficial.date)}${cdiOficial.live?' (atualizado agora)':''}.</span>`;
  if(!cdiOficial.live&&dias>45)h+=`<span>Esse valor pode estar desatualizado; confira a taxa atual.</span>`;
  if(cdiEditado)h+=`<button class="linkbtn" id="useOficial" type="button">Usar taxa oficial</button>`;
  el.innerHTML=h;
  const b=$('useOficial');if(b)b.onclick=()=>{$('cdi').value=cdiOficial.v.toFixed(2);cdiEditado=false;renderCdi();calc()};
}
async function buscarCdi(){
  const tentar=async(url,ler)=>{const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),5000);try{const r=await fetch(url,{signal:ctl.signal});if(!r.ok)return null;return ler(await r.json())}catch(e){return null}finally{clearTimeout(t)}};
  const res=await tentar('/api/cdi',j=>j&&j.valor>0?{v:+j.valor,date:j.data}:null)
    ||await tentar(CDI_API,j=>{const it=j.at(-1),v=parseFloat(it.valor),[d,m,y]=it.data.split('/');return v>0?{v,date:`${y}-${m}-${d}`}:null});
  if(!res)return;
  cdiOficial={...res,live:true};
  if(!cdiEditado)$('cdi').value=res.v.toFixed(2);
  renderCdi();calc();
}

/* Link com os valores (funciona quando hospedado em domínio próprio) */
const podeLink=/^https?:$/.test(location.protocol)&&!/claude/i.test(location.hostname);
function lerUrl(){
  let q;try{q=new URLSearchParams(location.search)}catch(e){return}
  const set=(k,id)=>{const v=parseFloat(q.get(k));if(isFinite(v)&&v>=0)$(id).value=v};
  if(q.has('cartao')){set('cartao','cartao');set('pix','pix');ultimo='pix';syncPrices()}
  const qn=parseInt(q.get('n'));if(qn>=1&&qn<=12)n=qn;
  if(q.get('j')==='1')juros=true;
  if(q.get('modo')==='taxa')modo='taxa';
  set('parc','parc');set('taxa','taxa');set('pct','pct');
  if(q.has('cdi')){set('cdi','cdi');cdiEditado=true}
  if(q.get('ir')==='0')$('ir').checked=false;
}
function linkAtual(){
  const p=new URLSearchParams({cartao:num('cartao'),pix:num('pix'),n,j:juros?1:0});
  if(juros){p.set('modo',modo);modo==='taxa'?p.set('taxa',num('taxa')):p.set('parc',num('parc'))}
  if(cdiEditado)p.set('cdi',num('cdi'));
  if(num('pct')!==100)p.set('pct',num('pct'));
  if(!$('ir').checked)p.set('ir',0);
  return location.origin+location.pathname+'?'+p.toString();
}

let textoAtual='';
$('copy').onclick=()=>{
  const ok=()=>{$('copyMsg').textContent='Resultado copiado.';$('shareText').hidden=true};
  const falha=()=>{const t=$('shareText');t.value=textoAtual;t.hidden=false;t.focus();t.select();$('copyMsg').textContent='Não deu para copiar automaticamente. O texto está selecionado abaixo.'};
  try{navigator.clipboard.writeText(textoAtual).then(ok,falha)}catch(e){falha()}
};

function calc(){
  const card=num('cartao'),pix=num('pix');
  let i=0,jurosTxt='';
  if(juros){
    if(modo==='taxa'){i=num('taxa')/100}
    else{const total=num('parc')*n;i=rateFromTotal(card,n,total)}
  }
  const o={pix,card,i,g:monthlyGross(num('cdi'),num('pct')),ir:$('ir').checked};
  renderTeto(pix);

  $('semj').setAttribute('aria-pressed',!juros);$('comj').setAttribute('aria-pressed',juros);
  $('modoWrap').hidden=!juros;$('jurosWrap').hidden=!juros;$('jurosInfo').hidden=!juros;
  $('mParc').setAttribute('aria-pressed',modo==='parc');$('mTaxa').setAttribute('aria-pressed',modo==='taxa');
  $('parcWrap').hidden=modo!=='parc';$('taxaWrap').hidden=modo!=='taxa';
  $('parcLbl').textContent=`Valor de cada parcela em ${n}x`;
  [...chips.children].forEach(c=>c.setAttribute('aria-pressed',+c.dataset.n===n));

  if(juros){
    const anual=(Math.pow(1+i,12)-1)*100;
    if(modo==='parc'){
      const total=num('parc')*n;
      jurosTxt=i>0?`Total a prazo: <b>${brl(total)}</b>. Isso equivale a <b>${pctFmt(i*100)}% ao mês</b>, cerca de <b>${pctFmt(anual,1)}% ao ano</b> de custo efetivo. As outras opções da tabela usam essa mesma taxa.`
        :`Com essa parcela, o total (${brl(total)}) não passa do preço no cartão, então não há juros.`;
    }else jurosTxt=`${pctFmt(i*100)}% ao mês equivalem a cerca de <b>${pctFmt(anual,1)}% ao ano</b>. Se a loja informar o CET, use o valor da parcela: ele já inclui IOF e tarifas.`;
    $('jurosInfo').innerHTML=jurosTxt;
  }

  const all=[];for(let k=1;k<=12;k++)all.push(scenario(k,o));
  const s=all[n-1],tipo=juros&&i>0?'com juros':'sem juros';

  const v=$('verdict');let frase;
  if(s.sobra>0.005){
    v.className='verdict cartao';
    $('vEyebrow').textContent=`Parcelar em ${n}x compensa`;
    $('vBig').textContent='Sobram '+brl(s.sobra);
    $('vText').textContent=`Guardando ${brl(pix)} e pagando as ${n} parcelas de ${brl(s.pmt)} com esse dinheiro, você termina com ${brl(s.sobra)} a mais do que se tivesse pago no Pix.`;
    frase=`parcelar em ${n}x ${tipo} compensa: sobram ${brl(s.sobra)} no fim`;
  }else if(s.sobra<-0.005){
    v.className='verdict pix';
    $('vEyebrow').textContent='Pagar no Pix compensa';
    $('vBig').textContent='Economia de '+brl(-s.sobra);
    $('vText').textContent=`O rendimento não cobre a diferença do cartão em ${n}x. Para pagar todas as parcelas, você precisaria completar ${brl(-s.sobra)} do próprio bolso.`;
    frase=`pagar no Pix compensa: economia de ${brl(-s.sobra)} em relação a ${n}x ${tipo}`;
  }else{
    v.className='verdict';
    $('vEyebrow').textContent='Empate';$('vBig').textContent='Dá no mesmo';
    $('vText').textContent=`Nesse cenário, Pix e cartão em ${n}x custam praticamente o mesmo.`;
    frase=`Pix e cartão em ${n}x dão praticamente no mesmo`;
  }
  textoAtual=`Pix ou cartão? Compra de ${brl(card)} no cartão ou ${brl(pix)} no Pix, com o dinheiro rendendo ${pctFmt(num('pct'),0)}% do CDI: ${frase}.`+(podeLink?` Simule: ${linkAtual()}`:'');
  $('wa').href='https://wa.me/?text='+encodeURIComponent(textoAtual);
  $('copyMsg').textContent='';

  const extra=s.total-pix;
  $('stats').innerHTML=
    `<div class="stat"><small>Parcela</small><b>${n}x ${brl(s.pmt)}</b></div>`+
    `<div class="stat"><small>Total no cartão</small><b>${brl(s.total)}</b><small>${extra>0.005?brl(extra)+' a mais que o Pix':extra<-0.005?brl(-extra)+' a menos que o Pix':'igual ao Pix'}</small></div>`+
    `<div class="stat"><small>${brl(pix)} parado ${n} ${n>1?'meses':'mês'}</small><b>${brl(s.parado)}</b><small>rende ${brl(s.parado-pix)} líquidos sem tocar no dinheiro</small></div>`;

  const max=Math.max(...all.map(a=>Math.abs(a.sobra)),0.01);
  const foco=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#tab');
  $('tab').innerHTML=all.map(a=>{
    const w=Math.abs(a.sobra)/max*50,pos=a.sobra>=0;
    const bar=`<div class="bar" aria-hidden="true"><span class="mid"></span><i style="${pos?'left:50%':'right:50%'};width:${w}%;background:var(${pos?'--card':'--pix'})"></i></div>`;
    return `<tr data-n="${a.k}" tabindex="0" class="${a.k===n?'sel':''}" aria-label="${a.k}x, sobra ${a.sobra>=0?'':'negativa de '}${brl(Math.abs(a.sobra))}${a.k===n?', selecionada':''}"><td>${a.k}x</td><td>${brl(a.pmt)}</td><td>${brl(a.total)}</td><td class="${a.sobra>0.005?'pos':a.sobra<-0.005?'neg':''}">${a.sobra>=0?'+':'−'}${brl(Math.abs(a.sobra))}</td><td class="barcell">${bar}</td></tr>`;
  }).join('');
  [...$('tab').children].forEach(tr=>{
    const pick=()=>{n=+tr.dataset.n;calc();const t=$('tab').querySelector(`tr[data-n="${n}"]`);if(t)t.focus()};
    tr.onclick=pick;
    tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}};
  });
  if(foco){const t=$('tab').querySelector(`tr[data-n="${n}"]`);if(t)t.focus()}

  $('ext').innerHTML=`<tr><td>Compra</td><td>—</td><td>—</td><td>${brl(pix)}</td></tr>`+
    s.rows.map(r=>`<tr><td>${r.m}</td><td class="pos">+${brl(r.r)}</td><td>−${brl(r.pmt)}</td><td class="${r.b<-0.005?'neg':''}">${r.b<-0.005?'−'+brl(-r.b):brl(r.b)}</td></tr>`).join('');
}

lerUrl();renderCdi();calc();buscarCdi();
