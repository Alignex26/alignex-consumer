# ELSEA — commercial configuration

Everything an operator must create outside this repository, and the exact
identifiers the code expects.

**Nothing in this document has been created.** These are instructions, not a
record of completed work. No store product exists, no RevenueCat project exists,
and no API key has been issued. The code is written against these identifiers so
that creating them is configuration rather than a code change.

---

## 1. The commercial model

| | |
|---|---|
| Free | **3 complete sessions, lifetime, per account** |
| Monthly | **USD 9.99** |
| Annual | **USD 49.99** — the primary offer |
| Paid experience | Unlimited legitimate use |
| Entitlement name | `premium` |

No weekly plan, no lifetime purchase, no credits, no per-session charge.

**Displayed prices always come from the store, localised, at runtime.** The
figures above are the product's intent and are configured in App Store Connect
and Google Play. They are deliberately absent from the app's source: a hardcoded
"$49.99" ships stale the day a price changes or the moment somebody opens the app
outside the United States.

An annual-vs-monthly saving, if shown, is calculated from the two live prices.
Never from these numbers.

---

## 2. Product identifiers

Stable, store-agnostic, and already referenced by the code:

| Purpose | Identifier |
|---|---|
| Entitlement | `premium` |
| Annual subscription | `elsea_premium_annual` |
| Monthly subscription | `elsea_premium_monthly` |
| Subscription group (iOS) | `elsea_premium` |
| Base plan (Android, annual) | `annual` |
| Base plan (Android, monthly) | `monthly` |

The entitlement is what the app checks. The product ids are recorded for
reporting only — `entitlements.product_id` — and are never consulted when
deciding access. A promotional grant or a second store therefore needs no code
change.

---

## 3. App Store Connect

Apple Developer Program membership status is **unconfirmed** — treat every step
below as outstanding until verified.

1. **Apple Developer Program** — confirm the membership is active and the
   organisation's legal entity matches the one on the Paid Applications
   agreement.
2. **Paid Applications Agreement** — must be *active*, with banking and tax
   completed. Subscriptions cannot be created, let alone tested, until it is.
   This is the single most common cause of an empty product list in sandbox.
3. **App record** — bundle identifier as configured in `app.json`.
4. **Subscription group** `elsea_premium`.
   Both products must live in the *same* group so a customer can move between
   them without holding two subscriptions.
5. **Subscriptions**
   - `elsea_premium_annual` — 1 year, USD 49.99
   - `elsea_premium_monthly` — 1 month, USD 9.99
   - Set the annual as the higher service level within the group.
6. **Localisations** — display name and description per store locale, for at
   least the five launch languages.
7. **Review information** — subscriptions require a screenshot and review notes.
8. **App privacy answers** — see §7.
9. **Sandbox testers** — create at least two, in Users and Access.

**Free trial:** ELSEA's three free sessions are *not* an Apple introductory
offer. They are server-side entitlement, so no introductory pricing is
configured. This matters: an Apple free trial would require a payment method up
front, which the product explicitly does not want.

---

## 4. Google Play Console

The developer account is already approved.

1. **App record** — package name as configured in `app.json`.
2. **Subscription** `elsea_premium`, with two base plans:
   - `annual` — 1 year, auto-renewing, USD 49.99
   - `monthly` — 1 month, auto-renewing, USD 9.99
3. **Regional pricing** — review the auto-converted prices rather than accepting
   them blind.
4. **Licence testers** — for purchase testing without charge.
5. **Internal testing track** — before closed testing.
6. **Data safety form** — see §7.
7. **Content rating questionnaire.**
8. **Real-money purchase declaration.**

---

## 5. RevenueCat

**Not integrated.** The entitlement tables, the RPCs and the client boundary
exist; the SDK and the webhook do not.

1. **Project** — one, with an iOS app and an Android app.
2. **App Store Connect credentials** — the in-app purchase shared secret, and an
   App Store Connect API key for server notifications.
3. **Google Play credentials** — a service account JSON with the Play Developer
   API enabled, granted access in Play Console.
4. **Entitlement** — identifier exactly `premium`.
5. **Products** — attach `elsea_premium_annual` and `elsea_premium_monthly` to
   the `premium` entitlement.
6. **Offering** — one, `default`, with the annual package marked as the primary.
7. **Public SDK keys** — one per platform. These are *publishable* keys and are
   safe in the client bundle; they are not secrets.
8. **Webhook** — pointed at the Edge Function in §6, with its authorisation
   header value stored as a function secret.

### Keys, and where each one lives

| Key | Where | Secret? |
|---|---|---|
| RevenueCat public SDK key (iOS) | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | No — publishable |
| RevenueCat public SDK key (Android) | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | No — publishable |
| RevenueCat webhook authorisation | Edge Function secret | **Yes** |
| App Store shared secret | RevenueCat only | **Yes** |
| Play service account JSON | RevenueCat only | **Yes** |

The two publishable keys are the only commercial values that may carry an
`EXPO_PUBLIC_` prefix. Everything in the "Yes" rows stays server-side, and none
of it belongs in this repository or in `.env`.

---

## 6. What remains to be built

The schema and the client boundary are done. These are not:

- **RevenueCat SDK integration** — purchase, restore, and listening for
  entitlement changes.
- **Webhook Edge Function** — receives RevenueCat events and writes
  `entitlements` with the service role. This is the only thing that may write
  that table; the client can read its own row and nothing more.
- **Status mapping** — RevenueCat's vocabulary onto ELSEA's five states
  (`active`, `grace`, `billing_issue`, `cancelled`, `expired`).
- **Paywall UX** — `src/app/paywall.tsx` is a 61-line placeholder.

Until the webhook exists, `entitlements` is never written, so every account is on
the free trial and the paywall appears after the third completed session. That is
coherent behaviour, not a broken state — but no purchase can succeed, so the app
is not shippable until §6 is complete.

---

## 7. Privacy disclosure inputs

Factual inputs for the two store forms. **Not legal advice, and not a privacy
policy** — both need product-owner and legal review before submission.

| Data | Collected | Linked to identity | Purpose |
|---|---|---|---|
| Email address | Yes | Yes | Authentication (OTP sign-in) |
| Session state selections | Yes | Yes | Delivering and improving sessions |
| Session outcomes | Yes | Yes | Effectiveness |
| Free-text wellbeing input | **Not stored** | — | Passed to the safety gate and structured interpretation; the raw text is never persisted, never cached, never logged, and never used in an identifier |
| Purchase history | Via store/RevenueCat | Yes | Entitlement |
| Audio content | Static assets | No | Served by short-lived signed URL from a private bucket |

**Requires confirmation before either form is submitted:**

- Data retention periods — not decided.
- Whether analytics is classed as tracking — depends on the provider chosen.
- The legal entity and contact address.
- Support email and the terms/privacy URLs.
- Per-jurisdiction crisis resources for each launch locale, which must be
  verified by a human rather than translated.
