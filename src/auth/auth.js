import '../styles/variables.css';
import '../styles/base.css';
import '../styles/admin.css';
import '../styles/auth.css';
import { auth } from '../firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from 'firebase/auth';
import { provisionStore, getStoreByUid } from '../lib/store-repo.js';

const $ = (id) => document.getElementById(id);

// Se a pessoa já chega na página logada (sessão anterior), pula pro painel.
// Importante: só reage ao estado INICIAL — se ficar ouvindo pra sempre, ele
// dispara de novo no meio do próprio fluxo de cadastro (assim que o login é
// criado, mas antes da loja terminar de ser criada no Firestore), e manda
// pro painel cedo demais, o que fazia o painel "não achar nada" e devolver
// pro login. Os próprios handlers de login/cadastro cuidam do redirecionamento
// quando terminam com sucesso.
let initialAuthChecked = false;
let unsubInitialCheck;
unsubInitialCheck = onAuthStateChanged(auth, (user) => {
  if (initialAuthChecked) return;
  initialAuthChecked = true;
  if (unsubInitialCheck) unsubInitialCheck();
  if (user) window.location.href = './admin.html';
});

// Mensagem quando a conta existe mas não tem loja associada (ex: cadastro
// antigo que falhou no meio do caminho, antes das regras estarem corretas).
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('erro') === 'sem-loja') {
  showError('Essa conta não tem nenhuma pizzaria associada (provavelmente um cadastro antigo que não completou). Exclua esse usuário em Authentication no Console do Firebase e crie a conta de novo pela aba "Criar conta grátis".');
}

function showError(msg) {
  const el = $('authError');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function setLoading(isLoading) {
  document.querySelectorAll('.bp').forEach((b) => (b.disabled = isLoading));
}

$('tabLogin').addEventListener('click', () => switchTab('login'));
$('tabSignup').addEventListener('click', () => switchTab('signup'));

function switchTab(tab) {
  $('tabLogin').classList.toggle('active', tab === 'login');
  $('tabSignup').classList.toggle('active', tab === 'signup');
  $('formLogin').style.display = tab === 'login' ? 'flex' : 'none';
  $('formSignup').style.display = tab === 'signup' ? 'flex' : 'none';
  showError('');
}

$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  setLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = './admin.html';
  } catch (err) {
    showError(friendlyAuthError(err));
  } finally {
    setLoading(false);
  }
});

$('formSignup').addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const storeName = $('signupStoreName').value.trim();
  const phone = $('signupPhone').value.trim();
  const email = $('signupEmail').value.trim();
  const password = $('signupPassword').value;

  if (!storeName || !email || password.length < 6) {
    showError('Preencha o nome da pizzaria, e-mail e uma senha com pelo menos 6 caracteres.');
    return;
  }

  setLoading(true);
  let cred = null;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
    // Garante que o token de autenticação já está pronto antes de escrever
    // no Firestore — sem isso, a primeira escrita logo após o cadastro pode
    // falhar por "permissão insuficiente" mesmo com as regras corretas.
    await cred.user.getIdToken(true);
    await provisionStore({ uid: cred.user.uid, name: storeName, phone, email });
    window.location.href = './admin.html';
  } catch (err) {
    // Se o login chegou a ser criado mas a loja falhou (ex: regra do
    // Firestore ainda não publicada), desloga — senão a pessoa fica presa
    // numa sessão autenticada sem loja associada.
    if (cred) { try { await signOut(auth); } catch (_) {} }
    showError(friendlyAuthError(err));
  } finally {
    setLoading(false);
  }
});

function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return 'Este e-mail já está cadastrado. Tente fazer login.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'E-mail ou senha incorretos.';
  if (code.includes('weak-password')) return 'Senha muito curta (mínimo 6 caracteres).';
  if (code.includes('invalid-email')) return 'E-mail inválido.';
  return 'Ocorreu um erro: ' + (err?.message || 'tente novamente.');
}

// Deixa acessível para debug/checagem manual, se necessário
window.__getStoreByUid = getStoreByUid;
