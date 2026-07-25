// Dados de demonstração usados para popular a conta de uma pizzaria nova
// no momento do cadastro. O dono edita/apaga tudo depois pelo painel admin.
export function seedStore({ name, phone, slug }) {
  return {
    slug,
    name: name || 'Minha Pizzaria',
    tagline: 'Feita com amor, entregue com sabor',
    phone: phone || '',
    addr: 'Rua Exemplo, 123 — Centro',
    hours: '18h–23h',
    closeTime: '23:00',
    fee: 5,
    minOrder: 30,
    deliveryTime: '40–60 min',
    rating: '5.0 (novo)',
    promoTxt: '🔥 Edite esta mensagem promocional no painel',
    promoTag: 'NOVIDADE',
    logo: '',
    color: '#c0392b',
    features: { urgency: true, social: true, promo: true, combos: true, reviews: true, minbar: true, orbit: true, upsell: true },
    categories: [
      { id: 'c1', name: 'Tradicional', emoji: '🍕', type: 'sizes', display: 'featured' },
      { id: 'c2', name: 'Especial', emoji: '✨', type: 'sizes', display: 'featured' },
      { id: 'c3', name: 'Bebida', emoji: '🥤', type: 'single', display: 'list' },
      { id: 'c4', name: 'Borda', emoji: '🧀', type: 'single', display: 'list' },
    ],
    products: [
      { id: 'p1', name: 'Margherita Clássica', cat: 'c1', desc: 'Molho de tomate artesanal, mussarela de búfala fresca e manjericão colhido na hora.', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80', prices: [38, 45, 62], active: true },
      { id: 'p2', name: 'Calabresa Apimentada', cat: 'c1', desc: 'Calabresa artesanal, cebola roxa caramelizada e azeitona preta.', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80', prices: [35, 43, 58], active: true },
      { id: 'p3', name: 'Quatro Queijos', cat: 'c2', desc: 'Mussarela, provolone defumado, gorgonzola e parmesão ralado na hora.', img: 'https://images.unsplash.com/photo-1548369937-47519962c11a?w=500&q=80', prices: [42, 52, 68], active: true },
      { id: 'p4', name: 'Coca-Cola 2L', cat: 'c3', desc: 'Gelada e refrescante.', img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&q=70', prices: [12], active: true },
      { id: 'p5', name: 'Borda Catupiry', cat: 'c4', desc: 'Borda recheada com catupiry cremoso.', img: '', prices: [8], active: true },
    ],
    combos: [
      { id: 'co1', name: 'Combo Família', price: 89, origPrice: 104, items: '1 Pizza Grande + 2 Coca-Cola 2L + 1 Borda Recheada', saving: 'Economize R$15', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=70', active: true },
    ],
    reviews: [
      { id: 'r1', name: 'Cliente Satisfeito', stars: 5, text: 'Exemplo de avaliação — edite ou apague no painel.', product: 'Margherita', date: 'há 2 dias', avatar: '' },
    ],
  };
}
