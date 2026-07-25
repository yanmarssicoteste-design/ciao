import '../styles/variables.css';
import '../styles/base.css';
import '../styles/storefront.css';
import '../styles/components.css';

import { getUidBySlug, subscribeStoreByUid } from '../lib/store-repo.js';
import { hex2rgba, lighten, brl } from '../lib/format.js';
import { buildOrderMessage, whatsappUrl } from '../lib/whatsapp.js';

const $ = (id) => document.getElementById(id);

// ═══ ESTADO ═══
let store = {}, categories = [], products = [], combos = [], reviews = [];
let cart = [];
let iModalItem = null, iModalSel = 0;
let countdownInt = null;
let currentSlug = null;

const menuObs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('vis'), i * 55); });
}, { threshold: 0.07 });

// ═══ RESOLVE SLUG DA URL ═══
// Suporta tanto /loja/nome-da-pizzaria (com rewrite configurado no hosting)
// quanto /loja.html?loja=nome-da-pizzaria (funciona em qualquer hospedagem estática).
function resolveSlug() {
  const pathMatch = location.pathname.match(/\/loja\/([^/?#]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const params = new URLSearchParams(location.search);
  return params.get('loja');
}

async function boot() {
  currentSlug = resolveSlug();
  if (!currentSlug) return showNotFound();
  const uid = await getUidBySlug(currentSlug);
  if (!uid) return showNotFound();

  subscribeStoreByUid(uid, (doc) => {
    const firstLoad = !document.getElementById('vMenu').classList.contains('ready');
    loadDoc(doc);
    $('loadingState').style.display = 'none';
    document.getElementById('vMenu').classList.add('ready');
    document.getElementById('vMenu').style.display = 'block';
    syncMenu();
    renderMenuSections();
    if (firstLoad) {
      startCountdown();
      simulateSocialProof();
      setTimeout(() => document.querySelectorAll('.fi-anim').forEach((el, i) => setTimeout(() => el.classList.add('vis'), i * 80)), 200);
    }
  });
}

function showNotFound() {
  $('loadingState').style.display = 'none';
  $('notFoundState').style.display = 'flex';
}

function loadDoc(doc) {
  const { categories: c, products: p, combos: co, reviews: r, ...storeFields } = doc;
  store = storeFields;
  categories = c || [];
  products = p || [];
  combos = co || [];
  reviews = r || [];
}

document.getElementById('vMenu').style.display = 'none';
boot();

// ═══ MENU SYNC ═══
function syncMenu() {
  const parts = store.name.split(' ');
  const first = parts.slice(0, -1).join(' ') || store.name;
  const last = parts[parts.length - 1] || '';
  $('mhN1').textContent = first;
  $('mhN2').textContent = last;
  $('mhTag').textContent = store.tagline;
  $('mNavLogo').innerHTML = first + ' <em>' + last + '</em>';
  $('mFootName').innerHTML = first + ' <em>' + last + '</em>';
  $('mFootAddr').textContent = store.addr;
  $('mFootPhone').textContent = '📞 ' + store.phone;
  $('msTime').textContent = store.deliveryTime;
  $('msFee').textContent = 'A partir R$' + store.fee;
  $('msRating').textContent = store.rating;
  $('msHours').textContent = store.hours;
  $('mPromoTxt').textContent = store.promoTxt;
  $('mPromoTag').textContent = store.promoTag;
  $('minLbl').textContent = 'Pedido mínimo: R$ ' + store.minOrder;
  $('cWarnMin').textContent = store.minOrder;
  $('cFee').textContent = brl(store.fee);
  const hl = $('mhlogo');
  if (store.logo) { hl.src = store.logo; hl.classList.add('show'); } else hl.classList.remove('show');
  const f = store.features || {};
  $('muBar').style.display = f.urgency ? 'block' : 'none';
  $('mSocial').style.display = f.social ? 'flex' : 'none';
  $('mPromo').style.display = f.promo ? 'flex' : 'none';
  $('mCombosSection').style.display = f.combos ? 'block' : 'none';
  $('mMinBar').style.display = f.minbar ? 'block' : 'none';
  $('porbit').style.display = f.orbit ? 'block' : 'none';
  $('mReviewsSec').style.display = f.reviews ? 'block' : 'none';
  document.documentElement.style.setProperty('--red', store.color);
  document.documentElement.style.setProperty('--red2', lighten(store.color, 20));
  document.documentElement.style.setProperty('--redglow', hex2rgba(store.color, 0.3));
  updateCart();
}

// ═══ MENU RENDER ═══
function renderMenuSections() {
  const activeCats = categories.filter((c) => products.some((p) => p.cat === c.id && p.active));
  $('mNavCats').innerHTML = activeCats.map((c, i) => `
    <button class="mnc ${i === 0 ? 'active' : ''}" onclick="goSec('msec-${c.id}',this)">${c.name}</button>
  `).join('');

  const activeC = combos.filter((c) => c.active);
  $('combosCount').textContent = activeC.length + ' combos';
  $('combosScroll').innerHTML = activeC.map((c) => `
    <div class="combo-card" onclick="addCombo('${c.id}')">
      <div class="combo-card-img">
        ${c.img ? `<img src="${c.img}" alt="${c.name}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:var(--card2)">🎁</div>`}
        ${c.saving ? `<div class="combo-save-badge">${c.saving}</div>` : ''}
      </div>
      <div class="combo-card-body">
        <div class="combo-card-name">${c.name}</div>
        <div class="combo-card-items">${c.items}</div>
        <div class="combo-card-foot">
          <div>${c.origPrice ? `<span class="combo-old-price">R$${c.origPrice}</span>` : ''}<span class="combo-new-price">R$${c.price}</span></div>
          <button class="combo-add-btn">+ Adicionar</button>
        </div>
      </div>
    </div>
  `).join('');

  const stars = (n) => '⭐'.repeat(n);
  $('rvGrid').innerHTML = reviews.map((r) => `
    <div class="review-card fi-anim">
      <div class="rc-top">
        <div class="rc-av">${r.avatar ? `<img src="${r.avatar}">` : '👤'}</div>
        <div class="rc-info"><div class="rc-name">${r.name}</div><div class="rc-stars">${stars(r.stars)}</div><div class="rc-date">${r.date}</div></div>
      </div>
      <div class="rc-text">${r.text}</div>
      ${r.product ? `<div class="rc-product">📦 ${r.product}</div>` : ''}
    </div>
  `).join('');

  $('mSections').innerHTML = activeCats.map((cat) => {
    const items = products.filter((p) => p.cat === cat.id && p.active);
    if (!items.length) return '';
    const first = items[0]; const rest = items.slice(1);
    const isSizes = cat.type === 'sizes';
    return `<section class="msec fi-anim" id="msec-${cat.id}">
      <div class="msec-head fi-anim"><h2 class="msec-title">${cat.emoji} <em>${cat.name}</em></h2><span class="msec-count">${items.length} opções</span></div>
      ${cat.display === 'featured' && first ? renderFeatured(first, cat) : ''}
      ${cat.display === 'list' ? renderList(items) : ''}
      ${cat.display === 'grid' ? renderGrid(items, isSizes) : ''}
      ${cat.display === 'featured' && rest.length ? renderGrid(rest, isSizes) : ''}
    </section>`;
  }).join('');

  setTimeout(() => document.querySelectorAll('.fi-anim').forEach((el, i) => setTimeout(() => el.classList.add('vis'), i * 60)), 100);
  document.querySelectorAll('.fi-anim').forEach((el) => menuObs.observe(el));
}

function renderFeatured(p, cat) {
  const socialTxt = socialProofText(p.id);
  return `<div class="mfeat fi-anim" onclick="openIM('${p.id}')">
    <div class="mfi">
      ${p.img ? `<img src="${p.img}" alt="${p.name}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;background:var(--card2)">🍕</div>`}
      <div class="mfi-tag">⭐ Destaque</div>
    </div>
    <div class="mfb">
      <div class="mfcat">${cat.name}</div>
      <div class="mfname">${p.name}</div>
      ${socialTxt ? `<div class="item-social"><div class="dot"></div>${socialTxt}</div>` : ''}
      <div class="mfdesc">${p.desc}</div>
      <div class="mff">
        <div class="mpr"><sup>R$</sup>${p.prices[0]}</div>
        <button class="madd-btn" onclick="event.stopPropagation();quickAdd('${p.id}')">+ Adicionar</button>
      </div>
    </div>
  </div>`;
}

function renderGrid(items, isSizes) {
  if (!items.length) return '';
  return `<div class="mgrid">${items.map((p) => `
    <div class="mcard fi-anim" onclick="openIM('${p.id}')">
      <div class="mcard-img">
        ${p.img ? `<img src="${p.img}" alt="${p.name}"><div class="mcard-ov"></div>` : `<div class="mcard-noimg">🍕</div>`}
      </div>
      <div class="mcard-body">
        <div class="mcard-cat">${categories.find((c) => c.id === p.cat)?.name || p.cat}</div>
        <div class="mcard-name">${p.name}</div>
        <div class="mcard-desc">${p.desc}</div>
        ${isSizes ? `<div class="mcard-sizes">${p.prices.map((pr, i) => `<div class="msz ${i === 0 ? 'sel' : ''}" data-price="${pr}">${['P', 'M', 'G'][i]} · R$${pr}</div>`).join('')}</div>` : ''}
        <div class="mcard-foot">
          <div class="mcard-pr" id="mcpr-${p.id}">R$ ${p.prices[0]}</div>
          <button class="miadd" onclick="event.stopPropagation();addFromGrid('${p.id}',this)">+</button>
        </div>
      </div>
    </div>
  `).join('')}</div>`;
}

function renderList(items) {
  return `<div class="mlist">${items.map((p) => `
    <div class="mlist-item fi-anim" onclick="openIM('${p.id}')">
      <div class="mlist-img">${p.img ? `<img src="${p.img}" alt="${p.name}">` : '🍕'}</div>
      <div class="mlist-info"><div class="mlist-name">${p.name}</div><div class="mlist-desc">${p.desc}</div></div>
      <div class="mlist-right">
        <div class="mlist-pr">R$ ${p.prices[0]}</div>
        <button class="mlist-add" onclick="event.stopPropagation();quickAdd('${p.id}')">+</button>
      </div>
    </div>
  `).join('')}</div>`;
}

// ═══ SOCIAL PROOF (decorativo, sem tracking real) ═══
const socialMsgs = ['3 pessoas vendo agora', 'Última venda há 5 min', '🔥 7 pedidos hoje', 'Quase esgotando!', '2 pessoas adicionaram ao carrinho'];
function socialProofText(id) {
  const n = typeof id === 'string' ? [...id].reduce((s, c) => s + c.charCodeAt(0), 0) : id;
  return socialMsgs[n % socialMsgs.length];
}
function simulateSocialProof() {
  const counts = [8, 12, 15, 20, 24];
  const lastOrder = ['3 min', '8 min', '12 min', '2 min', '15 min'];
  const r = Math.floor(Math.random() * counts.length);
  $('spTxt').textContent = counts[r] + ' pessoas viram esse cardápio hoje';
  $('spSub').textContent = 'Última venda há ' + lastOrder[r];
  const emojis = ['👨', '👩', '🧑', '👦', '👧', '🧔', '👱'];
  $('spAvatars').innerHTML = emojis.slice(0, 4).map((e) => `<div class="sp-av">${e}</div>`).join('');
  setInterval(() => {
    const r2 = Math.floor(Math.random() * socialMsgs.length);
    const el = $('imSocialTxt');
    if (el) el.textContent = socialMsgs[r2];
  }, 8000);
}

// ═══ ITEM MODAL ═══
window.openIM = function (id) {
  const p = products.find((x) => x.id === id); if (!p) return;
  iModalItem = p; iModalSel = p.prices[0];
  const img = $('imImg'); const noImg = $('imNoImg');
  if (p.img) { img.src = p.img; img.style.display = 'block'; noImg.style.display = 'none'; }
  else { img.style.display = 'none'; noImg.style.display = 'flex'; }
  $('imCat').textContent = categories.find((c) => c.id === p.cat)?.name || p.cat;
  $('imName').textContent = p.name;
  $('imDesc').textContent = p.desc;
  $('imSocialTxt').textContent = socialProofText(id);
  const cat = categories.find((c) => c.id === p.cat);
  const isSizes = cat?.type === 'sizes';
  const lbl = ['Pequena', 'Média', 'Grande'];
  const diam = ['25cm', '30cm', '35cm'];
  $('imSizes').innerHTML = p.prices.map((pr, i) => `
    <div class="imsz ${i === 0 ? 'sel' : ''}" onclick="selIMSz(this,${pr})">
      <span class="imsz-l">${isSizes ? (lbl[i] || 'Único') : 'Único'}</span>
      ${isSizes && p.prices.length > 1 ? `<span class="imsz-d">${diam[i] || ''}</span>` : ''}
      <span class="imsz-p">R$ ${pr}</span>
    </div>
  `).join('');
  $('imTotal').textContent = 'R$ ' + p.prices[0];
  $('imbg').classList.add('on');
  document.body.style.overflow = 'hidden';
};
window.selIMSz = function (el, price) {
  document.querySelectorAll('.imsz').forEach((e) => e.classList.remove('sel'));
  el.classList.add('sel'); iModalSel = price;
  $('imTotal').textContent = 'R$ ' + price;
};
window.closeIM = function (e) { if (e.target === $('imbg')) window.closeIMDirect(); };
window.closeIMDirect = function () { $('imbg').classList.remove('on'); document.body.style.overflow = ''; };
window.addFromIM = function () {
  if (!iModalItem) return;
  const cat = categories.find((c) => c.id === iModalItem.cat);
  const isSizes = cat?.type === 'sizes';
  const idx = iModalItem.prices.indexOf(iModalSel);
  const sz = isSizes && iModalItem.prices.length > 1 ? (['P', 'M', 'G'][idx] || 'P') : '';
  addItem(iModalItem.name, iModalSel, iModalItem.img, sz);
  window.closeIMDirect();
};

// ═══ CART ═══
function addItem(name, price, img, size = '') {
  const key = name + '|' + size;
  const ex = cart.find((i) => i.key === key);
  if (ex) ex.qty++; else cart.push({ key, name, price, img, size, qty: 1 });
  updateCart();
  const sizeLbl = { P: 'Pequena', M: 'Média', G: 'Grande' }[size] || size;
  showToast('🍕 ' + name + (size ? ' (' + sizeLbl + ')' : '') + ' adicionado!');
}
window.quickAdd = function (id) {
  const p = products.find((x) => x.id === id); if (!p) return;
  const cat = categories.find((c) => c.id === p.cat);
  const sz = cat?.type === 'sizes' && p.prices.length > 1 ? 'P' : '';
  addItem(p.name, p.prices[0], p.img, sz);
};
window.addFromGrid = function (id, btn) {
  const p = products.find((x) => x.id === id); if (!p) return;
  const card = btn.closest('.mcard-body');
  const sel = card?.querySelector('.msz.sel');
  const price = sel ? parseInt(sel.dataset.price) : p.prices[0];
  const sizeText = sel ? sel.textContent.split('·')[0].trim() : '';
  const orig = btn.innerHTML; btn.style.background = 'var(--green)'; btn.innerHTML = '✓';
  setTimeout(() => { btn.style.background = 'var(--red)'; btn.innerHTML = orig; }, 1400);
  addItem(p.name, price, p.img, sizeText);
};
window.addCombo = function (id) {
  const c = combos.find((x) => x.id === id); if (!c) return;
  addItem('🎁 ' + c.name, c.price, c.img, 'Combo');
};

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('msz')) {
    e.stopPropagation();
    e.target.closest('.mcard-sizes')?.querySelectorAll('.msz').forEach((el) => el.classList.remove('sel'));
    e.target.classList.add('sel');
    const price = parseInt(e.target.dataset.price);
    const pr = e.target.closest('.mcard-body')?.querySelector('.mcard-pr');
    if (pr) pr.textContent = 'R$ ' + price;
  }
});

function renderUpsell() {
  const cartNames = cart.map((i) => i.name);
  const suggestions = products.filter((p) => p.active && !cartNames.includes(p.name)).slice(0, 2);
  const wrap = $('upsellWrap');
  if (!suggestions.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="upsell">
    <div class="upsell-title">🔥 Adicione ao seu pedido</div>
    <div class="upsell-items">${suggestions.map((p) => `
      <div class="upsell-item" onclick="quickAdd('${p.id}')">
        <div class="upsell-item-img">${p.img ? `<img src="${p.img}" alt="">` : '🍕'}</div>
        <div class="upsell-item-info"><div class="upsell-item-name">${p.name}</div><div class="upsell-item-price">R$ ${p.prices[0]}</div></div>
        <button class="upsell-add" onclick="event.stopPropagation();quickAdd('${p.id}')">+ R$${p.prices[0]}</button>
      </div>
    `).join('')}</div>
  </div>`;
}

window.chQty = function (i, d) {
  cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1);
  updateCart();
};

window.toggleCart = function () {
  $('cdr').classList.toggle('on');
  $('cov').classList.toggle('on');
  document.body.style.overflow = $('cdr').classList.contains('on') ? 'hidden' : '';
};

function updateCart() {
  if (!store.minOrder && store.minOrder !== 0) return; // ainda não carregou
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = sub + (store.fee || 0);
  const badge = $('cbadge');
  badge.textContent = count; badge.classList.toggle('on', count > 0);
  const pct = Math.min(100, (sub / store.minOrder) * 100);
  $('pFill').style.width = pct + '%';
  $('minVal').textContent = 'R$ ' + sub + ' / R$ ' + store.minOrder;
  const body = $('cbody'); const ft = $('cft'); const warn = $('cWarn');
  if (!cart.length) {
    body.innerHTML = '<div class="cempty"><span>🍕</span><p>Carrinho vazio.<br>Escolha uma pizza!</p></div>';
    ft.style.display = 'none'; return;
  }
  ft.style.display = 'block';
  warn.style.display = sub < store.minOrder ? 'block' : 'none';
  if (sub < store.minOrder) $('cWarnDiff').textContent = (store.minOrder - sub);
  body.innerHTML = cart.map((item, i) => `
    <div class="ci">
      <div class="ci-img">${item.img ? `<img src="${item.img}" alt="">` : '🍕'}</div>
      <div class="ci-info">
        <div class="ci-nm">${item.name}</div>
        ${item.size ? `<div class="ci-sz">${{ P: 'Pequena', M: 'Média', G: 'Grande', Combo: 'Combo' }[item.size] || item.size}</div>` : ''}
        <div class="ci-pr">${brl(item.price * item.qty)}</div>
        <div class="ci-ctrl">
          <button class="qb" onclick="chQty(${i},-1)">−</button>
          <span class="qn">${item.qty}</span>
          <button class="qb" onclick="chQty(${i},1)">+</button>
        </div>
      </div>
    </div>
  `).join('');
  $('cSub').textContent = brl(sub);
  $('cTtl').textContent = brl(total);
  if (store.features?.upsell) renderUpsell();
}

// ═══ CHECKOUT ═══
window.checkout = function () {
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (sub < store.minOrder) { showToast('⚠️ Pedido mínimo é R$' + store.minOrder, 'red'); return; }
  const name = $('cName').value.trim();
  const addr = $('cAddr').value.trim();
  if (!name || !addr) { showToast('⚠️ Preencha nome e endereço', 'red'); return; }

  const fee = store.fee || 0;
  const total = sub + fee;
  const msg = buildOrderMessage({ storeName: store.name, cart, name, addr, sub, fee, total });
  const url = whatsappUrl(store.phone, msg);
  if (!url) { showToast('⚠️ Telefone da loja não configurado', 'red'); return; }

  showToast('✅ Abrindo WhatsApp, ' + name + '! 🍕');
  window.open(url, '_blank');

  cart = []; updateCart();
  $('cName').value = ''; $('cAddr').value = '';
  window.toggleCart();
};

// ═══ NAV SCROLL ═══
window.goSec = function (id, btn) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  document.querySelectorAll('.mnc').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
};
window.addEventListener('scroll', () => {
  categories.forEach((c) => {
    const el = document.getElementById('msec-' + c.id); if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top <= 90 && r.bottom > 90) {
      const cats = document.querySelectorAll('.mnc');
      const idx = categories.indexOf(c);
      cats.forEach((b) => b.classList.remove('active'));
      cats[idx]?.classList.add('active');
    }
  });
});

// ═══ COUNTDOWN ═══
function startCountdown() {
  if (countdownInt) clearInterval(countdownInt);
  countdownInt = setInterval(tick, 1000); tick();
}
function tick() {
  if (!store.closeTime) return;
  const now = new Date();
  const [h, m] = store.closeTime.split(':').map(Number);
  const close = new Date(); close.setHours(h, m, 0, 0);
  if (now > close) close.setDate(close.getDate() + 1);
  const diff = close - now;
  const hh = Math.floor(diff / 3600000).toString().padStart(2, '0');
  const mm = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
  const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
  const el = $('mcd'); if (el) el.textContent = hh + ':' + mm + ':' + ss;
}

// ═══ UTILS ═══
function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2600);
}
