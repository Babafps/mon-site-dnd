// =====================================================================
// stripe-webhook — la seule chose au monde qui écrit dans `entitlements`.
//
// Le site est statique : il n'a aucun serveur, et surtout aucune clé secrète.
// Le navigateur envoie l'acheteur vers une page de paiement hébergée par
// Stripe, et c'est Stripe qui vient frapper ICI quand l'argent est arrivé.
//
// Trois règles, dans l'ordre d'importance :
//   1. rien n'est écrit avant que la SIGNATURE de Stripe soit vérifiée ;
//   2. la vérification se fait sur le corps BRUT — un JSON.parse d'abord et
//      la signature ne correspond plus ;
//   3. on ne fait confiance qu'aux montants et aux identifiants qui viennent
//      de l'événement, jamais à ce que le navigateur a pu glisser dans l'URL.
//
// Déploiement :
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   (--no-verify-jwt est indispensable : Stripe n'a pas de jeton Supabase,
//    il s'authentifie par sa propre signature, vérifiée ci-dessous.)
//
// Secrets à définir (Project Settings → Edge Functions → Secrets) :
//   STRIPE_API_KEY                  clé secrète Stripe (sk_test_… puis sk_live_…)
//   STRIPE_WEBHOOK_SIGNING_SECRET   secret du endpoint (whsec_…)
//
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement par
// Supabase : rien à faire, et le préfixe SUPABASE_ est de toute façon réservé.
//
// Puis, dans Stripe → Développeurs → Webhooks, pointer sur
//   https://<projet>.supabase.co/functions/v1/stripe-webhook
// en cochant : checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
// =====================================================================

import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@^2';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string);
// Deno n'a pas le module crypto de Node : Stripe passe par la Web Crypto API.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// La clé service_role contourne la RLS : c'est le seul chemin d'écriture vers
// `entitlements`, et il n'existe que dans cette fonction, jamais dans le
// navigateur.
const supabase = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string,
    { auth: { persistSession: false } }
);

/** Repli si un produit Stripe n'a pas encore sa métadonnée `product_key`.
 *  Format : STRIPE_PRICE_MAP={"price_123":"des-obsidienne","price_456":"abonnement"} */
function envPriceMap(): Record<string, string> {
    try { return JSON.parse(Deno.env.get('STRIPE_PRICE_MAP') || '{}'); }
    catch { return {}; }
}

/** La clé de produit maison, lue là où Stripe la porte.
 *  On la met dans les métadonnées du PRODUIT (ou du prix) côté Stripe : ainsi
 *  ajouter un article ne demande pas de redéployer cette fonction. */
async function productKeys(session: Stripe.Checkout.Session): Promise<string[]> {
    const map = envPriceMap();
    const keys = new Set<string>();

    const items = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100, expand: ['data.price.product']
    });
    for (const item of items.data) {
        const price = item.price;
        if (!price) continue;
        const product = price.product as Stripe.Product | string;
        const meta = (typeof product === 'object' && product?.metadata) || {};
        const key = meta.product_key || price.metadata?.product_key || map[price.id];
        if (key) keys.add(String(key));
    }
    return [...keys];
}

/** L'identifiant du compte Bones & Blades, tel que la page tarifs l'a passé. */
function userIdOf(o: { client_reference_id?: string | null; metadata?: Stripe.Metadata | null }): string | null {
    const raw = o.client_reference_id || o.metadata?.user_id || null;
    // On n'écrit que si ça ressemble vraiment à un UUID : la valeur vient d'une
    // URL, donc de quelque chose qu'un curieux peut modifier. La clé étrangère
    // vers auth.users refuserait de toute façon un identifiant inventé, mais
    // autant ne pas essayer.
    return raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
}

async function grant(row: {
    user_id: string; product: string; expires_at?: string | null;
    stripe_customer_id?: string | null; stripe_subscription_id?: string | null;
    event_id: string;
}) {
    const { error } = await supabase.from('entitlements').upsert({
        user_id: row.user_id,
        product: row.product,
        active: true,
        expires_at: row.expires_at ?? null,
        source: 'stripe',
        stripe_customer_id: row.stripe_customer_id ?? null,
        stripe_subscription_id: row.stripe_subscription_id ?? null,
        stripe_event_id: row.event_id
    }, { onConflict: 'user_id,product' });
    if (error) throw error;
}

async function revoke(subscriptionId: string, eventId: string) {
    const { error } = await supabase.from('entitlements')
        .update({ active: false, stripe_event_id: eventId })
        .eq('stripe_subscription_id', subscriptionId);
    if (error) throw error;
}

/** Retrouve le compte à partir de l'abonnement, quand l'événement ne le porte
 *  pas : les lignes déjà écrites le savent. */
async function userIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
    const direct = userIdOf(sub);
    if (direct) return direct;
    const { data } = await supabase.from('entitlements')
        .select('user_id').eq('stripe_subscription_id', sub.id).limit(1).maybeSingle();
    return data?.user_id ?? null;
}

const periodEnd = (sub: Stripe.Subscription): string | null => {
    // Stripe a déplacé la fin de période sur l'article dans les versions
    // récentes ; on lit les deux, sans supposer laquelle est présente.
    const raw = (sub as unknown as { current_period_end?: number }).current_period_end
        ?? sub.items?.data?.[0]?.current_period_end;
    return raw ? new Date(raw * 1000).toISOString() : null;
};

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });

    const signature = req.headers.get('Stripe-Signature');
    const body = await req.text();          // BRUT : surtout pas de req.json()
    if (!signature) return new Response('Signature absente', { status: 400 });

    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') as string,
            undefined,
            cryptoProvider
        );
    } catch (err) {
        // Signature invalide : on ne lit même pas le contenu.
        console.error('signature refusée :', (err as Error).message);
        return new Response('Signature invalide', { status: 400 });
    }

    try {
        switch (event.type) {
            // ---- Achat unique ET première facture d'abonnement ----
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.payment_status !== 'paid' && session.status !== 'complete') break;

                const userId = userIdOf(session);
                if (!userId) { console.error('checkout sans identifiant de compte :', session.id); break; }

                const keys = await productKeys(session);
                if (!keys.length) { console.error('checkout sans product_key :', session.id); break; }

                let expires: string | null = null;
                let subId: string | null = null;
                if (session.mode === 'subscription' && session.subscription) {
                    subId = typeof session.subscription === 'string'
                        ? session.subscription : session.subscription.id;
                    const sub = await stripe.subscriptions.retrieve(subId);
                    expires = periodEnd(sub);
                    // L'identifiant du compte est recopié sur l'abonnement : les
                    // renouvellements suivants n'ont plus l'URL d'origine.
                    await stripe.subscriptions.update(subId, { metadata: { user_id: userId } });
                }
                for (const product of keys) {
                    await grant({
                        user_id: userId, product, expires_at: expires,
                        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
                        stripe_subscription_id: subId, event_id: event.id
                    });
                }
                break;
            }

            // ---- Renouvellements, changements de formule, reprise ----
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object as Stripe.Subscription;
                const userId = await userIdFromSubscription(sub);
                if (!userId) { console.error('abonnement sans compte connu :', sub.id); break; }

                const keys = new Set<string>();
                const map = envPriceMap();
                for (const item of sub.items.data) {
                    const price = item.price;
                    const product = await stripe.products.retrieve(String(price.product));
                    const key = product.metadata?.product_key || price.metadata?.product_key || map[price.id];
                    if (key) keys.add(String(key));
                }
                if (!keys.size) keys.add('abonnement');

                // Tant que Stripe considère l'abonnement vivant, l'accès court
                // jusqu'à la fin de la période payée — un paiement en retard ne
                // coupe pas l'accès du jour au lendemain.
                const alive = ['active', 'trialing', 'past_due'].includes(sub.status);
                for (const product of keys) {
                    if (alive) {
                        await grant({
                            user_id: userId, product, expires_at: periodEnd(sub),
                            stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : null,
                            stripe_subscription_id: sub.id, event_id: event.id
                        });
                    } else {
                        await revoke(sub.id, event.id);
                    }
                }
                break;
            }

            // ---- Résiliation effective ----
            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription;
                await revoke(sub.id, event.id);
                break;
            }

            default:
                // Les autres événements ne nous concernent pas : on répond 200
                // pour que Stripe cesse de réessayer.
                break;
        }
    } catch (err) {
        // Erreur de notre côté : on répond 500, Stripe rejouera l'événement.
        console.error('traitement échoué', event.type, (err as Error).message);
        return new Response('Traitement échoué', { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
    });
});
