// ─────────────────────────────────────────────────────────────────────────────
// migrate-stripe.mjs — recrée toute la configuration Stripe sur un compte neuf.
//
// Crée (ou retrouve, s'il existe déjà) le produit « Abonnement Famille », son
// prix à 7 €/mois, la configuration du portail client et le webhook, puis
// affiche les 6 variables à poser sur Vercel.
//
// USAGE
//   node scripts/migrate-stripe.mjs --cle sk_test_xxx
//   node scripts/migrate-stripe.mjs --cle sk_live_xxx --site https://www.lesmondesdusavoir.fr --confirmer
//
// OPTIONS
//   --cle <sk_...>    clé secrète Stripe du compte cible (obligatoire)
//   --site <url>      URL publique du site (défaut : https://www.lesmondesdusavoir.fr)
//   --confirmer       obligatoire pour agir sur un compte LIVE (garde-fou)
//
// IDEMPOTENT : relançable sans créer de doublon. Le secret du webhook n'est
// toutefois affiché qu'à la CRÉATION — note-le, Stripe ne le remontre jamais.
// ─────────────────────────────────────────────────────────────────────────────
import Stripe from "stripe";

const PRIX_CENTIMES = 700; // 7,00 €
const DEVISE = "eur";
const CLE_PRIX = "famille_mensuel_7eur"; // lookup_key : sert de garde-fou anti-doublon
const EVENEMENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

// ── Arguments ────────────────────────────────────────────────────────────────
function arg(nom) {
  const i = process.argv.indexOf(`--${nom}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const cle = arg("cle") || process.env.STRIPE_SECRET_KEY;
const siteUrl = (arg("site") || "https://www.lesmondesdusavoir.fr").replace(/\/+$/, "");
const confirme = process.argv.includes("--confirmer");

if (!cle) {
  console.error("✖ Clé secrète manquante. Utilise : --cle sk_test_… (ou sk_live_…)");
  process.exit(1);
}

const estLive = cle.startsWith("sk_live_");
if (estLive && !confirme) {
  console.error(
    "✖ Clé LIVE détectée : ce script va créer des objets sur le compte réel.\n" +
      "  Relance avec --confirmer si c'est bien ce que tu veux."
  );
  process.exit(1);
}

const stripe = new Stripe(cle);
const urlWebhook = `${siteUrl}/api/stripe/webhook`;

console.log(`\n▸ Mode        : ${estLive ? "LIVE (réel)" : "TEST"}`);
console.log(`▸ Site        : ${siteUrl}`);
console.log(`▸ Webhook     : ${urlWebhook}\n`);

// ── 1. Produit ───────────────────────────────────────────────────────────────
// Retrouvé par metadata plutôt que par nom : le nom est modifiable dans le
// dashboard, la metadata non.
async function produit() {
  const existants = await stripe.products.search({
    query: `active:'true' AND metadata['app']:'lesmondesdusavoir'`,
    limit: 1,
  });
  if (existants.data.length) {
    console.log(`  = produit déjà présent : ${existants.data[0].id}`);
    return existants.data[0];
  }
  const p = await stripe.products.create({
    name: "Abonnement Famille — Les mondes du Savoir",
    description:
      "Accès illimité à tous les univers, quiz, badges et fonctionnalités pour tout le foyer.",
    metadata: { app: "lesmondesdusavoir" },
  });
  console.log(`  + produit créé : ${p.id}`);
  return p;
}

// ── 2. Prix ──────────────────────────────────────────────────────────────────
async function prix(produitId) {
  const existants = await stripe.prices.list({
    lookup_keys: [CLE_PRIX],
    active: true,
    limit: 1,
  });
  if (existants.data.length) {
    const p = existants.data[0];
    console.log(`  = prix déjà présent : ${p.id} (${p.unit_amount / 100} ${p.currency})`);
    return p;
  }
  const p = await stripe.prices.create({
    product: produitId,
    unit_amount: PRIX_CENTIMES,
    currency: DEVISE,
    recurring: { interval: "month" },
    lookup_key: CLE_PRIX,
  });
  console.log(`  + prix créé : ${p.id} (7 €/mois)`);
  return p;
}

// ── 3. Portail client ────────────────────────────────────────────────────────
// Règle métier : la résiliation prend effet À LA FIN DE LA PÉRIODE PAYÉE, sans
// prorata. Le client garde donc l'accès jusqu'au terme du mois déjà réglé.
async function portail() {
  const existantes = await stripe.billingPortal.configurations.list({ limit: 100 });
  const deja = existantes.data.find(
    (c) => c.active && c.metadata?.app === "lesmondesdusavoir"
  );
  if (deja) {
    console.log(`  = portail déjà présent : ${deja.id}`);
    return deja;
  }
  const c = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Les mondes du Savoir — gérer votre abonnement",
      privacy_policy_url: `${siteUrl}/politique-confidentialite`,
      terms_of_service_url: `${siteUrl}/cgv`,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
      },
    },
    metadata: { app: "lesmondesdusavoir" },
  });
  console.log(`  + portail créé : ${c.id} (résiliation en fin de période, sans prorata)`);
  return c;
}

// ── 4. Webhook ───────────────────────────────────────────────────────────────
async function webhook() {
  const existants = await stripe.webhookEndpoints.list({ limit: 100 });
  const deja = existants.data.find((w) => w.url === urlWebhook && w.status === "enabled");
  if (deja) {
    const manquants = EVENEMENTS.filter((e) => !deja.enabled_events.includes(e));
    if (manquants.length) {
      await stripe.webhookEndpoints.update(deja.id, { enabled_events: EVENEMENTS });
      console.log(`  ~ webhook mis à jour : ${deja.id} (ajout de ${manquants.join(", ")})`);
    } else {
      console.log(`  = webhook déjà présent : ${deja.id}`);
    }
    console.log(
      "    ⚠ Son secret (whsec_…) n'est visible qu'à la création.\n" +
        "      Récupère-le dans le dashboard Stripe → Developers → Webhooks."
    );
    return { id: deja.id, secret: null };
  }
  const w = await stripe.webhookEndpoints.create({
    url: urlWebhook,
    enabled_events: EVENEMENTS,
    description: "Les mondes du Savoir — statut premium",
  });
  console.log(`  + webhook créé : ${w.id}`);
  return { id: w.id, secret: w.secret };
}

// ── Exécution ────────────────────────────────────────────────────────────────
try {
  console.log("① Produit");
  const prod = await produit();

  console.log("\n② Prix");
  const tarif = await prix(prod.id);

  console.log("\n③ Portail client");
  const conf = await portail();

  console.log("\n④ Webhook");
  const hook = await webhook();

  const publiable = estLive ? "pk_live_… (dashboard Stripe)" : "pk_test_… (dashboard Stripe)";

  console.log(`
─────────────────────────────────────────────────────────────────
✓ Configuration Stripe en place.

À poser sur Vercel — Settings → Environment Variables,
en cochant les TROIS environnements (Production, Preview, Development) :

  STRIPE_SECRET_KEY                    = (ta clé secrète, déjà en main)
  STRIPE_PRICE_ID                      = ${tarif.id}
  STRIPE_PORTAL_CONFIG_ID              = ${conf.id}
  STRIPE_WEBHOOK_SECRET                = ${hook.secret ?? "(à récupérer dans le dashboard)"}
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   = ${publiable}
  NEXT_PUBLIC_SITE_URL                 = ${siteUrl}

⚠ Redéploie ensuite EN DÉCOCHANT LE CACHE : les variables NEXT_PUBLIC_*
  sont figées à la compilation, un simple redémarrage ne suffit pas.

Restent à faire à la main dans le dashboard :
  • activer les reçus par e-mail (Settings → Emails → paiements réussis)
  • vérifier que la résiliation reste « à la fin de la période »
─────────────────────────────────────────────────────────────────`);
} catch (e) {
  console.error("\n✖ Échec :", e?.message || e);
  process.exit(1);
}
