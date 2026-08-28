import { initNav } from './nav.js';
import { auth, db } from './firebase-config.js';
import {
  collection, doc, getDocs, getDoc, addDoc, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const session = await initNav('DROPSHIPPER');

document.getElementById('welcomeMsg').textContent = 'স্বাগতম, ' + (session.name || '');

const views = document.querySelectorAll('.view');
document.querySelectorAll('.navBtn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const view = btn.dataset.view;
    views.forEach(v => v.style.display = 'none');
    document.getElementById('view-' + view).style.display = 'block';
    document.getElementById('orderForm').style.display = 'none';
    loadView(view);
  });
});
function loadView(view) {
  if (view === 'dashboard') loadDashboard();
  if (view === 'products') loadProducts();
  if (view === 'orders') loadMyOrders();
  if (view === 'withdraw') loadWithdrawHistory();
}
loadDashboard();

// ---------- Dashboard ----------
async function loadDashboard() {
  const statsGrid = document.getElementById('statsGrid');
  const userSnap = await getDoc(doc(db,'users',session.user.uid));
  const balance = userSnap.exists() ? (userSnap.data().balance || 0) : 0;

  const myOrdersSnap = await getDocs(query(collection(db,'orders'), where('dropshipperId','==',session.user.uid)));
  let delivered = 0;
  myOrdersSnap.forEach(d => { if (d.data().status === 'DELIVERED') delivered++; });

  const myWithdrawSnap = await getDocs(query(collection(db,'withdrawals'), where('dropshipperId','==',session.user.uid)));
  let pendingWithdraw = 0;
  myWithdrawSnap.forEach(d => { if (d.data().status === 'PENDING') pendingWithdraw++; });

  statsGrid.innerHTML = `
    <div class="stat-card"><p>বর্তমান ব্যালেন্স</p><h2>৳ ${balance}</h2></div>
    <div class="stat-card"><p>মোট অর্ডার</p><h2>${myOrdersSnap.size}</h2></div>
    <div class="stat-card"><p>ডেলিভারি সম্পন্ন</p><h2>${delivered}</h2></div>
    <div class="stat-card"><p>পেন্ডিং উইথড্র</p><h2>${pendingWithdraw}</h2></div>
  `;
}

// ---------- Products & Ordering ----------
let currentWholesale = 0;

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '<p>লোড হচ্ছে...</p>';
  const snap = await getDocs(collection(db,'products'));
  if (snap.empty) { grid.innerHTML = '<p>কোনো প্রোডাক্ট নেই।</p>'; return; }
  grid.innerHTML = '';
  for (const d of snap.docs) {
    const p = d.data();
    let price = '-';
    try {
      const priceSnap = await getDoc(doc(db,'products',d.id,'private','pricing'));
      if (priceSnap.exists()) price = priceSnap.data().wholesalePrice;
    } catch(e) {}
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      ${(p.images && p.images[0]) ? `<img src="${p.images[0]}" alt="${p.name}">` : ''}
      <h3>${p.name}</h3>
      <p class="price">পাইকারি মূল্য: ৳ ${price}</p>
      <button class="btn" data-order="${d.id}" data-name="${p.name}" data-price="${price}">অর্ডার করুন</button>
    `;
    grid.appendChild(card);
  }
  grid.querySelectorAll('[data-order]').forEach(btn => {
    btn.addEventListener('click', () => openOrderForm(btn.dataset.order, btn.dataset.name, parseFloat(btn.dataset.price)));
  });
}

async function openOrderForm(productId, productName, wholesalePrice) {
  currentWholesale = wholesalePrice;
  document.getElementById('orderForm').style.display = 'block';
  document.getElementById('orderFormTitle').textContent = 'নতুন অর্ডার - ' + productName;
  document.getElementById('oProductId').value = productId;
  document.getElementById('oForm').reset();
  document.getElementById('oWholesale').value = '৳ ' + wholesalePrice;
  document.getElementById('profitDisplay').textContent = '';

  const variantWrap = document.getElementById('variantWrap');
  const variantSelect = document.getElementById('oVariant');
  const variantsSnap = await getDocs(collection(db,'products',productId,'variants'));
  if (variantsSnap.empty) {
    variantWrap.style.display = 'none';
    variantSelect.innerHTML = '';
  } else {
    variantWrap.style.display = 'block';
    variantSelect.innerHTML = '<option value="">-- নির্বাচন করুন --</option>' +
      variantsSnap.docs.map(v => `<option value="${v.id}" data-name="${v.data().name}">${v.data().name}</option>`).join('');
  }
  window.scrollTo({ top: document.getElementById('orderForm').offsetTop - 20, behavior: 'smooth' });
}

document.getElementById('cancelOrderBtn').addEventListener('click', () => {
  document.getElementById('orderForm').style.display = 'none';
});

document.getElementById('oSellPrice').addEventListener('input', updateProfitDisplay);
function updateProfitDisplay() {
  const sellPrice = parseFloat(document.getElementById('oSellPrice').value);
  const profitDisplay = document.getElementById('profitDisplay');
  if (isNaN(sellPrice)) { profitDisplay.textContent = ''; return; }
  const profit = sellPrice - currentWholesale;
  profitDisplay.textContent = 'আপনার প্রফিট: ৳ ' + profit;
  profitDisplay.className = profit >= 0 ? 'profit-positive' : 'profit-negative';
}

document.getElementById('oForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const oError = document.getElementById('oError');
  oError.style.display = 'none';

  const productId = document.getElementById('oProductId').value;
  const productName = document.getElementById('orderFormTitle').textContent.replace('নতুন অর্ডার - ', '');
  const variantSelect = document.getElementById('oVariant');
  const variantId = variantSelect.value || null;
  const variantName = variantId ? variantSelect.options[variantSelect.selectedIndex].dataset.name : null;
  const sellPrice = parseFloat(document.getElementById('oSellPrice').value);
  const customerName = document.getElementById('oCustomerName').value.trim();
  const customerPhone = document.getElementById('oCustomerPhone').value.trim();
  const customerAddress = document.getElementById('oCustomerAddress').value.trim();

  if (!sellPrice || !customerName || !customerPhone || !customerAddress) {
    oError.textContent = 'সব তথ্য পূরণ করুন';
    oError.style.display = 'block';
    return;
  }

  const profit = sellPrice - currentWholesale;

  try {
    await addDoc(collection(db,'orders'), {
      dropshipperId: session.user.uid,
      dropshipperName: session.name || '',
      dropshipperPhone: session.phone || '',
      productId, productName,
      variantId, variantName,
      wholesalePrice: currentWholesale,
      sellPrice, profit,
      customerName, customerPhone, customerAddress,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
    document.getElementById('orderForm').style.display = 'none';
    alert('অর্ডার সফলভাবে সাবমিট হয়েছে।');
    document.querySelector('[data-view="orders"]').click();
  } catch (err) {
    oError.textContent = 'অর্ডার ব্যর্থ হয়েছে: ' + err.message;
    oError.style.display = 'block';
  }
});

// ---------- My Orders ----------
const STATUS_LABELS = { PENDING:'পেন্ডিং', PROCESSING:'প্রসেসিং', SHIPPED:'শিপড', DELIVERED:'ডেলিভারড', CANCELLED:'বাতিল' };

async function loadMyOrders() {
  const tbody = document.getElementById('myOrderTableBody');
  tbody.innerHTML = '<tr><td colspan="5">লোড হচ্ছে...</td></tr>';
  const snap = await getDocs(query(collection(db,'orders'), where('dropshipperId','==',session.user.uid), orderBy('createdAt','desc')));
  if (snap.empty) { tbody.innerHTML = '<tr><td colspan="5">কোনো অর্ডার নেই</td></tr>'; return; }
  tbody.innerHTML = '';
  snap.forEach(d => {
    const o = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.productName}${o.variantName ? ' ('+o.variantName+')' : ''}</td>
      <td>${o.customerName}<br><small>${o.customerPhone}</small></td>
      <td>৳ ${o.sellPrice}</td>
      <td>৳ ${o.profit}</td>
      <td>${STATUS_LABELS[o.status] || o.status}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------- Withdraw ----------
document.getElementById('wForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const wError = document.getElementById('wError');
  wError.style.display = 'none';
  const amount = parseFloat(document.getElementById('wAmount').value);
  const method = document.getElementById('wMethod').value;
  const accountInfo = document.getElementById('wAccountInfo').value.trim();

  const userSnap = await getDoc(doc(db,'users',session.user.uid));
  const balance = userSnap.exists() ? (userSnap.data().balance || 0) : 0;

  if (!amount || amount <= 0 || !accountInfo) {
    wError.textContent = 'সব তথ্য সঠিকভাবে পূরণ করুন';
    wError.style.display = 'block';
    return;
  }
  if (amount > balance) {
    wError.textContent = 'পর্যাপ্ত ব্যালেন্স নেই';
    wError.style.display = 'block';
    return;
  }
  try {
    await addDoc(collection(db,'withdrawals'), {
      dropshipperId: session.user.uid,
      dropshipperName: session.name || '',
      dropshipperPhone: session.phone || '',
      amount, method, accountInfo,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
    document.getElementById('wForm').reset();
    alert('উইথড্র রিকোয়েস্ট পাঠানো হয়েছে।');
    loadWithdrawHistory();
  } catch (err) {
    wError.textContent = 'রিকোয়েস্ট ব্যর্থ হয়েছে: ' + err.message;
    wError.style.display = 'block';
  }
});

async function loadWithdrawHistory() {
  const tbody = document.getElementById('withdrawHistoryBody');
  tbody.innerHTML = '<tr><td colspan="4">লোড হচ্ছে...</td></tr>';
  const snap = await getDocs(query(collection(db,'withdrawals'), where('dropshipperId','==',session.user.uid), orderBy('createdAt','desc')));
  if (snap.empty) { tbody.innerHTML = '<tr><td colspan="4">কোনো উইথড্র রিকোয়েস্ট নেই</td></tr>'; return; }
  tbody.innerHTML = '';
  snap.forEach(d => {
    const w = d.data();
    tbody.innerHTML += `<tr><td>৳ ${w.amount}</td><td>${w.method}</td><td>${w.accountInfo}</td><td>${w.status}</td></tr>`;
  });
}