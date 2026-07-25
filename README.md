# Pizzaria Cheia — SaaS multi-tenant

Sistema de cardápio digital com pedido direto via WhatsApp, agora reestruturado
de um único arquivo HTML para uma aplicação **multi-tenant** de verdade: cada
pizzaria tem sua própria conta, seu próprio painel e seu próprio link de
cardápio, todos rodando no mesmo código.

## Gerador de pôster (Divulgação)

Nova aba no painel (`🖼️ Gerar Pôster`) que monta uma arte pronta pra postar no
Instagram/Facebook usando os dados que você já cadastrou — sem precisar de
Canva, IA de imagem ou designer:

- Escolhe um **produto** ou **combo** já cadastrado
- Escolhe o **modelo**: "Destaque de Produto" (foto grande + preço) ou
  "Promoção" (mais chamativo, mostra preço antigo/novo e economia)
- Escolhe o **formato**: quadrado (feed) ou vertical (Stories)
- Baixa o **PNG pronto**, na resolução certa (1080×1080 ou 1080×1920)

Tudo é renderizado no próprio navegador via `<canvas>` (`src/lib/poster.js`),
reaproveitando a foto do produto, o nome da loja e a cor da marca já
configurados — não depende de nenhuma API externa nem gera custo por imagem.

**Limitação conhecida**: fotos de exemplo (as URLs do Unsplash usadas no
template de demonstração) vêm de outro domínio e alguns navegadores bloqueiam
exportar um canvas que contém uma imagem "de fora" sem cabeçalho CORS liberado
— o gerador detecta isso e avisa o dono pra usar uma foto que ele mesmo
enviou (upload), o que resolve o problema e também fica com uma aparência mais
autêntica no anúncio.

## O que mudou em relação à v3 (HTML único)

| Antes | Agora |
|---|---|
| 1 arquivo `.html` com tudo (CSS + JS + dados) | Projeto Vite com módulos separados |
| Dados em variáveis JS na memória (somem ao recarregar) | Persistidos no Firestore |
| 1 pizzaria só, sem login | Multi-tenant: N pizzarias, cada uma com login próprio |
| Painel e cardápio na mesma página (toggle) | `admin.html` (painel, autenticado) e `loja.html` (cardápio público) separados |
| Sem forma de o cliente se cadastrar sozinho | `auth.html` com cadastro self-service |

## Arquitetura

```
pizzaria-saas/
├── index.html          → landing simples (leva pro cadastro/login)
├── auth.html            → login + criar conta (onboarding de pizzaria nova)
├── admin.html           → painel do lojista (autenticado)
├── loja.html            → cardápio público (somente leitura, ao vivo)
├── firestore.rules      → regras de segurança
├── firebase.json        → config de hosting + rewrites de URL
└── src/
    ├── firebase.js       → init do Firebase (Auth + Firestore)
    ├── lib/
    │   ├── store-repo.js → toda a leitura/escrita no Firestore
    │   ├── seed.js        → dados de demonstração p/ pizzaria nova
    │   ├── whatsapp.js    → monta a mensagem e o link do pedido
    │   └── format.js      → moeda, slugify, geração de id
    ├── auth/auth.js
    ├── admin/admin.js      → toda a lógica do painel (produtos, categorias, combos, avaliações, aparência)
    └── storefront/storefront.js → cardápio público + carrinho + checkout
```

### Modelo de dados (Firestore)

```
/stores/{uid}     1 documento por pizzaria (uid = dono, do Firebase Auth)
                  { name, tagline, phone, addr, ..., features:{...},
                    categories:[...], products:[...], combos:[...], reviews:[...],
                    slug, ownerUid, ownerEmail, createdAt }

/slugs/{slug}     { uid }   — mapeia a URL amigável (/loja/nome-da-pizzaria) pro dono
```

Guardamos **tudo dentro de um único documento por loja** (em vez de uma
coleção de produtos com 1 documento por pizza). Isso é proposital: carregar o
cardápio inteiro custa **1 leitura no Firestore**, não uma leitura por item —
o que importa muito pro custo quando você tiver dezenas de pizzarias ativas.

O cardápio público (`loja.html`) usa `onSnapshot` (tempo real): quando o dono
salva uma alteração no painel, ela aparece automaticamente pra quem já está
com o cardápio aberto no celular, sem precisar recarregar a página.

## Rodando localmente

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Authentication** → método "E-mail/senha"
3. Ative **Firestore Database** (modo produção)
4. Em "Configurações do projeto" → "Seus apps" → crie um app Web e copie as credenciais
5. Copie `.env.example` para `.env` e preencha com essas credenciais
6. Instale as dependências e rode:

```bash
npm install
npm run dev
```

7. Abra `/auth.html`, crie uma conta de teste — isso já cria a pizzaria e te
   leva direto pro painel (`/admin.html`)
8. No painel, clique em "👁 Ver Cardápio ao Vivo" pra ver o link público

## Publicando (deploy)

Duas opções simples, ambas gratuitas para começar:

**Firebase Hosting** (mais simples, já que você já está usando Firebase):
```bash
npm run build
npm install -g firebase-tools   # se ainda não tiver
firebase login
firebase init hosting            # aponte pra pasta "dist", já existente no firebase.json
firebase deploy
```

**Cloudflare Pages** (como discutido anteriormente, útil se você quiser depois
adicionar uma camada de cache na borda com Workers): conecte o repositório,
build command `npm run build`, output directory `dist`. Nesse caso, configure
o rewrite `/loja/*` → `/loja.html` nas configurações do Cloudflare Pages
(`_redirects` ou regra de Functions), já que o `firebase.json` só vale para o
Firebase Hosting.

Depois de publicar, o link de cada pizzaria fica em:
`https://seudominio.com/loja/nome-da-pizzaria`

## Segurança (`firestore.rules`)

O arquivo `firestore.rules` já vem pronto no projeto. Regras:

- Qualquer pessoa pode **ler** um documento de loja (o cardápio é público)
- Só o **dono autenticado** (uid igual ao id do documento) pode **escrever**
  no próprio documento — ninguém escreve no documento de outra pizzaria
- **Validação de schema**: a regra confere se os campos essenciais existem e
  têm o tipo certo (nome é texto, categorias/produtos/combos/avaliações são
  listas com um tamanho máximo, etc.) — isso barra dados malformados mesmo
  vindos de fora do app (alguém chamando a API do Firestore direto)
- **Imutabilidade**: `ownerUid` não pode ser trocado depois de criado, e
  `createdAt` não pode ser alterado numa atualização — protege contra um
  usuário tentando "roubar" ou adulterar outra loja

### Como aplicar as regras no seu projeto Firebase

**Opção A — pelo Console (mais rápido, sem instalar nada):**
1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → seu projeto
2. Menu lateral → **Firestore Database** → aba **Regras**
3. Copie todo o conteúdo de `firestore.rules` e cole ali, substituindo o que existir
4. Clique em **Publicar**

**Opção B — pela linha de comando (recomendado se for atualizar as regras com frequência):**
```bash
npm install -g firebase-tools   # se ainda não tiver
firebase login
firebase use --add               # selecione seu projeto (uma vez só)
firebase deploy --only firestore:rules
```
Esse comando só publica as regras (não mexe no Hosting), lendo automaticamente
o caminho configurado em `firebase.json` (`"firestore": {"rules": "firestore.rules"}`).

**Antes de publicar em produção**, vale testar no simulador do próprio
Console (Firestore Database → Regras → aba **Playground**): simula uma
leitura/escrita como usuário autenticado ou anônimo e mostra se a regra
permite ou bloqueia, sem precisar publicar nada ainda.

## Limitações conhecidas / próximos passos recomendados

- **Imagens em base64 dentro do documento**: mantive o mesmo comportamento da
  v3 (upload vira uma string base64 salva direto no Firestore) pra não
  quebrar o fluxo que você já testou. Isso funciona bem no começo, mas cada
  documento do Firestore tem limite de 1&nbsp;MB — com várias fotos de
  produtos isso pode virar um problema. Recomendo migrar os uploads pro
  **Firebase Storage** (guardando só a URL da imagem no Firestore) antes de
  ter muitas pizzarias cadastrando fotos.
- **Cache de borda (Cloudflare Workers)**: mencionado na conversa anterior
  como "fase 2" — ainda não implementado aqui. Útil quando o número de lojas
  ativas crescer.
- **Cobrança/planos**: não há nenhuma lógica de assinatura/pagamento ainda —
  hoje qualquer pessoa que se cadastra tem acesso completo.
- **Emails duplicados / recuperação de senha**: o fluxo de "esqueci minha
  senha" do Firebase Auth não está exposto na tela de login ainda.
