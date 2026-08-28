import { initNav } from './nav.js';
import { db } from './firebase-config.js';
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await initNav('ADMIN');

const views = document.querySelectorAll('.view');
document.querySelectorAll('.navBtn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const view = btn.dataset.view;
    views.forEach(v => v.style.display = 'none');
    document.getElementById('view-' + view).style.display = 'block';
    loadView(view);
  });
});
function loadView(view) {
  if (view === 'dashboard') loadDashboard();
  if (view === 'products') loadProducts();
  if (view === 'orders') loadOrders();
  if (view === 'withdrawals') loadWithdrawals();
  if (view === 'dropshippers') loadDropshippers();
}
loadDashboard();

// ---------- Dashboard ----------
async function loadDashboard() {
  const statsGrid = document.getElementById('statsGrid');
  const [productsSnap, ordersSnap, withdrawSnap, usersSnap] = await Promise.all([
    getDocs(collection(db,'products')),
    getDocs(collection(db,'orders')),
    getDocs(collection(db,'withdrawals')),
    getDocs(collection(db,'users'))
  ]);
  let delivered = 0;
  ordersSnap.forEach(d => { if (d.data().status === 'DELIVERED') delivered++; });
  let pendingWithdraw = 0;
  withdrawSnap.forEach(d => { if (d.data().status === 'PENDING') pendingWithdraw++; });
  let dropshipperCount = 0;
  usersSnap.forEach(d => { if (d.data().role === 'DROPSHIPPER') dropshipperCount++; });
  statsGrid.innerHTML = `
    <div class="stat-card"><p>মোট প্রোডাক্ট</p><h2>${productsSnap.size}</h2></div>
    <div class="stat-card"><p>মোট অর্ডার</p><h2>${ordersSnap.size}</h2></div>
    <div class="stat-card"><p>ডেলিভারি সম্পন্ন</p><h2>${delivered}</h2></div>
    <div class="stat-card"><p>পেন্ডিং উইথড্র</p><h2>${pendingWithdraw}</h2></div>
    <div class="stat-card"><p>মোট ড্রপ শিপার</p><h2>${dropshipperCount}</h2></div>
  `;
}

// ---------- Products ----------
const productForm = document.getElementById('productForm');
document.getElementById('newProductBtn').addEventListener('click', () => {
  document.getElementById('pForm').reset();
  document.getElementById('pId').value = '';
  document.getElementById('productFormTitle').textContent = 'নতুন প্রোডাক্ট';
  productForm.style.display = 'block';
});
document.getElementById('cancelProductBtn').addEventListener('click', () => {
  productForm.style.display = 'none';
});

document.getElementById('pForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pError = document.getElementById('pError');
  pError.style.display = 'none';
  const id = document.getElementById('pId').value;
  const name = document.getElementById('pName').value.trim();
  const description = document.getElementById('pDesc').value.trim();
  const wholesalePrice = parseFloat(document.getElementById('pPrice').value);
  const images = document.getElementById('pImages').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const videos = document.getElementById('pVideos').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const variantNames = document.getElementById('pVariants').value.split('\n').map(s=>s.trim()).filter(Boolean);

  if (!name || !wholesalePrice) {
    pError.textContent = 'নাম ও পাইকারি মূল্য আবশ্যক';
    pError.style.display = 'block';
    return;
  }
  try {
    let productId = id;
    if (id) {
      await updateDoc(doc(db,'products',id), { name, description, images, videos });
      await setDoc(doc(db,'products',id,'private','pricing'), { wholesalePrice });
      const oldVariants = await getDocs(collection(db,'products',id,'variants'));
      for (const v of oldVariants.docs) await deleteDoc(v.ref);
    } else {
      const newDoc = await addDoc(collection(db,'products'), {
        name, description, images, videos, createdAt: new Date().toISOString()
      });
      productId = newDoc.id;
      await setDoc(doc(db,'products',productId,'private','pricing'), { wholesalePrice });
    }
    for (const vName of variantNames) {
      await addDoc(collection(db,'products',productId,'variants'), { name: vName });
    }
    productForm.style.display = 'none';
    loadProducts();
  } catch (err) {
    pError.textContent = 'সংরক্ষণ ব্যর্থ হয়েছে: ' + err.message;
    pError.style.display = 'block';
  }
});

async function loadProducts() {
  const tbody = document.getElementById('productTableBody');
  tbody.innerHTML = '<tr><td colspan="3">লোড হচ্ছে...</td></tr>';
  const snap = await getDocs(collection(db,'products'));
  if (snap.empty) { tbody.innerHTML = '<tr><td colspan="3">কোনো প্রোডাক্ট নেই</td></tr>'; return; }
  tbody.innerHTML = '';
  for (const d of snap.docs) {
    const p = d.data();
    let price = '-';
    try {
      const priceSnap = await getDoc(doc(db,'products',d.id,'private','pricing'));
      if (priceSnap.exists()) price = priceSnap.data().wholesalePrice;
    } catch(e) {}
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>৳ ${price}</td>
      <td>
        <button class="btn-link" data-edit="${d.id}">এডিট</button> |
        <button class="btn-link danger" data-delete="${d.id}">ডিলিট</button>
      </td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
}

async function editProduct(id) {
  const snap = await getDoc(doc(db,'products',id));
  if (!snap.exists()) return;
  const p = snap.data();
  const priceSnap = await getDoc(doc(db,'products',id,'private','pricing'));
  const price = priceSnap.exists() ? priceSnap.data().wholesalePrice : '';
  const variantsSnap = await getDocs(collection(db,'products',id,'variants'));
  const variantNames = variantsSnap.docs.map(v => v.data().name);

  document.getElementById('pId').value = id;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pDesc').value = p.description || '';
  document.getElementById('pPrice').value = price;
  document.getElementById('pImages').value = (p.images || []).join('\n');
  document.getElementById('pVideos').value = (p.videos || []).join('\n');
  document.getElementById('pVariants').value = variantNames.join('\n');
  document.getElementById('productFormTitle').textContent = 'প্রোডাক্ট এডিট করুন';
  productForm.style.display = 'block';
}

async function deleteProduct(id) {
  if (!confirm('আপনি কি নিশ্চিত এই প্রোডাক্টটি ডিলিট করতে চান?')) return;
  try { await deleteDoc(doc(db,'products',id,'private','pricing')); } catch(e) {}
  const variantsSnap = await getDocs(collection(db,'products',id,'variants'));
  for (const v of variantsSnap.docs) await deleteDoc(v.ref);
  await deleteDoc(doc(db,'products',id));
  loadProducts();
}

// ---------- Orders ----------
const STATUS_LABELS = { PENDING:'পেন্ডিং', PROCESSING:'প্রসেসিং', SHIPPED:'শিপড', DELIVERED:'ডেলিভারড', CANCELLED:'বাতিল' };

async function loadOrders() {
  const tbody = document.getElementById('orderTableBody');
  tbody.innerHTML = '<tr><td colspan="8">লোড হচ্ছে...</td></tr>';
  const snap = await getDocs(query(collection(db,'orders'), orderBy('createdAt','desc')));
  if (snap.empty) { tbody.innerHTML = '<tr><td colspan="8">কোনো অর্ডার নেই</td></tr>'; return; }
  tbody.innerHTML = '';
  snap.forEach(d => {
    const o = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.productName}${o.variantName ? ' ('+o.variantName+')' : ''}</td>
      <td>${o.dropshipperName || ''}<br><small>${o.dropshipperPhone || ''}</small></td>
      <td>${o.customerName}<br><small>${o.customerPhone}</small></td>
      <td>${o.customerAddress}</td>
      <td>৳ ${o.wholesalePrice}</td>
      <td>৳ ${o.sellPrice}</td>
      <td>৳ ${o.profit}</td>
      <td>
        <select data-id="${d.id}" data-current="${o.status}" data-dropshipper="${o.dropshipperId}" data-profit="${o.profit}">
          ${Object.entries(STATUS_LABELS).map(([val,label]) => `<option value="${val}" ${o.status===val?'selected':''}>${label}</option>`).join('')}
        </select>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const newStatus = sel.value;
      const oldStatus = sel.dataset.current;
      const dropshipperId = sel.dataset.dropshipper;
      const profit = parseFloat(sel.dataset.profit);
      await updateDoc(doc(db,'orders',id), { status: newStatus });
      if (oldStatus !== 'DELIVERED' && newStatus === 'DELIVERED') await creditBalance(dropshipperId, profit);
      if (oldStatus === 'DELIVERED' && newStatus !== 'DELIVERED') await creditBalance(dropshipperId, -profit);
      sel.dataset.current = newStatus;
    });
  });
}

async function creditBalance(userId, amount) {
  const userRef = doc(db,'users',userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const current = snap.data().balance || 0;
  await updateDoc(userRef, { balance: current + amount });
}

// ---------- Withdrawals ----------
async function loadWithdrawals() {
  const tbody = document.getElementById('withdrawTableBody');
  tbody.innerHTML = '<tr><td colspan="6">লোড হচ্ছে...</td></tr>';
  const snap = await getDocs(query(collection(db,'withdrawals'), orderBy('createdAt','desc')));
  if (snap.empty) { tbody.innerHTML = '<tr><td colspan="6">কোনো উইথড্র রিকোয়েস্ট নেই</td></tr>'; return; }
  tbody.innerHTML = '';
  snap.forEach(d => {
    const w = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${w.dropshipperName || ''}<br><small>${w.dropshipperPhone || ''}</small></td>
      <td>৳ ${w.amount}</td>
      <td>${w.method}</td>
      <td>${w.accountInfo}</td>
      <td>${w.status}</td>
      <td>${w.status === 'PENDING' ? `
        <button class="btn-link" data-approve="${d.id}" data-uid="${w.dropshipperId}" data-amount="${w.amount}">অনুমোদন</button> |
        <button class="btn-link danger" data-reject="${d.id}">বাতিল</button>
      ` : '-'}</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateDoc(doc(db,'withdrawals',btn.dataset.approve), { status: 'APPROVED' });
      await creditBalance(btn.dataset.uid, -parseFloat(btn.dataset.amount));
      loadWithdrawals();
    });
  });
  tbody.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateDoc(doc(db,'withdrawals',btn.dataset.reject), { status: 'REJECTED' });
      loadWithdrawals();
    });
  });
}

// ---------- Dropshippers ----------
async function loadDropshippers() {
  const tbody = document.getElementById('dropshipperTableBody');
  tbody.innerHTML = '<tr><td colspan="4">লোড হচ্ছে...</td></tr>';
  const snap = await getDocs(collection(db,'users'));
  const rows = [];
  snap.forEach(d => { if (d.data().role === 'DROPSHIPPER') rows.push(d.data()); });
  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="4">কোনো ড্রপ শিপার নেই</td></tr>'; return; }
  tbody.innerHTML = rows.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.phone||''}</td><td>৳ ${u.balance||0}</td></tr>`).join('');
}