# Backbone Command user guide

How to use the screens, in plain words. This guide starts with Phase 7; screens built before it are described in the [README](../README.md#screens). Each phase adds its own sections here.

---

## Signing in

**Who:** everyone.

1. Open Backbone Command and type your **email** and **password**, then press **Sign in**.
2. You land on your home screen: the Command Center for Converge-J Fiber staff and contractor managers, the Field App for crew leads.

What you see depends on your role:

| Role | You see |
|---|---|
| Admin (Converge-J Fiber) | Every PO, contractor, crew and incident, plus Settings and the month-end close |
| Contractor manager | Only your own company's POs, crews, routes, incidents, scorecard and LD. LD notices appear once the PMO has issued them. |
| Ground team (crew lead) | The Field App, for your own crew's POs only |

**Forgot your password?** Ask the Converge-J Fiber admin to invite you again. You'll get an email with a link to choose a new password.

**Demo mode.** On a demo laptop the sign-in screen lists demo accounts (password `demo1234`). Pick one to see the system as that role. Nothing you do in demo mode reaches the real system.

## Choosing your password (first sign-in)

**Who:** anyone invited by the admin.

1. Open the invitation email and press the link. Backbone Command opens and signs you in.
2. Type a new password twice (at least 10 characters) and press **Save password**.
3. From now on, sign in with your email and that password.

The link works once. If it has expired, ask the admin to invite you again.

## Settings > People and access

**Who:** admins only.

Use it to give someone access, change what they can see, or resend a lost password link.

**Invite someone**
1. Type their **email** and **full name**.
2. Pick their **role**:
   - Admin, for Converge-J Fiber staff.
   - Contractor manager, then pick their **contractor**.
   - Ground team, then pick their **contractor** and **crew**.
3. Press **Invite**. They get an email with a link to choose their password.

**Change someone's role or crew:** invite the same email again with the new role. Their access changes straight away, and they also get a password reset email.

**Remove access:** for now, delete the user in the Supabase dashboard, or change their role to one that sees less. A button for this comes in a later phase.

The list below the form shows everyone who can sign in, with their role, contractor and crew. Every change to access is recorded in the audit log.

## Field App: sending when the signal comes back

**Who:** crew leads, and contractor managers sending for one of their crews.

Nothing changes in how you send an update, a blocker or a damage report: confirm it and it's saved on the phone first.

- With signal, it's sent right away, photos included.
- Without signal, it waits in **Outbox** and goes out on its own when the phone is back online. Keep the app open for a moment after the signal returns.
- If you sign out with items still waiting, they stay on the phone. They're sent the next time **you** sign in on that phone. If another crew lead signs in on the same phone, your items wait for you.
- If the phone sends the same item twice (for example, it lost the reply), it's recorded only once.

## Incident signing link (QR code)

**Who:** the responsible party (an outsider with no account), shown the QR code by the crew or office.

1. Scan the QR code on the incident or open the link sent to you.
2. Check the summary: who, when, where, what, and the restoration cost so far.
3. Type your full name and position, sign with your finger, and **slide to sign**.

The link only opens that one incident and can be signed once. After signing, the incident shows as acknowledged in Backbone Command. The wording on the page is a placeholder until Converge-J Fiber legal sends the final text.
