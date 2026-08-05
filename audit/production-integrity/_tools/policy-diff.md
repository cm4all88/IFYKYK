## Policies DROPPED (write access for {public})

| Table | Policy | Cmd | In migration |
|---|---|---|---|
| `creator_billing` | `creator_billing_service_all` | ALL | ✅ dropped |
| `billing_credits` | `billing_credits_service` | ALL | ✅ dropped |
| `digital_purchases` | `dpur_insert` | INSERT | ✅ dropped |
| `digital_purchases` | `dpur_update` | UPDATE | ✅ dropped |
| `merch_orders` | `merch_orders_insert` | INSERT | ✅ dropped |
| `post_unlocks` | `post_unlocks_service_insert` | INSERT | ✅ dropped |
| `super_tips` | `super_tips_insert` | INSERT | ✅ dropped |
| `early_access_passes` | `early_access_insert` | INSERT | ✅ dropped |
| `early_access_passes` | `early_access_update` | UPDATE | ✅ dropped |
| `gift_subscriptions` | `gift_sub_insert` | INSERT | ✅ dropped |
| `gift_subscriptions` | `gift_sub_update` | UPDATE | ✅ dropped |
| `live_streams` | `live_streams_insert` | INSERT | ✅ dropped |
| `creator_referrals` | `creator_referrals_insert` | INSERT | ✅ dropped |
| `creator_referrals` | `creator_referrals_update` | UPDATE | ✅ dropped |
| `subscriber_referrals` | `subscriber_referrals_insert` | INSERT | ✅ dropped |
| `subscriber_referrals` | `subscriber_referrals_update` | UPDATE | ✅ dropped |
| `wishlist_purchases` | `wishlist_purchases_insert` | INSERT | ✅ dropped |
| `marketplace_orders` | `Anyone can create order` | INSERT | ✅ dropped |
| `social_addback_orders` | `Anyone can create an order` | INSERT | ✅ dropped |

## Policies DROPPED (unrestricted read of private data)

| Table | Policy | In migration |
|---|---|---|
| `creator_profiles` | `Creators are publicly readable` | ✅ dropped |
| `tips` | `Tips publicly readable` | ✅ dropped |
| `live_streams` | `live_streams_select` | ✅ dropped |

## Policies CREATED

| Table | Policy |
|---|---|
| `creator_profiles` | `creator_profiles_own_select` |
| `tips` | `tips_fan_select` |
| `live_streams` | `live_streams_public_status` |
| `creator_billing` | `creator_billing_own_insert` |
| `creator_billing` | `creator_billing_own_update` |

## Correctly-scoped policies LEFT UNTOUCHED

| Table | Policy | Touched by migration |
|---|---|---|
| `merch_orders` | `merch_orders_select` | ✅ untouched |
| `creator_billing` | `creator_billing_own_select` | ✅ untouched |
| `digital_purchases` | `dpur_own` | ✅ untouched |
| `billing_credits` | `billing_credits_own` | ✅ untouched |
| `creator_profiles` | `Creators can update their own profile` | ✅ untouched |
| `creator_profiles` | `Users can insert their own profile` | ✅ untouched |
| `live_streams` | `live_streams_creator_manage` | ✅ untouched |
| `tips` | `Creators can view tips they received` | ✅ untouched |
| `subscriptions` | `Users can view their own subscriptions` | ✅ untouched |
| `wishlist_purchases` | `wishlist_purchases_update` | ✅ untouched |

**Summary:** 22/22 dangerous policies dropped, 5 narrow policies created, 10/10 good policies preserved.
