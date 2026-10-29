// Sample catalog. Placeholder data until the database exists. Edits made in the admin portal
// are saved to localStorage "viulhi-products" / "viulhi-categories" and replace these lists.
// price = before GST (see config.js). compareAt = old price before GST, for sale items.
// stock = units available (0 = sold out). sold = units sold so far.
// Photos: free stock photos from Pexels (pexels.com/photo/<photo id>), used as placeholders.
// Replace them with photos of your own pieces before launch.

window.VIULHI_CATEGORIES = [
  { slug: "amigurumi", name: "Amigurumi",       icon: "hgi-smile" },
  { slug: "bags",      name: "Bags & Totes",    icon: "hgi-shopping-bag-01" },
  { slug: "wearables", name: "Wearables",       icon: "hgi-t-shirt" },
  { slug: "home",      name: "Home Décor",      icon: "hgi-sofa-01" },
  { slug: "baby",      name: "Baby & Kids",     icon: "hgi-baby-01" },
  { slug: "supplies",  name: "Yarn & Supplies", icon: "hgi-scissor-01" }
];

window.VIULHI_PRODUCTS = [
  { id: "p01", name: "Rosie Bunny Amigurumi",   category: "amigurumi", price: 320, badge: "Bestseller", featured: true, stock: 12, sold: 214, added: "2026-09-02", image: "images/products/p01.jpg", photo: 31454485 },
  { id: "p02", name: "Island Market Mesh Bag",  category: "bags",      price: 280,                         featured: true, stock: 18, sold: 167, added: "2026-09-10", image: "images/products/p02.jpg", photo: 2557040 },
  { id: "p03", name: "Mango Slouch Beanie",     category: "wearables", price: 220, compareAt: 260,         featured: true, stock: 7,  sold: 98,  added: "2026-08-21", image: "images/products/p03.jpg", photo: 39798660 },
  { id: "p04", name: "Lagoon Coaster Set of 2", category: "home",      price: 120,                         featured: true, stock: 25, sold: 143, added: "2026-08-14", image: "images/products/p04.jpg", photo: 36644649 },
  { id: "p05", name: "Sleepy Bunny Comforter",  category: "baby",      price: 290, badge: "New",                           stock: 6,  sold: 12,  added: "2026-10-18", image: "images/products/p05.jpg", photo: 2731820 },
  { id: "p06", name: "Daisy Crossbody Bag",     category: "bags",      price: 420, badge: "New",                           stock: 9,  sold: 21,  added: "2026-10-15", image: "images/products/p06.jpg", photo: 30859912 },
  { id: "p07", name: "Milk Cotton Yarn, Peach", category: "supplies",  price: 45,                                          stock: 120, sold: 486, added: "2026-10-12", image: "images/products/p07.jpg", photo: 18415036 },
  { id: "p08", name: "Aluminium Hook Set",      category: "supplies",  price: 260, compareAt: 300,                         stock: 15, sold: 77,  added: "2026-10-08", image: "images/products/p08.jpg", photo: 3639038 },
  { id: "p09", name: "Mango the Cat",           category: "amigurumi", price: 280,                                         stock: 4,  sold: 63,  added: "2026-09-20", image: "images/products/p09.jpg", photo: 38724016 },
  { id: "p10", name: "Daisy Kitty Doll",        category: "amigurumi", price: 300,                                         stock: 8,  sold: 51,  added: "2026-09-05", image: "images/products/p10.jpg", photo: 38664135 },
  { id: "p11", name: "Lavender Teddy",          category: "baby",      price: 310, badge: "New",                           stock: 5,  sold: 9,   added: "2026-10-20", image: "images/products/p11.jpg", photo: 7738663 },
  { id: "p12", name: "Granny Square Backpack",  category: "bags",      price: 650,                                         stock: 0,  sold: 34,  added: "2026-07-30", image: "images/products/p12.jpg", photo: 33853684 },
  { id: "p13", name: "Peach Ombre Throw",       category: "home",      price: 890, badge: "Bestseller",                    stock: 3,  sold: 58,  added: "2026-08-02", image: "images/products/p13.jpg", photo: 6216236 },
  { id: "p14", name: "Coral Flower Coasters",   category: "home",      price: 150,                                         stock: 22, sold: 88,  added: "2026-09-28", image: "images/products/p14.jpg", photo: 39634663 },
  { id: "p15", name: "Pastel Cotton Yarn Pack", category: "supplies",  price: 180,                                         stock: 40, sold: 152, added: "2026-09-15", image: "images/products/p15.jpg", photo: 6905162 },
  { id: "p16", name: "Bloom Sun Hat",           category: "wearables", price: 260,                                         stock: 10, sold: 46,  added: "2026-09-25", image: "images/products/p16.jpg", photo: 1750028 },
  { id: "p17", name: "Biscuit the Pup",         category: "amigurumi", price: 260,                                         stock: 11, sold: 72,  added: "2026-09-12", image: "images/products/p17.jpg", photo: 38736394 },
  { id: "p18", name: "Cocoa Bucket Hat",        category: "wearables", price: 240, compareAt: 290,                         stock: 6,  sold: 39,  added: "2026-08-28", image: "images/products/p18.jpg", photo: 10201057 },
  { id: "p19", name: "Blossom Bear",            category: "amigurumi", price: 340, badge: "New",                           stock: 9,  sold: 18,  added: "2026-10-22", image: "images/products/p19.jpg", photo: 12109904 }
];

// Use the admin portal's saved catalog if there is one. The shop only sees published
// products (status "draft" is hidden); the portal uses VIULHI_ALL_PRODUCTS.
(function () {
  try {
    var products = JSON.parse(localStorage.getItem("viulhi-products"));
    if (Array.isArray(products)) window.VIULHI_PRODUCTS = products;
    var cats = JSON.parse(localStorage.getItem("viulhi-categories"));
    if (Array.isArray(cats) && cats.length) window.VIULHI_CATEGORIES = cats;
  } catch (e) {}
  window.VIULHI_ALL_PRODUCTS = window.VIULHI_PRODUCTS;
  window.VIULHI_PRODUCTS = window.VIULHI_ALL_PRODUCTS.filter(function (p) { return p.status !== "draft"; });
})();
