import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function initNav(requiredRole) {
  return new Promise((resolve) => {
    const navLinks = document.getElementById('navLinks');
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const role = snap.exists() ? snap.data().role : 'CUSTOMER';
        const name = snap.exists() ? snap.data().name : '';
        const phone = snap.exists() ? snap.data().phone : '';
        const balance = snap.exists() ? snap.data().balance : 0;

        if (requiredRole && role !== requiredRole) {
          window.location.href = 'index.html';
          return;
        }

        let panelLink = '';
        if (role === 'ADMIN') panelLink = '<a href="admin.html">এডমিন প্যানেল</a>';
        if (role === 'DROPSHIPPER') panelLink = '<a href="dashboard.html">ড্যাশবোর্ড</a>';

        if (navLinks) {
          navLinks.innerHTML = panelLink + '<a href="#" id="logoutBtn">লগআউট</a>';
          const btn = document.getElementById('logoutBtn');
          if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => window.location.href = 'index.html');
          });
        }
        resolve({ user, role, name, phone, balance });
      } else {
        if (requiredRole) {
          window.location.href = 'login.html';
          return;
        }
        if (navLinks) {
          navLinks.innerHTML = '<a href="login.html">লগইন</a><a href="register.html">রেজিস্ট্রেশন</a>';
        }
        resolve(null);
      }
    });
  });
}