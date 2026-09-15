// Netlify serverless function.
// Creates a Stripe Checkout Session for an exact donation amount, so the amount
// the visitor picked on support.html is the amount that shows on Stripe's page —
// no re-typing, no relying on a URL parameter Stripe doesn't support.
//
// Requires an environment variable set in the Netlify dashboard (Site settings →
// Environment variables), NOT in this file:
//   STRIPE_SECRET_KEY = sk_live_... (or sk_test_... while testing)
//
// Requires the "stripe" package — see package.json in this folder.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount } = JSON.parse(event.body || '{}');
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 1) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Please provide a valid amount of at least £1.' }),
      };
    }

    // Stripe amounts are in the smallest currency unit (pence for GBP).
    const amountInCents = Math.round(numericAmount * 100);

    const origin = event.headers.origin || event.headers.referer || '';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      submit_type: 'donate',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Gift to Firestarter Nepal',
              description: 'Supporting worship nights, trainings, and gatherings.',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/support.html?given=true`,
      cancel_url: `${origin}/support.html?given=false`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Something went wrong creating the checkout session.' }),
    };
  }
};
