import '../styles/variables.css';
import '../styles/base.css';
import '../styles/admin.css';
import '../styles/components.css';
import '../styles/poster.css';

import { renderPoster } from '../lib/poster.js';

import { auth } from '../firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getStoreByUid, saveStoreData } from '../lib/store-repo.js';
import { uid as genId } from '../lib/format.js';

const $ = (id) => document.getElementById(id);

// ═══ ESTADO (carregado do Firestore ao logar) ═══
let ownerUid = null;
let meta = {}; // slug, ownerUid, ownerEmail, createdAt — preservados a cada save
let store = {};
let categories = [];
let products = [];
let combos = [];
let reviews = [];

let editPid = null, editCoid = null;
let piData = '', coiData = '';
let accentColor = '#c0392b';
let currentCatFilter = 'Todos';
let saveTimer = null;

// ═══ AUTENTICAÇÃO ═══
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = './auth.html';
    return;
  }
  ownerUid = user.uid;
  const doc = await getStoreByUid(ownerUid);
  if (!doc) {
    // Conta existe no login, mas não tem loja associada no Firestore
    // (ex: cadastro antigo que falhou no meio do caminho). Em vez de
    // simplesmente deslogar sem explicação, avisa o motivo na tela de login.
    await signOut(auth);
    window.location.href = './auth.html?erro=sem-loja';
    return;
  }
  loadDoc(doc);
  $('authGate').style.display = 'none';
  $('vAdmin').style.display = 'flex';
  initUI();
});

$('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = './auth.html';
});

function loadDoc(doc) {
  const { categories: c, products: p, combos: co, reviews: r, slug, ownerUid: ou, ownerEmail, createdAt, ...storeFields } = doc;
  meta = { slug, ownerUid: ou, ownerEmail, createdAt };
  store = storeFields;
  categories = c || [];
  products = p || [];
  combos = co || [];
  reviews = r || [];
  accentColor = store.color || '#c0392b';
}

function buildDoc() {
  return { ...store, color: accentColor, categories, products, combos, reviews, ...meta };
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveStoreData(ownerUid, buildDoc());
    } catch (err) {
      showToast('⚠️ Erro ao salvar: ' + (err?.message || 'tente novamente'), 'red');
    }
  }, 400);
}

function initUI() {
  const liveUrl = `${location.origin}/loja.html?loja=${meta.slug}`;
  $('liveMenuLink').href = liveUrl;
  $('liveMenuUrl').textContent = liveUrl;

  fillStoreForm();
  applyColor(accentColor, { silent: true });
  document.querySelectorAll('.copt').forEach((el) => {
    el.classList.toggle('selected', el.dataset.color.toLowerCase() === accentColor.toLowerCase());
  });
  applyFeatureSwitches();

  renderAdmin(); renderCatList(); renderComboList(); renderReviewList();
  populateCatSelect(); updatePriceFields();
  initPosterTab();
}

function fillStoreForm() {
  $('sName').value = store.name || '';
  $('sTagline').value = store.tagline || '';
  $('sPhone').value = store.phone || '';
  $('sAddr').value = store.addr || '';
  $('sHours').value = store.hours || '';
  $('sClose').value = store.closeTime || '23:00';
  $('sFee').value = store.fee ?? 5;
  $('sMin').value = store.minOrder ?? 30;
  $('sTime').value = store.deliveryTime || '';
  $('sRating').value = store.rating || '';
  $('sPromoTxt').value = store.promoTxt || '';
  $('sPromoTag').value = store.promoTag || '';
  if (store.logo) { $('logoPrev').src = store.logo; $('logoPrev').style.display = 'block'; $('logoPh').style.display = 'none'; }
}

function applyFeatureSwitches() {
  const f = store.features || {};
  Object.keys(f).forEach((k) => {
    const el = $('sw-' + k);
    if (el) el.classList.toggle('on', !!f[k]);
  });
}

// ═══ TABS ═══
window.showTab = function (id, btn) {
  document.querySelectorAll('.tp').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach((b) => b.classList.remove('active'));
  $('tp-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'divulgacao') { populatePosterItems(); drawPoster(); }
};

// ═══ ADMIN RENDERS ═══
function populateCatSelect() {
  $('piCat').innerHTML = categories.map((c) => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
}

window.updatePriceFields = function () {
  const catId = $('piCat').value;
  const cat = categories.find((c) => c.id === catId);
  const isSizes = !cat || cat.type === 'sizes';
  const pf = $('priceFields');
  const ph = $('priceHint');
  if (isSizes) {
    pf.innerHTML = `<div class="pgr">
      <div class="pw"><span class="pl">Pequeno (P)</span><input class="inp" id="ppP" type="number" placeholder="R$ 0" min="0"></div>
      <div class="pw"><span class="pl">Médio (M)</span><input class="inp" id="ppM" type="number" placeholder="R$ 0" min="0"></div>
      <div class="pw"><span class="pl">Grande (G)</span><input class="inp" id="ppG" type="number" placeholder="R$ 0" min="0"></div>
    </div>`;
    ph.textContent = '💡 Preencha apenas os tamanhos que sua pizzaria oferece';
  } else {
    pf.innerHTML = `<div class="fg"><label class="lbl">Preço (R$)</label><input class="inp" id="ppP" type="number" placeholder="R$ 0" min="0"></div>`;
    ph.textContent = '💡 Para este tipo de categoria, apenas um preço é necessário';
  }
};

function renderAdmin() {
  const filtered = currentCatFilter === 'Todos' ? products : products.filter((p) => p.cat === currentCatFilter);
  const catName = (c) => categories.find((x) => x.id === c)?.name || c;
  $('prodGrid').innerHTML = filtered.map((p) => `
    <div class="pcard">
      <div class="pcard-img">
        ${p.img ? `<img src="${p.img}" alt="${p.name}">` : `<div class="pcard-noimg">🍕</div>`}
        <div class="pcard-status ${p.active ? 'son' : 'soff'}">${p.active ? 'Ativo' : 'Inativo'}</div>
      </div>
      <div class="pcard-body">
        <div class="pcard-cat">${catName(p.cat)}</div>
        <div class="pcard-name">${p.name}</div>
        <div class="pcard-desc">${p.desc}</div>
        <div class="pcard-prices">${p.prices.map((pr, i) => `<div class="ptag">${p.prices.length > 1 ? ['P', 'M', 'G'][i] + ' · ' : ''} R$${pr}</div>`).join('')}</div>
        <div class="pcard-acts">
          <button class="abt ae" onclick="openProdModal('${p.id}')">✏️ Editar</button>
          <button class="abt at2" onclick="toggleProd('${p.id}')">${p.active ? '⏸' : '▶'}</button>
          <button class="abt ad" onclick="delProd('${p.id}')">🗑</button>
        </div>
      </div>
    </div>
  `).join('') + `<button class="add-pcard" onclick="openProdModal()"><span>+</span><p>Adicionar Produto</p></button>`;
}

function renderCatList() {
  $('catList').innerHTML = categories.map((c) => `
    <div class="cat-item">
      <span class="cat-emoji">${c.emoji}</span>
      <span class="cat-name">${c.name}</span>
      <span class="cat-count">${products.filter((p) => p.cat === c.id).length} produtos · ${c.type === 'sizes' ? 'P/M/G' : 'Único'} · ${c.display}</span>
      <div class="cat-acts">
        <button class="cat-btn ae" onclick="editCat('${c.id}')">✏️</button>
        <button class="cat-btn ad" onclick="delCat('${c.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderComboList() {
  $('comboList').innerHTML = combos.length ? combos.map((c) => `
    <div class="combo-item">
      <div class="combo-header"><div class="combo-name">${c.name}</div><div class="combo-price-tag">R$ ${c.price}</div></div>
      <div class="combo-items-list">${c.items}</div>
      <div class="combo-saving">${c.saving || ''}</div>
      <div class="combo-acts" style="margin-top:.65rem">
        <button class="abt ae" onclick="openComboModal('${c.id}')">✏️ Editar</button>
        <button class="abt ad" onclick="delCombo('${c.id}')">🗑 Remover</button>
      </div>
    </div>
  `).join('') : '<p style="color:var(--muted);font-size:.82rem">Nenhum combo criado ainda.</p>';
}

function renderReviewList() {
  const stars = (n) => '⭐'.repeat(n);
  $('reviewList').innerHTML = reviews.length ? reviews.map((r) => `
    <div class="review-item">
      <div class="review-avatar">${r.avatar ? `<img src="${r.avatar}">` : '👤'}</div>
      <div class="review-body">
        <div class="review-top"><span class="review-author">${r.name}</span><span class="review-stars">${stars(r.stars)}</span></div>
        <div class="review-text">${r.text}</div>
        <div class="review-date">${r.product} · ${r.date}</div>
        <div class="review-acts">
          <button class="abt ad" style="padding:4px 10px;font-size:.68rem" onclick="delReview('${r.id}')">🗑 Remover</button>
        </div>
      </div>
    </div>
  `).join('') : '<p style="color:var(--muted);font-size:.82rem">Nenhuma avaliação ainda.</p>';
}

window.filterCat = function (cat, btn) {
  currentCatFilter = cat;
  document.querySelectorAll('.tbar .tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  $('catTabsExtra').style.display = 'none';
  renderAdmin();
};

window.renderCatTabs = function () {
  const el = $('catTabsExtra');
  el.style.display = 'flex'; el.style.gap = '.5rem'; el.style.flexWrap = 'wrap';
  el.innerHTML = categories.map((c) => `<button class="tab" style="border:1px solid var(--border);border-radius:6px;margin-bottom:.25rem" onclick="filterCat('${c.id}',this)">${c.emoji} ${c.name}</button>`).join('');
};

// ═══ PRODUCT MODAL ═══
window.openProdModal = function (id = null) {
  editPid = id; piData = '';
  populateCatSelect();
  $('pmTitle').textContent = id ? 'Editar Produto' : 'Novo Produto';
  if (id) {
    const p = products.find((x) => x.id === id);
    $('piName').value = p.name;
    $('piCat').value = p.cat;
    $('piDesc').value = p.desc;
    piData = p.img || '';
    const prev = $('piPrev'); const inner = $('piInner');
    if (p.img) { prev.src = p.img; prev.style.display = 'block'; inner.style.display = 'none'; }
    else { prev.style.display = 'none'; inner.style.display = 'flex'; }
  } else {
    ['piName', 'piDesc'].forEach((x) => $(x).value = '');
    $('piPrev').style.display = 'none';
    $('piInner').style.display = 'flex';
  }
  updatePriceFields();
  if (id) {
    const p = products.find((x) => x.id === id);
    setTimeout(() => {
      const cat = categories.find((c) => c.id === p.cat);
      if (cat?.type === 'sizes') {
        if ($('ppP')) $('ppP').value = p.prices[0] || '';
        if ($('ppM')) $('ppM').value = p.prices[1] || '';
        if ($('ppG')) $('ppG').value = p.prices[2] || '';
      } else if ($('ppP')) {
        $('ppP').value = p.prices[0] || '';
      }
    }, 50);
  }
  $('prodModal').classList.add('on');
};
window.closeProdModal = function () { $('prodModal').classList.remove('on'); };
window.uploadPI = function (input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (e) => {
    piData = e.target.result;
    $('piPrev').src = piData; $('piPrev').style.display = 'block';
    $('piInner').style.display = 'none';
  };
  r.readAsDataURL(f);
};
window.saveProd = function () {
  const name = $('piName').value.trim();
  const cat = $('piCat').value;
  const desc = $('piDesc').value.trim();
  if (!name) { showToast('⚠️ Informe o nome', 'red'); return; }
  const catObj = categories.find((c) => c.id === cat);
  let prices = [];
  const p = parseFloat($('ppP')?.value) || 0;
  if (catObj?.type === 'sizes') {
    const m = parseFloat($('ppM')?.value) || 0;
    const g = parseFloat($('ppG')?.value) || 0;
    prices = [p, m, g].filter((x) => x > 0);
  } else {
    prices = [p].filter((x) => x > 0);
  }
  if (!prices.length) { showToast('⚠️ Informe pelo menos um preço', 'red'); return; }
  if (editPid) {
    const idx = products.findIndex((x) => x.id === editPid);
    products[idx] = { ...products[idx], name, cat, desc, img: piData, prices };
  } else {
    products.push({ id: genId('p'), name, cat, desc, img: piData, prices, active: true });
  }
  window.closeProdModal(); renderAdmin(); persist();
  showToast(editPid ? '✅ Produto atualizado!' : '✅ Produto adicionado!');
};
window.toggleProd = function (id) {
  const p = products.find((x) => x.id === id); p.active = !p.active;
  renderAdmin(); persist();
  showToast(p.active ? '▶ Ativado' : '⏸ Pausado');
};
window.delProd = function (id) {
  if (!confirm('Deletar produto?')) return;
  products = products.filter((x) => x.id !== id);
  renderAdmin(); persist();
  showToast('🗑 Removido', 'red');
};

// ═══ CATEGORY ═══
window.openCatModal = function (id = null) {
  $('cmTitle').textContent = id ? 'Editar Categoria' : 'Nova Categoria';
  if (!id) ['cmName', 'cmEmoji'].forEach((x) => $(x).value = '');
  $('catModal').classList.add('on');
};
window.editCat = function (id) {
  const c = categories.find((x) => x.id === id);
  $('cmName').value = c.name;
  $('cmEmoji').value = c.emoji;
  $('cmType').value = c.type;
  $('cmDisplay').value = c.display;
  $('cmTitle').textContent = 'Editar Categoria';
  $('catModal').dataset.editing = id;
  $('catModal').classList.add('on');
};
window.saveCat = function () {
  const name = $('cmName').value.trim();
  const emoji = $('cmEmoji').value.trim() || '📦';
  const type = $('cmType').value;
  const display = $('cmDisplay').value;
  if (!name) { showToast('⚠️ Informe o nome', 'red'); return; }
  const editingId = $('catModal').dataset.editing;
  if (editingId) {
    const idx = categories.findIndex((c) => c.id === editingId);
    categories[idx] = { ...categories[idx], name, emoji, type, display };
    delete $('catModal').dataset.editing;
  } else {
    categories.push({ id: genId('c'), name, emoji, type, display });
  }
  $('catModal').classList.remove('on');
  renderCatList(); populateCatSelect(); persist();
  showToast('✅ Categoria salva!');
};
window.delCat = function (id) {
  if (products.some((p) => p.cat === id)) { showToast('⚠️ Mova os produtos antes de deletar', 'red'); return; }
  categories = categories.filter((c) => c.id !== id);
  renderCatList(); persist();
  showToast('🗑 Categoria removida', 'red');
};

// ═══ COMBOS ═══
window.openComboModal = function (id = null) {
  editCoid = id; coiData = '';
  $('coTitle').textContent = id ? 'Editar Combo' : 'Novo Combo';
  if (id) {
    const c = combos.find((x) => x.id === id);
    $('coName').value = c.name;
    $('coPrice').value = c.price;
    $('coItems').value = c.items;
    $('coOrigPrice').value = c.origPrice || '';
    $('coSaving').value = c.saving || '';
    coiData = c.img || '';
    if (c.img) { $('coiPrev').src = c.img; $('coiPrev').style.display = 'block'; $('coiInner').style.display = 'none'; }
  } else {
    ['coName', 'coPrice', 'coItems', 'coOrigPrice', 'coSaving'].forEach((x) => $(x).value = '');
    $('coiPrev').style.display = 'none'; $('coiInner').style.display = 'flex';
  }
  $('comboModal').classList.add('on');
};
window.uploadCoI = function (input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (e) => {
    coiData = e.target.result;
    $('coiPrev').src = coiData; $('coiPrev').style.display = 'block';
    $('coiInner').style.display = 'none';
  };
  r.readAsDataURL(f);
};
window.saveCombo = function () {
  const name = $('coName').value.trim();
  const price = parseFloat($('coPrice').value) || 0;
  const items = $('coItems').value.trim();
  const origPrice = parseFloat($('coOrigPrice').value) || 0;
  const saving = $('coSaving').value.trim();
  if (!name || !price) { showToast('⚠️ Informe nome e preço', 'red'); return; }
  const obj = { name, price, origPrice, items, saving, img: coiData, active: true };
  if (editCoid) {
    const idx = combos.findIndex((x) => x.id === editCoid);
    combos[idx] = { ...combos[idx], ...obj };
  } else {
    combos.push({ id: genId('co'), ...obj });
  }
  $('comboModal').classList.remove('on');
  renderComboList(); persist();
  showToast(editCoid ? '✅ Combo atualizado!' : '✅ Combo criado!');
};
window.delCombo = function (id) {
  combos = combos.filter((x) => x.id !== id);
  renderComboList(); persist();
  showToast('🗑 Combo removido', 'red');
};

// ═══ REVIEWS ═══
window.openReviewModal = function () { $('reviewModal').classList.add('on'); };
window.saveReview = function () {
  const name = $('rvName').value.trim();
  const stars = parseInt($('rvStars').value);
  const text = $('rvText').value.trim();
  const product = $('rvProduct').value.trim();
  const date = $('rvDate').value.trim() || 'recentemente';
  if (!name || !text) { showToast('⚠️ Preencha nome e depoimento', 'red'); return; }
  reviews.push({ id: genId('r'), name, stars, text, product, date, avatar: '' });
  $('reviewModal').classList.remove('on');
  renderReviewList(); persist();
  showToast('✅ Avaliação adicionada!');
};
window.delReview = function (id) {
  reviews = reviews.filter((x) => x.id !== id);
  renderReviewList(); persist();
  showToast('🗑 Avaliação removida', 'red');
};

// ═══ STORE ═══
window.uploadLogo = function (input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (e) => {
    store.logo = e.target.result;
    $('logoPrev').src = store.logo; $('logoPrev').style.display = 'block';
    $('logoPh').style.display = 'none';
    persist();
  };
  r.readAsDataURL(f);
};
window.saveStore = function () {
  store.name = $('sName').value || store.name;
  store.tagline = $('sTagline').value || store.tagline;
  store.phone = $('sPhone').value || store.phone;
  store.addr = $('sAddr').value || store.addr;
  store.hours = $('sHours').value || store.hours;
  store.closeTime = $('sClose').value || store.closeTime;
  store.fee = parseFloat($('sFee').value) || store.fee;
  store.minOrder = parseFloat($('sMin').value) || store.minOrder;
  store.deliveryTime = $('sTime').value || store.deliveryTime;
  store.rating = $('sRating').value || store.rating;
  store.promoTxt = $('sPromoTxt').value || store.promoTxt;
  store.promoTag = $('sPromoTag').value || store.promoTag;
  store.color = accentColor;
  persist();
  showToast('✅ Salvo com sucesso!');
};

// ═══ COLORS ═══
window.selColor = function (el) {
  document.querySelectorAll('.copt').forEach((e) => e.classList.remove('selected'));
  el.classList.add('selected');
  window.applyColor(el.dataset.color);
};
window.applyColor = function (color, opts = {}) {
  accentColor = color;
  $('cText').value = color;
  $('cPicker').value = color;
  $('cSwatch').style.background = color;
  $('colorPrev').style.background = `linear-gradient(135deg,${color}22,${color}11)`;
  $('colorPrev').style.border = `1px solid ${color}44`;
  $('prevBtn').style.background = color;
  if (!opts.silent) { store.color = color; persist(); }
};

// ═══ TOGGLES ═══
window.toggleSw = function (el) {
  el.classList.toggle('on');
  const k = el.id.replace('sw-', '');
  store.features = store.features || {};
  store.features[k] = el.classList.contains('on');
  persist();
};

// ═══ UTILS ═══
function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2600);
}

// ═══ GERADOR DE PÔSTER ═══
function currentPosterItem() {
  const kind = $('pgKind').value;
  const id = $('pgItem').value;
  if (kind === 'combo') {
    const c = combos.find((x) => x.id === id);
    if (!c) return null;
    return { name: c.name, desc: c.items, img: c.img, price: c.price, origPrice: c.origPrice, saving: c.saving };
  }
  const p = products.find((x) => x.id === id);
  if (!p) return null;
  return { name: p.name, desc: p.desc, img: p.img, price: p.prices[0] };
}

function populatePosterItems() {
  const kind = $('pgKind').value;
  const sel = $('pgItem');
  const prevValue = sel.value;
  if (kind === 'combo') {
    sel.innerHTML = combos.filter((c) => c.active).map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  } else {
    sel.innerHTML = products.filter((p) => p.active).map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  }
  if ([...sel.options].some((o) => o.value === prevValue)) sel.value = prevValue;
  if (!sel.options.length) sel.innerHTML = '<option value="">Nada disponível ainda — cadastre um item primeiro</option>';
}

let posterRenderToken = 0;
async function drawPoster() {
  const canvas = $('pgCanvas');
  const item = currentPosterItem();
  const hint = $('pgHint');
  if (!item) {
    const ctx = canvas.getContext('2d');
    canvas.width = 400; canvas.height = 400;
    ctx.fillStyle = '#171320'; ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = '#7a6a78'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Cadastre um produto ou combo primeiro', 200, 200);
    return;
  }
  const myToken = ++posterRenderToken;
  const template = $('pgTemplate').value;
  const format = $('pgFormat').value;
  const promoTag = $('pgPromoTag').value.trim();
  try {
    await renderPoster(canvas, {
      format, template, item,
      store: { name: store.name, color: accentColor },
      promoTag,
    });
    if (myToken !== posterRenderToken) return; // uma renderização mais nova já começou
    hint.textContent = 'Dica: fotos que você mesmo enviou (upload) ficam melhores no pôster do que imagens de exemplo vindas de links externos.';
  } catch (err) {
    if (myToken !== posterRenderToken) return;
    hint.textContent = '⚠️ Não foi possível carregar essa imagem no gerador (comum com fotos de exemplo vindas de links externos). Tente com uma foto que você mesmo enviou no cadastro do produto.';
  }
}

function initPosterTab() {
  populatePosterItems();
  $('pgKind').addEventListener('change', () => { populatePosterItems(); drawPoster(); });
  $('pgItem').addEventListener('change', drawPoster);
  $('pgFormat').addEventListener('change', drawPoster);
  $('pgPromoTag').addEventListener('input', debounce(drawPoster, 250));
  $('pgTemplate').addEventListener('change', () => {
    $('pgPromoTagWrap').style.display = $('pgTemplate').value === 'promo' ? 'block' : 'none';
    drawPoster();
  });
  $('pgDownloadBtn').addEventListener('click', downloadPoster);
  drawPoster();
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function downloadPoster() {
  const canvas = $('pgCanvas');
  try {
    canvas.toBlob((blob) => {
      if (!blob) { showToast('⚠️ Não foi possível gerar o PNG dessa imagem', 'red'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const item = currentPosterItem();
      const safeName = (item?.name || 'poster').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
      a.href = url; a.download = `poster-${safeName}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast('✅ Pôster baixado!');
    }, 'image/png');
  } catch (err) {
    showToast('⚠️ Essa imagem não permite exportação (foto de exemplo externa). Troque por uma foto enviada por upload.', 'red');
  }
}

