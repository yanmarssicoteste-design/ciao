import { onlyDigits, brl } from './format.js';

const SIZE_LABEL = { P: 'Pequena', M: 'Média', G: 'Grande', Combo: 'Combo' };

export function storeWhatsNumber(phone) {
  let digits = onlyDigits(phone);
  if (digits.length === 11 || digits.length === 10) digits = '55' + digits; // DDI Brasil
  return digits;
}

export function buildOrderMessage({ storeName, cart, name, addr, sub, fee, total }) {
  const linhas = [];
  linhas.push(`Novo pedido — ${storeName}`);
  linhas.push('');
  cart.forEach((item) => {
    const tam = item.size ? ` (${SIZE_LABEL[item.size] || item.size})` : '';
    linhas.push(`${item.qty}x ${item.name}${tam} — ${brl(item.price * item.qty)}`);
  });
  linhas.push('');
  linhas.push(`Subtotal: ${brl(sub)}`);
  linhas.push(`Taxa de entrega: ${brl(fee)}`);
  linhas.push(`Total: ${brl(total)}`);
  linhas.push('');
  linhas.push(`Nome: ${name}`);
  linhas.push(`Endereço: ${addr}`);
  return linhas.join('\n');
}

export function whatsappUrl(phone, message) {
  const numero = storeWhatsNumber(phone);
  if (!numero) return null;
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(message);
}

export { SIZE_LABEL };
