# Mobile App Guide — Patient Side (Profile, Booking, Appointments)

This is a scoped reference for the mobile app's **patient-facing** features only:

1. **Profile management** — check / create / update the patient's FHIR profile.
2. **Appointment booking** — search doctors, find open slots, book.
3. **Appointment listing & actions** — list, view, reschedule, cancel.

Deliberately **out of scope** for this document: profile photo upload, joining a
video/in-person consultation, AI intake/consultation, and anything doctor-side.
If you need those later, ask and we'll extend this guide or point you at the
fuller internal reference (`/docs/mobile-guide` in the web app).

Every endpoint below is called **directly against the FHIR backend** (not
through this Next.js app) — the exact same contract this app's own server
actions already validate against and use in production. The examples are
copied from this app's real Zod schemas and its own patient profile /
appointment code, not written from scratch.

---

## 1. Authentication

Every call below sends **one** credential: a Better Auth-issued JWT, as

```
Authorization: Bearer <token>
```

**Why the web app's own login flow can't be copied as-is:** the web app
authenticates via a browser session cookie — a server component reads the
cookie, forwards it to Better Auth, and gets a session back. A mobile app has
no cookie jar in that sense, so it does the equivalent two-step exchange
itself:

**Step 1 — sign in.** Recommended: OAuth 2.0 Authorization Code + PKCE, opened
in a system browser tab (`ASWebAuthenticationSession` on iOS, `Custom Tabs` on
Android) — not an embedded WebView (login pages commonly block being framed,
and it reads as a phishing risk to app stores). A direct email/password call
to `POST {BETTER_AUTH_URL}/api/auth/sign-in/email` also works for an internal
test client, but skips 2FA/SSO. **Confirm the exact OAuth client
id/redirect-uri registration with the IAM/backend team before building** — the
web app's own client is confidential (has a secret) and a native app should
get its own public, secret-less client registered for PKCE.

**Step 2 — exchange the session for a JWT.**

```
GET {BETTER_AUTH_URL}/api/auth/token
```

```json
// Response
{ "token": "eyJhbGciOiJFZERTQSIs..." }
```

The response key may be `token`, `jwt`, or `access_token` depending on IAM
config. The token is short-lived (minutes) — re-mint it, don't cache it long
term.

**Step 3 — use it everywhere below**, sent straight to the FHIR backend at
`{FHIR_GQL_URL}` (base URL — confirm the exact value with the backend team for
your environment).

---

## 2. Tenant isolation — `org_id` on every call

**This app is multi-tenant.** Every patient/appointment/slot record belongs to
one organization (clinic/hospital), and the backend does **not** infer that
for you on most calls — the caller has to say which tenant it means.

**How the web app gets this for free, and why mobile can't:** the web app's
Next.js server actions read the organization off the browser session
(`session.activeOrganizationId`) and stamp it into every payload themselves,
server-side — the client never sends it, and can't override it. A mobile app
skips that Next.js layer entirely and talks to the FHIR backend directly, so
**there is no one stamping `org_id` in for you — the app has to do it itself,
on every call that accepts it.**

**Where the value comes from:** decode the JWT from step 2 above and read its
`activeOrganizationId` claim — this is the exact same claim the web app's own
session carries, and the exact same claim this app's own bearer-token
verification (used by its API routes) reads. **Confirm with the IAM/backend
team that this claim is populated for patient accounts** in your environment
before relying on it — whether it's present depends on how the IAM service's
JWT plugin is configured, and the web app's own docs flag this as something to
verify, not assume.

**Where to put it, per call** — not every endpoint accepts it, and not every
endpoint needs it the same way:

| Call type | Where `org_id` goes |
|---|---|
| Create (`POST`) | Body field |
| List/search (`GET` with filters) | Query param |
| Get-by-id / update-by-id / delete-by-id | **Not accepted** — the record's own tenant is already fixed by its `id`, so there's nothing to pass |

The per-endpoint tables in sections 3–5 below call out exactly which of these
each one is. The summary table at the end lists all of them in one place.

---

## 3. Profile management

Every patient must have exactly one FHIR `Patient` record before booking is
allowed. Check for it on every app launch; if it's missing, force the user
through profile setup before letting them book.

### 3.1 Check whether a profile exists

```
GET /patients/me
```

Resolved entirely from the bearer token — no `id`, no `org_id`, no query
params. Returns the caller's own `Patient` record, or a not-found result if
they haven't completed onboarding yet. This is exactly what the web app's own
page guard does before rendering any patient page.

```json
// Response (profile exists)
{
  "id": 10001,
  "user_id": "usr_123",
  "org_id": "org_1",
  "gender": "male",
  "birth_date": "1990-01-01",
  "active": true,
  "name": [{ "id": 1, "use": "official", "family": "Doe", "given": ["John"] }],
  "telecom": [{ "id": 1, "system": "phone", "value": "+1-555-0100", "rank": 1 }],
  "address": [{ "id": 1, "line": ["123 Main St"], "city": "Springfield" }]
}
```

If there's no record for this user, treat it as "needs onboarding" and go to 3.2.

### 3.2 Create the profile (first time only)

```
POST /patients/full
```

One atomic call — creates the `Patient` plus its name / contact / address
sub-records together, instead of four separate round-trips. This is exactly
what the web app's own profile form does on first save.

`org_id` is **required** here — `POST` is a create call, and there's no
existing record yet to infer the tenant from.

```json
// Request
{
  "user_id": "usr_123",
  "org_id": "org_1",
  "active": true,
  "gender": "male",
  "birth_date": "1990-01-01",
  "names": [
    { "family": "Doe", "given": ["John"] }
  ],
  "telecom": [
    { "system": "phone", "value": "+1-555-0100", "rank": 1 },
    { "system": "email", "value": "john@example.com", "rank": 1 }
  ],
  "addresses": [
    { "line": ["123 Main St"], "city": "Springfield", "state": "IL", "postal_code": "62704" }
  ]
}
```

```json
// Response
{
  "id": 10001,
  "name": [{ "id": 1, "use": "official", "family": "Doe", "given": ["John"] }],
  "telecom": [{ "id": 1, "system": "phone", "value": "+1-555-0100" }],
  "address": [{ "id": 1, "line": ["123 Main St"], "city": "Springfield" }]
}
```

**Watch the field-name asymmetry:** the create request uses `names` /
`addresses` (plural), but the response comes back as `name` / `address`
(singular). This is a real quirk of the backend, not a typo in this guide —
both this app's create form and its Zod schemas match it exactly. `telecom`
is the same word both ways.

All fields other than `user_id`/`org_id` are optional — send whatever the
user filled in; omit the rest.

### 3.3 Update the profile

```
PATCH /patients/{id}/full
```

Same atomic shape as create — updates scalar fields (gender, birth date,
etc.) and **replaces** the name/telecom/address arrays with whatever you send
(not merged — send the full current set, not just the changed field).

`org_id` is **not accepted** on this call — the record's tenant was fixed
when it was created and can't move.

```json
// Request
{
  "gender": "male",
  "birth_date": "1990-01-01",
  "names": [{ "family": "Doe", "given": ["John"] }],
  "telecom": [{ "system": "phone", "value": "+1-555-0199", "rank": 1 }],
  "addresses": [{ "line": ["456 Oak Ave"], "city": "Springfield" }]
}
```

```json
// Response
{ "id": 10001, "gender": "male", "birth_date": "1990-01-01" }
```

**Not covered here:** profile photo upload — skip it for this build.

---

## 4. Appointment booking

Three calls in sequence: search doctors → find their open times → book.

### 4.1 Search doctors

```
GET /practitioner-roles/booking
```

This is the endpoint the app actually uses for doctor search — not
`Practitioner` directly. The response already comes pre-joined with the
doctor's name/photo/qualifications and their location/service info, so no
extra lookups are needed to render a results list.

`org_id` is optional but should be sent — query param, scopes results to your
tenant.

| Query param | Type | Notes |
|---|---|---|
| `specialty_code` | string | SNOMED specialty code |
| `day_of_week` | string | `mon` \| `tue` \| `wed` \| `thu` \| `fri` \| `sat` \| `sun` |
| `active` | boolean | |
| `org_id` | string | **Send this — see §2** |
| `limit` / `offset` | number | Pagination |

```json
// Response
{
  "total": 1, "limit": 10, "offset": 0,
  "data": [{
    "id": 40001,
    "active": true,
    "practitioner_detail": {
      "id": 30001,
      "name": [{ "family": "Smith", "given": ["Jane"] }],
      "gender": "female",
      "qualification": [{ "code_display": "MD" }]
    },
    "location": [{ "id": 230001, "name": "Downtown Clinic", "address_line": "123 Main St" }],
    "healthcare_service": [{ "id": 260001, "name": "General Practice" }]
  }]
}
```

`practitioner_role_id` (`data[].id` above) is what you use in the next step —
not the practitioner's own id.

### 4.2 Find open times for a chosen doctor

```
GET /slots
```

`org_id` is optional but should be sent — query param.

| Query param | Type | Notes |
|---|---|---|
| `practitioner_role_id` | number | The `id` from §4.1's results |
| `date` | string | One calendar date, `YYYY-MM-DD` |
| `status` | string | Send `free` to only get bookable slots |
| `org_id` | string | **Send this — see §2** |
| `limit` / `offset` | number | Pagination |

```json
// Response
{ "total": 1, "limit": 10, "offset": 0, "data": [{ "id": 60001, "status": "free", "start": "2026-01-15T09:00:00Z", "end": "2026-01-15T09:30:00Z" }] }
```

Fetch one day at a time (`date=`), not a wide range — a whole month's slots
can exceed the page size and silently truncate.

### 4.3 Book it

```
POST /appointments/book
```

Atomically builds the appointment and marks the slot busy. `org_id` is
optional but should be sent — body field, same as the web app always does.

```json
// Request
{
  "practitioner_id": 30001,
  "slot_id": 60001,
  "patient_id": 10001,
  "org_id": "org_1",
  "appointment_type_display": "Follow-up",
  "reason_code": "E11.9",
  "comment": "Recurring headaches"
}
```

```json
// Response
{
  "id": 70019,
  "status": "booked",
  "start": "2026-01-15T09:00:00Z",
  "end": "2026-01-15T09:30:00Z",
  "participant": [
    { "reference_type": "Patient", "reference_id": 10001, "status": "accepted" },
    { "reference_type": "Practitioner", "reference_id": 30001, "status": "accepted" }
  ]
}
```

**`practitioner_id` here is the Practitioner id, not the PractitionerRole id**
from §4.1 — check the doctor-search response's `practitioner_detail.id`.

Returns **409 Conflict** if the slot was taken by someone else between §4.2
and this call. On 409, re-fetch §4.2 and let the user pick again — don't
retry the same slot.

---

## 5. Appointment listing & actions

List, view, reschedule, cancel. **Not included:** joining a video/in-person
consultation — that's a separate flow, ask if you need it later.

### 5.1 List the patient's own appointments

```
GET /appointments
```

There's no separate "my appointments" endpoint — filter by `user_id` to scope
to the signed-in patient.

`org_id` is optional but should be sent — query param.

| Query param | Type | Notes |
|---|---|---|
| `user_id` | string | The signed-in patient's own user id (from the JWT's `sub`) |
| `status` | string | `proposed` \| `pending` \| `booked` \| `arrived` \| `fulfilled` \| `cancelled` \| `noshow` \| `entered-in-error` \| `checked-in` \| `waitlist` |
| `start_from` / `start_to` | string | ISO instant bounds |
| `org_id` | string | **Send this — see §2** |
| `limit` / `offset` | number | Pagination |

```json
// Response
{ "total": 1, "limit": 10, "offset": 0, "data": [{ "id": 70019, "status": "booked", "start": "2026-01-15T09:00:00Z" }] }
```

### 5.2 Get one appointment's detail

```
GET /appointments/{id}
```

`org_id` is not accepted — the record's tenant is already fixed by its `id`.

```json
// Response
{ "id": 70019, "status": "booked", "start": "2026-01-15T09:00:00Z", "end": "2026-01-15T09:30:00Z" }
```

### 5.3 Reschedule

```
POST /appointments/{id}/reschedule
```

Frees the old slot and marks the new one busy atomically — you only supply
the new slot id (found the same way as §4.2, for a new date). `org_id` is not
accepted here either.

```json
// Request
{ "new_slot_id": 60050 }
```

```json
// Response
{ "id": 70019, "status": "booked", "start": "2026-01-16T09:00:00Z" }
```

### 5.4 Cancel

```
PATCH /appointments/{id}
```

There's no dedicated "cancel" endpoint — this is a normal update with
`status` set to `cancelled`, exactly what the web app's own cancel dialog
does. `org_id` is not accepted here either.

```json
// Request
{ "status": "cancelled" }
```

```json
// Response
{ "id": 70019, "status": "cancelled" }
```

---

## 6. Quick reference — every endpoint and its `org_id` requirement

| # | Method | Path | `org_id` |
|---|---|---|---|
| 3.1 | GET | `/patients/me` | Not accepted |
| 3.2 | POST | `/patients/full` | **Required** (body) |
| 3.3 | PATCH | `/patients/{id}/full` | Not accepted |
| 4.1 | GET | `/practitioner-roles/booking` | Send it (query param) |
| 4.2 | GET | `/slots` | Send it (query param) |
| 4.3 | POST | `/appointments/book` | Send it (body) |
| 5.1 | GET | `/appointments` | Send it (query param) |
| 5.2 | GET | `/appointments/{id}` | Not accepted |
| 5.3 | POST | `/appointments/{id}/reschedule` | Not accepted |
| 5.4 | PATCH | `/appointments/{id}` | Not accepted |

"Not accepted" endpoints are all scoped by a record `id` that already belongs
to a fixed tenant — there's nothing to pass. Everywhere else, always include
it.
