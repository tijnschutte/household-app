# Web Push operations

How the VAPID keys are scoped and what happens when they change. For getting
notifications working on a laptop, the README is enough — this is the part that
matters once there is a deployment involved.

## Which pair goes where

Production and Preview share one pair, because they share one database: a
subscription made on a preview URL lands in the same table production pushes
from, and a subscription can only be pushed to with the key it was created
against.

Local dev uses its own pair — it talks to the docker database, and a key on a
laptop should not be able to reach a real phone. Vercel's "Development" scope is
deliberately left unset, so `vercel env pull` cannot quietly arm a checkout with
production push credentials.

## Rotating the pair

Rotating silently breaks every existing subscription: the push service answers
403, which is **not** treated as a dead device. A 401/403 is far more often our
own misconfiguration — a wrong key deployed, a skewed clock invalidating the
VAPID JWT — and deleting every household's subscriptions over that is not
something anyone can undo.

Recovery happens on the client instead. The settings screen compares the key a
subscription was made with against the key in use, and trades in a stale one. So
after a rotation, each member starts receiving again the next time they open the
Huis page.
