# Viulhi Design System

The rules every Viulhi surface follows: storefront, admin portal, POS, emails, invoices and any future app.
Built for **Viulhi**, a crochet shop in the Maldives. The feel is **modern retail: calm, warm, generous whitespace, soft peach and pink**, with handmade warmth rather than tech polish.

> **Golden rule:** never hard-code a colour, font size, spacing, radius or shadow. Use a token from `css/tokens.css`. If a token is missing, add it there first.

---

## 1. Files

| File | Purpose |
|---|---|
| `css/tokens.css` | Design tokens: brand colours, semantic colours, type, spacing, radius, shadow, motion, dark mode |
| `css/base.css` | Reset, global typography, `.container`, focus styles, reduced motion |
| `css/components.css` | Shared components: buttons, icon buttons, badges, section headings, product cards, price, toast, input |
| `css/layout.css` | Storefront shell: announcement bar, header, Shop menu, search, mobile drawer, footer |
| `css/<page>.css` | Page-only layout (`home.css`, `legal.css`). Never put reusable components here |
| `js/theme.js` | Light/dark mode (system default, toggle remembered per browser) |
| `js/config.js` | Store settings: currency, GST rate, price display mode, money helpers |

Stylesheet load order is always: **tokens → base → components → layout → page**.

**Local preview:** run `python serve.py` in the project folder and open http://localhost:8000. It sends no-cache headers, so a normal refresh always loads your latest CSS/JS. (Plain `python -m http.server` lets the browser keep stale scripts.)

**Cache-busting:** every page links its CSS/JS with a version tag, e.g. `js/shop.js?v=202610261806`. Whenever you publish changes to a real host, bump the version on every page so returning visitors get the new files. New pages must copy the same `?v=` tags.

**Pages:** `index.html` (home) · `shop.html` (all products: search, sort, category/bestseller filters, load more; deep links `?category=`, `?q=`, `?sort=`, `?filter=bestsellers`) · `custom.html` (custom order requests: tinted panel with intro, contact rows and "How it works" on the left, white request form card on the right; no map, event date or guest count) · `cart.html` · `account.html` · `checkout.html` · `payment.html` · `orders.html` · `terms.html` · `my-account.html` · `profile.html` · admin portal in `admin/` (section 12). Category links, the Shop menu, header search and "View all products" all lead to `shop.html`.

**Logo mark:** a yarn ball (circle, three diagonal wraps, a loose thread tail) on a peach circle. Never use latitude/longitude-style lines, because at small sizes they read as a globe.

**Favicons:** every page's `<head>` includes:
```html
<link rel="icon" href="favicon.ico" sizes="any" />
<link rel="icon" href="favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
```
Icon files can't read CSS tokens. If the brand colours or mark change, update `favicon.svg` and regenerate `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png` and `icon-512.png` from it.

---

## 2. Brand colours (dynamic)

Four inputs at the top of `tokens.css` drive the whole palette. Change them and everything updates, including dark mode, hovers and tints, through `color-mix()`.

| Token | Default | Role |
|---|---|---|
| `--brand-primary` | `#F2A488` peach | Primary buttons, badges, highlights, icons |
| `--brand-secondary` | `#F6C6CC` light pink | Soft tinted surfaces, gradients |
| `--brand-warm` | `#FBEDE4` warm cream | Product tiles, footer, muted surfaces |
| `--brand-ink` | `#2A1F1B` warm near-black | Text, dark buttons |

The admin portal's **Brand settings** will write these four values (plus logo and name) to override the defaults.

### Semantic colours: what components use

| Token | Use for |
|---|---|
| `--color-bg` | Page background |
| `--color-surface` | Cards, panels, menus, inputs |
| `--color-surface-muted` | Product image tiles, category tiles, footer, hover backgrounds |
| `--color-surface-tint` | Soft pink/peach feature areas (promo, announcement, page heroes) |
| `--color-text` / `--color-text-muted` | Body text / secondary text |
| `--color-border` / `--color-border-strong` | Hairlines / outlined buttons and inputs |
| `--color-primary` (+ `-hover`, `on-primary`) | Peach buttons and badges; text on peach is **ink**, never white |
| `--color-primary-text` | Peach as text (eyebrows, links, icons): a darker peach that's readable |
| `--color-strong` (+ `-hover`, `on-strong`) | Dark pill buttons, toast |
| `--color-glow-pink` / `--color-glow-peach` | Soft gradient glows on placeholders and tinted feature areas (deep cocoa in dark mode) |
| `--color-placeholder` | Icon colour inside image placeholders |
| `--color-sale` | Sale badges, discount, favourite/active |
| `--color-success` | Confirmations |

**Never use `--brand-*` or `--primary-*` scale tokens directly in components** unless the surface is pinned to one theme (like the hero, which is always light or photo).

### Dark mode
Warm, cocoa-tinted dark, not grey. Same semantic names, different values. Defined twice in `tokens.css` (system preference and `data-theme="dark"`). **Keep both blocks identical.** Every new component must be checked in both modes.

Large feature surfaces that need their own palette (e.g. the hero's `--hero-*` tokens in `home.css`) follow the same pattern: light values on the component, plus matching dark overrides in both dark-mode selectors. Tinted areas in dark mode are deep cocoa with a faint peach/pink glow, never pale pastels.

---

## 3. Typography

- **One family:** `Plus Jakarta Sans` (400, 500, 600, 700) for everything. Thaana uses `--font-thaana` with the `.thaana` class (RTL).
- Headings: weight **500**, tight tracking (`--tracking-tight`), line-height 1.1. Large and calm, not bold and shouty.
- UI labels and buttons: **600**. Prices: **700**.
- Eyebrows (`.eyebrow`): 12px, uppercase, wide tracking, peach text, sitting above section titles.

| Token | Size | Use |
|---|---|---|
| `--text-display` | 40→72px | Hero headline only |
| `--text-4xl` | 34→48px | Page titles, banner titles |
| `--text-3xl` | 28→36px | Section titles |
| `--text-2xl` | 24px | Sub-section titles |
| `--text-xl` / `--text-lg` | 20 / 18px | Card titles / lead text |
| `--text-base` | 16px | Body |
| `--text-sm` / `--text-xs` | 14 / 12px | Meta, buttons, badges |

Copy tone: warm, short, plain English. Sentence case everywhere (`Shop by category`, not `Shop By Category`).

---

## 4. Spacing, layout, shape

- **4px grid:** `--space-1` (4) … `--space-24` (96).
- Content width `--container` 1240px with `--gutter` (16→32px). Wrap sections in `.container`.
- Vertical rhythm between home sections: `--section-gap` (64→112px) via `.section`.
- **Radius:** `--radius-sm` 8 (small controls) · `--radius-md` 14 (menus, callouts) · `--radius-lg` 20 (cards, tiles) · `--radius-xl` 28 (hero, banners) · `--radius-pill` (all buttons, inputs, badges).
- **Shadows** are rare and soft (`--shadow-sm/md/lg`). Prefer tinted surfaces and hairline borders over shadows.
- **Whitespace is the design.** When in doubt, add space and remove decoration.

---

## 5. Iconography

- **Hugeicons, stroke-rounded only**, via `<i class="hgi hgi-stroke hgi-NAME"></i>`. Browse at hugeicons.com.
- Default sizes: 18–21px in buttons and nav, 28px in feature cells, **52–64px thin icons for categories**.
- Icon colour is `--color-primary-text` when decorative, `currentColor` inside buttons.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons need an `aria-label`.
- No emoji in UI.

---

## 6. Components

All in `css/components.css` unless noted.

**Buttons**: always pill-shaped, 48px tall (`.btn-sm` 38px, `.btn-lg` 54px).
- `.btn-primary` peach: the main action ("Add to cart", "Shop the collection"). Max one per view area.
- `.btn-dark` ink: strong secondary ("Sign in", "Start a custom order").
- `.btn-outline`: tertiary ("View all products").
- `.btn-light`: on top of photos only.

**Icon button** (`.icon-btn`): 42px round, transparent until hover. `.count-badge` inside shows cart/wishlist counts and stays `hidden` when the count is 0.

**Badges** (`.badge`): pill, 11px semibold. `.badge-sale` (red, `-20%`), `.badge-new` (peach), plain white for labels like "Bestseller".

**Section head** (`.section-head`): eyebrow + title on the left, optional action button on the right. `.is-centered` for showcase sections like New arrivals.

**Product card** (`.product-card`):
- 4:5 image on a `--color-surface-muted` tile with `--radius-lg`.
- Badge top-left, favourite top-right, "Add to cart" slides up on hover (always visible on touch). The add button uses `--color-cart-btn`: **peach (brand primary) in light mode**, cream in dark mode. Sold-out buttons stay dark and disabled.
- Below: category (uppercase xs), name (semibold), price (bold). No GST note on cards.
- Grid: 4 columns → 3 (≤1024px) → 2 (≤720px). Never 1 column for products.

**Boxed product card** (`VIULHI.productCard(p, { boxed: true })` → `.product-card.is-boxed`): for browsing pages like the Shop. A bordered white card holds the image on an inset tile, then category, name with a round ↗ arrow (turns peach on hover, hidden on phones), price, and a stats row with **stock** (`.stock`: green "In stock", peach "Only N left" at ≤ `VIULHI.LOW_STOCK` (5), muted "Sold out") and **"N sold"**. Sold-out products get a dark "Sold out" badge, a faded photo and a disabled add button, and they always sort last. The plain card stays the default for home page sections.

**Stock rule:** the cart never holds more than a product's `stock` (`ViulhiCart.maxFor(id)`). Adding beyond it shows an error toast.

**Price**: always through `VIULHI.money()` and `VIULHI.displayPrice()`. Sale shows the old price struck through. Product cards don't carry a per-price GST note; the site-wide footer line states whether prices include GST. Use `VIULHI.taxNote()` on product pages, cart and checkout.

**Media placeholder** (`.media-fallback`): soft gradient + category icon, shown until a real photo loads. Never show a broken image.

**Toast** (`.toast`): dark pill, bottom-centre, auto-hides after 2.4s (4s with an action). Use `ViulhiCart.toast("…")`, or `ViulhiCart.toast("…", { href, label })` for a link such as "View cart".

**Inputs** (`.input`): pill, 48px, strong border, peach border on focus. **Select** (`.select > select + i`): same pill shape with a chevron icon. **Field label** (`.field-label`): 14px semibold above a field.

**Form fields** (`.field` > `.field-label` + control, `.field-grid` for 2 columns with `.span-2`):
- `.textarea`: same border as inputs, `--radius-md`. `.input-prefix` holds a fixed prefix such as `+960`.
- Optional fields say so in the label (`<span class="optional">(optional)</span>`); required ones don't get asterisks.
- Errors: set `aria-invalid="true"` (red border) and add a `.field-error` line with `hgi-alert-circle` under the field. Validate on submit, clear as soon as the user fixes the field, focus the first invalid field, and show an error toast.
- `.field-hint`: muted helper text under a field.

**Choice chips** (`.chips > label.chip > input[type=radio] + i + text`): pick one from a few short options shown as pills (e.g. "What would you like?" on the custom order form). The selected chip gets a peach ring and a tinted fill. Use radio cards instead when each option needs a second line of detail.

**Radio cards** (`.radio-cards > label.radio-card`): for choosing between a few options with more info than a plain radio (banks, delivery methods). The selected card gets a peach border, tinted background and peach tick.

**Checkbox** (`.check > input + span`): custom 20px rounded box, peach when checked.

**Drop zone** (`label.dropzone` with a hidden file input) + **file chip** (`.file-chip`): dashed tile for uploads that works with drag-and-drop and click. After upload it's replaced by a chip with a thumbnail (image preview, or a PDF icon), file name, size and a remove button.

**Dialog** (`<dialog class="dialog">` with `.dialog-icon`, title, text and `.dialog-actions`): for confirming destructive actions. Open it with `showModal()`. Esc and a backdrop click close it. Put the destructive action first (`.btn-danger`, red) and the safe choice second (`.btn-outline`, focused by default). Never use the browser's `confirm()`.

**Tabs** (`.tabs[role=tablist] > button.tab[role=tab]` + `.tab-count`): pill filters for lists (orders now, and later portal tables such as products, orders and expenses). The selected tab is filled with the dark colour and the count sits inside the pill. The row scrolls sideways on phones and keeps the selected tab in view. Arrow keys move between tabs, and the selected tab is kept in the URL (`?tab=`).

**Text link button** (`.link-btn`, `.link-btn-danger`): a quiet secondary action such as "Continue shopping" or "Cancel order". The danger variant turns red on hover.

**Callout** (`.callout`, `.callout-tint`): a short inline note with an icon, bold title and muted text, e.g. "Payment by bank transfer only".

**Status track** (`.status-card` > `.status-track` > `.status-step`): the order progress bar. Build it with `VIULHI.statusTrack(order)` from `js/order-store.js`. Steps come from `config.js → orderStatuses`: Order placed → Payment → Verifying payment → Confirmed → On the way → Delivered. Done steps are peach with a tick, the current step has a peach ring, and upcoming steps are muted. It's horizontal on desktop and vertical on phones. Pair it with a `.badge-status` (`.is-success` once confirmed). Use the same component for the customer status page and the admin portal's order view.

**Step card** (`.step` with `.step-head` > `.step-num` "01"): numbered white cards for multi-step forms (checkout, account setup). The numbered style matches the home value grid.

**Quantity stepper** (`.qty`): pill with − / number / + buttons. Disable − at 1 and + at the max (99).

**Breadcrumb** (`.breadcrumb`): small muted links separated by `hgi-arrow-right-01`, current page in text colour with `aria-current="page"`.

**Empty state** (`.empty-state`): tinted rounded panel, 96px white circle with a thin icon, title, one line of friendly copy, one primary button.

**Order summary** (`.summary` + `dl.summary-rows`): white card with `.summary-row` lines (muted label, semibold value) and a `.summary-total` row. Always shows **Subtotal (excl. GST) → GST (8%) → Delivery → Total**. Reused for checkout, quotations and invoices.

**Page head** (`.page-head`, in layout.css): breadcrumb + `--text-4xl` title for inner pages (cart, checkout, account). A count or context can sit in `<small>` after the title.

**Shared JS** (`js/product-card.js`): `VIULHI.productCard(p)`, `VIULHI.renderProducts(grid, list)`, `VIULHI.productMedia(p)`, `VIULHI.watchImage(img, box)`, `VIULHI.product(id)`, `VIULHI.category(slug)`, `VIULHI.esc(str)`. Never re-implement product cards per page.

**Cart API** (`js/cart.js`): `ViulhiCart.add / setQty / remove / clear / items / count`. Fires a `cart:change` event on `document`, and syncs across tabs.

**Main nav:** Home · Shop ▾ · Custom Orders · Contact (no "New In").

**Header actions** (in this order): search · theme toggle · cart with count · Sign in (`[data-account-link]`). There's no separate orders icon: **orders live inside the cart**. `cart.html` and `orders.html` share a **segmented switch** (`.segmented`, "Cart | My orders", the cart count in `[data-cart-count]`) beside the page title, inside a `.page-head-row`. My orders is also in the account menu and the footer.

**Segmented switch** (`nav.segmented > a`, current page has `aria-current="page"`): a muted pill track with the active option on a raised white pill. Use it to move between sibling pages. Use `.tabs` for filtering a list within one page. Once signed in, `main.js` swaps "Sign in" for the **account menu** (avatar initial + first name, with a dropdown showing name/email, My orders and Sign out). In the mobile drawer it becomes a signed-in box with a Sign out button.

**Avatar** (`.avatar`): the customer's initial in a peach circle. **Password field** (`.input-password` with a show/hide `.icon-btn` using `hgi-view` / `hgi-view-off`). **Read-only input** (`.input[readonly]`): muted fill, used for values the customer can't change here, such as the account email at checkout. **Form-level error** (`.form-error`): a red tinted bar above the submit button for errors that aren't tied to one field ("That email and password don't match"). Every page links My orders in the header, the mobile menu and the footer Help column.

**Layout pieces** (`css/layout.css`): announcement bar (tinted), sticky blurred header (logo · centred nav · actions), Shop dropdown, search panel, mobile drawer (slides from left), 4-column footer on a muted surface.

---

## 7. Imagery

- Real product photography on **plain, light, warm backgrounds** (cream, blush, white), soft natural light, product centred with breathing room.
- Hero and banner photos: lifestyle shots in island light, with warm tones. The hero darkens photos automatically for text contrast.
- Product photos are 4:5 portrait. Minimum 1200×1500px, JPG/WebP, under 300KB.
- Hero photos are landscape, at least 2400×1400px, with the subject on the **right** half (text sits on the left).

**Current placeholder photos** are free Pexels images (each product's `photo` field in `js/catalog.js` is its Pexels photo ID, and the Shop shows a small "Product photos from Pexels" credit). Choose clean, single-product shots on plain or soft backgrounds, avoid photos where people are the focus, and replace them with photos of your own pieces before launch, then remove the credit line.

| Slot | Path |
|---|---|
| Hero slides | `images/hero/hero-1.jpg`, `hero-2.jpg`, `hero-3.jpg` |
| Products | `images/products/<id>.jpg` (e.g. `p01.jpg`) |
| Custom-order banner | `images/promo/custom-order.jpg` |

---

## 8. Motion

- Subtle and quick: `--duration-fast` .15s for presses, `--duration` .25s for hovers, `--duration-slow` .6s for images and slides. Easing `--ease`.
- Allowed: fades, 4–14px lifts, gentle 1.04× image zoom on hover.
- Not allowed: bouncing, spinning, parallax, looping decoration.
- `prefers-reduced-motion` turns animation off globally (in `base.css`); sliders don't autoplay.

---

## 9. Commerce rules

- Currency **MVR**, formatted `MVR 1,234.00`.
- **GST 8%** is calculated automatically. Catalog prices are stored **before GST**. `config.js → showPricesWithGst` decides whether the shop shows prices with or without GST. The footer states it site-wide; product cards stay clean with no per-price note.
- Invoices, quotations, receipts and the POS always show **subtotal, GST 8% and total** on separate lines.
- When prices are shown with GST, the GST amount is calculated from the lines the customer sees, so the breakdown always adds up to the displayed total.
- Delivery fees come from `config.js → deliveryZones` and are added as-is. A zone with `fee: null` (other islands by ferry/cargo) shows "Paid on collection".
- **An account is required to check out.** `account.html` has Sign in / Create account tabs (name, email, +960 mobile, password of 8+ characters). Checkout, payment and My orders call `VIULHI.auth.require()`, which sends signed-out visitors to the account page with `?next=` and brings them back afterwards. Orders store `account` (the email), and customers only ever see their own orders. `js/auth.js` is a **browser-only prototype** and must be replaced by server-side accounts before launch.
- **Payment = bank transfer only** (BML and MIB, from `config.js → bankAccounts`). The flow is:
  1. `checkout.html`: contact, delivery, items, a "bank transfer only" callout and **Place order**. This creates the order with status `awaiting_payment`, empties the cart and goes to `payment.html?order=REF`.
  2. `payment.html`: status track, choose the bank, see the account details and exact amount (with copy buttons), then upload the slip. **Submit payment** stays disabled until a slip is attached. Submitting sets status `payment_submitted` ("Verifying payment").
  3. Staff set `confirmed` → `shipped` → `delivered` from the portal. The same `payment.html?order=REF` link works as the customer's order status page.
  - **Cancel order:** customers can cancel only while the status is `awaiting_payment` (`VIULHI.canCancel`), after confirming in a dialog. The status becomes `cancelled` (with `cancelledAt`), the status track ends in a red "Cancelled" step, and "Add items back to cart" restores the items. After a slip has been submitted, cancellation and refunds are handled by staff.
- Accepted slips are PDF and any image format (JPG, PNG, WEBP, HEIC…), up to `config.slip.maxMB` (10 MB).
- Order references look like `VH-YYMMDD-1234` and are used as the transfer reference.
- Phone numbers are Maldivian 7-digit numbers (starting 3, 7 or 9) entered after a fixed `+960` prefix. For other islands, collect the atoll (`config.atolls`) and the island name.
- Toasts for problems use `{ type: "error" }`, which shows a red alert icon instead of the check mark.

---

## 10. Accessibility checklist

- Text contrast at least 4.5:1 in **both** themes. Peach is a background, not body text; use `--color-primary-text` for peach text.
- Every interactive element is reachable by keyboard with a visible focus ring.
- Icon-only buttons have `aria-label`. Toggles use `aria-pressed` / `aria-expanded`.
- Tap targets at least 36px; layouts work from 360px wide with no sideways scrolling.

---

## 11. Customer account pages

- `my-account.html` (the account menu's "My account"): greeting, profile card (initials avatar, mobile, member since), default delivery address, three stat tiles, **latest order** (the newest in-progress order, else the newest) with the status track, order history (4 rows → My orders), and **Favourites** (`#favourites`, product grid).
- `profile.html`: sticky section nav + cards for Personal details (name, mobile, avatar colour), Delivery address (prefills checkout), Email (needs current password; orders and favourites move with it), Password.
- `my-account.html`, `orders.html` and `profile.html` share a segmented switch: Overview | My orders | Profile. On phones it goes full width without icons.
- **Avatar** shows two-letter initials (`VIULHI.initials(name)`). Colour choices: default peach, `.is-pink`, `.is-cream`, `.is-ink` ("Cocoa"). Sizes `.avatar-sm`, `.avatar-lg`.
- **Favourites** (`VIULHI.favs`): the heart on product cards saves per account (localStorage `viulhi-favs`); guests' hearts move into their account when they sign in.
- **Forgot password**: `account.html?mode=forgot` → "Check your email" → `account.html?mode=reset&token=…` (30 minutes, single use). The same flow exists in `admin/login.html`. There's no email service yet, so a "Preview" callout shows the link on screen. Remove it when emails are real.

## 12. Admin portal (`/admin/`)

Same `tokens.css` and `components.css`, plus `css/admin.css`. Pages: `login.html`, `index.html` (dashboard), `orders.html`, `order.html?ref=`, `requests.html` (custom requests), `customers.html`, `customer.html?email=`, `products.html`, `product.html?id=` (add/edit), `expenses.html`, `settings.html` (Store profile), `team.html` (Team & roles).

**Shell** (rendered by `js/admin/admin.js`, so pages only hold their content):
- White sidebar: logo + "Admin" tag, grouped nav (Sales, Catalogue, Finance, Settings) with peach count bubbles. The active item is tinted. The store card and "View store" sit at the bottom. Below 1024px it becomes an off-canvas drawer.
- Sticky blurred top bar: global search (orders, products and customers, press `/`), theme toggle, alerts bell, and the user menu (Change password, View store, Sign out).
- Content on `--color-bg`; panels are `.card` (white, hairline, `--radius-lg`).

**Page pattern:** `.admin-head` (breadcrumb, `--text-3xl` title, optional muted line, `.head-actions` on the right: outline secondary + one peach primary) → optional `.dash-stats` row of `.stat-card`s → `.card.list-card` with `.list-toolbar` (search pill + selects), `.tabs` with counts, `.table` in `.table-wrap`, `.pager`. Filters live in the URL (`?tab=&q=…`).

**New shared components** (components.css):
- `.card`, `.card-head`, `.card-actions`
- `.switch` (on/off)
- `.table` (+ `.num`, `.muted`, `.is-strong`, `.cell-item` with `.cell-thumb`), `.pager`
- `.menu` + `.menu-pop` (row "…" menus; `[data-menu]` toggles, `.is-danger` items last after an `<hr>`)
- `.stat-card`, `.sheet` (side panel dialog for editing), `.meta-list` (label/value pairs), `.input-search`
- `.form-error`, `.field-label-row`, `.account-sent`, `.callout-danger`
- `.badge-status` gains a dot, plus `.is-muted` (draft, awaiting) and `.is-strong` (to ship, quoted).

**Portal-only** (admin.css): `.bulk-bar` (floating dark pill for selected rows), `.save-bar` (sticky pill with the save button), `.image-pick`, `.tag-input`, `.timeline`, `.slip-view` / `.slip-preview` / `.slip-box`, `.repeat-row` (dynamic form rows), `.bank-card`, `.zone-row`, `.colour-grid`, `.brand-preview`, `.perm-table`, `.role-card`, login split screen.

**Order status words in the portal:** Awaiting payment (muted) → To verify (peach) → To ship (dark) → On the way (dark) → Delivered (green) / Cancelled (red). Staff actions (`VIULHI.admin.runOrderAction`): verify, reject slip (with a reason shown to the customer), mark as paid, ship (with a delivery note), deliver, cancel (with a reason; a paid order shows "Refund due"). Every action is written to `order.history` and the activity log. **Stock comes out when payment is verified** and goes back if a paid order is cancelled.

**Custom requests:** New (peach) → Quoted → Accepted (green) / Declined (muted). The side sheet has a "Your reply" block (status callout, quote incl. GST, message, "Write the reply email") and buttons for the next step: New gets Decline / Accept / **Send quote** (needs a price); Quoted gets Save changes / Customer declined / **Customer accepted**; Accepted and Declined get Reopen / Done. Decline asks for an optional reason. Every step goes to `request.history` (shown as an Activity timeline) and the activity log (`VIULHI.admin.requests.act`). The sidebar count and bell only count **unopened** new requests and **unread customer answers** (`A.requests.isUnseen`: `seenAt` vs `customerRepliedAt`), which also show a peach dot in the list. Customers see their requests in "Your requests" at the top of `custom.html` and on `my-account.html#requests` (also linked from the account menu). Both use `js/custom-requests.js` and `css/custom-requests.css`. **Paying for a custom order:** accepting a quote (or "Add delivery and pay" on a request the shop accepted) asks for delivery details. It then creates a normal order (`customRequest: ref`, one `custom:<ref>` item at the quoted price incl. GST, plus the zone's delivery fee), saves `orderRef` on the request, and goes to `payment.html`. From there it's the usual bank transfer, slip upload and staff verification. If that order is cancelled, the customer can pay again. Reopening an accepted request in the portal cancels its unpaid order, and is blocked once the customer has paid. Requests are matched by account, email (case-insensitive) or the last 7 digits of the phone number, so requests sent as a guest show up too. The section is always visible and has an empty state. Changing the account email carries requests over (`onEmailChange` in auth.js). The status reads Received / Quote ready / Accepted / Declined, with the quote, the shop's message, a decline reason if there is one, and **Accept quote / Decline** buttons with an inline confirm while a request is quoted. A customer's answer is saved with `history[].byCustomer`. After a signed-in customer sends a request, the Custom orders page links to "Follow your request". Reference photos are kept in IndexedDB like transfer slips and show as thumbnails.

**Roles:** permissions per area (dashboard, orders, requests, customers, products, expenses, settings, team) set to none, view or manage. Owner is locked to full access. Defaults: Manager, Sales & orders, Accounts. "Add team member" can create a new role on the spot ("+ Create a new role…": name + "Start with the access of" another role, or no access), then offers "Set what this role can see". View-only roles have `[data-manage]` controls hidden (`body.is-view-only`). The first sign-in creates the owner account.

**Store profile** (`js/store-settings.js` → `VIULHI.store`, saved to `viulhi-settings`) drives the storefront live:
- Name, tagline, logo
- The four brand colours (applied early by `theme.js`)
- Contact methods and socials (footer)
- Address (can be hidden) and business details (legal name, registration, GST TIN, for invoices)
- Bank accounts (payment page; "Show at checkout")
- Delivery areas and fees (the `islands` area can't be removed)
- GST rate and incl./excl. display

**Expenses:** types Expense (paid now), Bill (supplier invoice, due date, Unpaid/Paid/Overdue) and Reimbursement (paid by a team member, Owed/Reimbursed). Amounts are entered as the total with an "Includes 8% GST" switch, and the GST paid is worked out and shown. Categories have icons. Period, category, status and type filters; category breakdown; CSV export.

**Prototype data:** products (`viulhi-products`), orders, expenses (`viulhi-expenses`), roles (`viulhi-roles`), staff (`viulhi-staff`) and activity (`viulhi-activity`) are all localStorage. Product photos are resized in the browser to a data URL. Transfer slips are kept in IndexedDB (`viulhi-files`, `js/file-store.js`, `VIULHI.files`), and the order saves `payment.slip.fileId`. The order page shows the slip (image preview or embedded PDF, with Open and Download) next to Verify / Reject. It only works when the customer and staff use the same browser, and older slips show a "not saved in this browser" note. Rejecting a slip deletes its file. Expense receipts keep metadata only. The dashboard's **Load / Remove sample data** adds records marked `demo: true`. Everything moves to a server before launch.

**Paths:** portal pages are one folder down, so they link `../css/…` and `../js/…`, and product images go through `VIULHI.assetUrl()` (`V.assetBase = "../"`). The version tag rule covers these paths too.

**POS (later):** large tap targets (min 56px), high-contrast totals, GST breakdown always visible.

Add any new shared component to `components.css` and document it here.
