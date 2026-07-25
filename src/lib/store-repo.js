// ═══════════════════════════════════════════════════════════
// Camada de acesso a dados (Firestore).
// Modelo multi-tenant:
//   /stores/{uid}   -> 1 documento por pizzaria (dono = Firebase Auth uid)
//                      contém store settings + categories + products + combos + reviews
//   /slugs/{slug}   -> { uid }  (mapeia URL amigável -> dono, para o cardápio público)
//
// Guardar tudo dentro de UM documento por loja (em vez de subcoleções por
// produto) é proposital: carregar o cardápio inteiro custa 1 leitura, não
// N leituras — importante para custo em escala (ver README).
// ═══════════════════════════════════════════════════════════
import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { slugify } from './format.js';
import { seedStore } from './seed.js';

export async function slugExists(slug) {
  const snap = await getDoc(doc(db, 'slugs', slug));
  return snap.exists();
}

// Garante um slug único, tentando "nome", "nome-2", "nome-3"...
export async function reserveUniqueSlug(baseName) {
  let base = slugify(baseName) || 'pizzaria';
  let candidate = base;
  let i = 2;
  while (await slugExists(candidate)) {
    candidate = `${base}-${i}`;
    i++;
  }
  return candidate;
}

// Cria o documento inicial de uma pizzaria nova (chamado logo após o signup).
export async function provisionStore({ uid, name, phone, email }) {
  const slug = await reserveUniqueSlug(name);
  const storeData = {
    ...seedStore({ name, phone, slug }),
    ownerUid: uid,
    ownerEmail: email,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'slugs', slug), { uid });
  await setDoc(doc(db, 'stores', uid), storeData);
  return storeData;
}

export async function getStoreByUid(uid) {
  const snap = await getDoc(doc(db, 'stores', uid));
  return snap.exists() ? snap.data() : null;
}

export async function getUidBySlug(slug) {
  const snap = await getDoc(doc(db, 'slugs', slug));
  return snap.exists() ? snap.data().uid : null;
}

export async function getStoreBySlug(slug) {
  const uid = await getUidBySlug(slug);
  if (!uid) return null;
  const store = await getStoreByUid(uid);
  return store ? { uid, store } : null;
}

// Cardápio público "ao vivo": qualquer alteração salva pelo dono no painel
// aparece automaticamente pra quem já está com o cardápio aberto no celular.
export function subscribeStoreByUid(uid, callback) {
  return onSnapshot(doc(db, 'stores', uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function saveStoreData(uid, partialData) {
  await setDoc(doc(db, 'stores', uid), partialData, { merge: false });
}
