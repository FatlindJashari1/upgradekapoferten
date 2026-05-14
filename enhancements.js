
(() => {
  const DB = {
    orders: "ko_orders",
    payments: "ko_payments",
    reviews: "ko_reviews",
    chat: "ko_chat",
    moderators: "ko_moderators",
    likes: "ko_likes",
    ledger: "ko_ledger",
    unread: "ko_unread_chat",
    staffSession: "ko_staff_session",
    audit: "ko_audit",
    moderatorRatings: "ko_moderator_ratings"
  };

  const categories = [
    "Elektronikë", "TV & Audio", "Kamera", "Smart Home", "Drone", "Pajisje Elektronike të Vogla",
    "Telefona & Aksesorë", "iPhone", "Samsung", "Mbushës & Kabllo", "Kompjuterë & Gaming",
    "Laptopë", "PC Desktop", "Gaming Console", "Moda & Veshje", "Shtëpi & Dekor",
    "Automjete & Pjesë", "Shëndet & Bukuri", "Sport & Outdoor", "Produkte për Fëmijë",
    "Vegla & Pajisje Pune", "Të Përdorura"
  ];

  const STAFF_USERS = {
    arbnor: { password: "kapoferten2026", role: "admin", label: "Arbnor" },
    saim: { password: "moderator2026", role: "moderator", label: "Saim" },
    fatlind: { password: "moderator2026", role: "moderator", label: "Fatlind" }
  };

  const channel = "BroadcastChannel" in window ? new BroadcastChannel("kapoferten-live") : null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const read = (key, fallback = []) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    channel?.postMessage({ key });
  };

  function seed() {
    if (!localStorage.getItem(DB.moderators)) write(DB.moderators, ["Saim", "Fatlind"]);
    if (!localStorage.getItem(DB.reviews)) {
      write(DB.reviews, [
        { product: "Emri i Produktit", name: "Arben L.", rating: 5, comment: "Porosia u konfirmua shpejt.", ts: Date.now() - 500000 },
        { product: "Emri i Produktit", name: "Elira M.", rating: 5, comment: "Komunikim korrekt dhe faqe e qartë.", ts: Date.now() - 300000 }
      ]);
    }
    if (!localStorage.getItem(DB.chat)) {
      write(DB.chat, [{ sender: "moderator", name: "Moderator", text: "Përshëndetje! Si mund t'ju ndihmojmë?", ts: Date.now() }]);
    }
  }

  function toast(message) {
    const box = $("[data-toast]");
    if (!box) return;
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove("show"), 2600);
  }

  function openModal(name) {
    const modal = $(`[data-modal="${name}"]`);
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");
  }

  function closeModal(name) {
    const modal = $(`[data-modal="${name}"]`);
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
  }

  function enhanceProducts() {
    $$(".product-card").forEach((card, index) => {
      const title = $("h3", card)?.textContent?.trim() || `Produkt ${index + 1}`;
      const info = $(".product-info", card);
      if (info && !$(".stock-note", info)) {
        card.dataset.stock = "missing";
        const note = document.createElement("p");
        note.className = "stock-note";
        note.textContent = "Për momentin mungon në stock. Lë porosinë dhe ekipi të lajmëron sapo të konfirmohet.";
        info.insertBefore(note, $(".order-btn", info));
      }
      if (info && !$(".product-actions-extra", info)) {
        const wrap = document.createElement("div");
        wrap.className = "product-actions-extra";
        wrap.innerHTML = `<button class="mini-action" type="button" data-review-product="${title}">Komento</button><button class="mini-action" type="button" data-share-product="${title}">Shpërnda</button>`;
        info.appendChild(wrap);
      }
      $(".order-btn", card)?.addEventListener("click", () => {
        $("[data-order-title]").textContent = title;
        $(".order-form").dataset.product = title;
        openModal("order");
      });
      $(".heart", card)?.addEventListener("click", (event) => {
        const likes = read(DB.likes, {});
        likes[title] = (likes[title] || 0) + 1;
        write(DB.likes, likes);
        event.currentTarget.textContent = "♥";
        toast(`Produkti u pëlqye (${likes[title]})`);
        renderAdmin();
      });
    });
  }

  function bindNavigation() {
    const nav = $("[data-nav]");
    if (nav && !nav.querySelector('[href="#kategorite"]')) {
      const link = document.createElement("a");
      link.href = "#kategorite";
      link.textContent = "Kategoritë";
      nav.insertBefore(link, nav.querySelector('[href="#rreth-nesh"]'));
    }
    // Paneli i stafit hapet vetëm me #admin ose duke shtypur "admin"; nuk shfaqet në navbar për klientët.
    $(".icon-btn")?.addEventListener("click", () => openModal("search"));
    $(".cart-btn")?.addEventListener("click", () => {
      toast("Shporta do të lidhet me checkout kur të shtohen produktet reale.");
    });
    $(".view-all")?.addEventListener("click", (event) => {
      if (!event.currentTarget.dataset.action) {
        event.preventDefault();
        $("#kategorite")?.scrollIntoView({ behavior: "smooth" });
      }
    });
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close]");
      if (close) closeModal(close.dataset.close);
      if (event.target.closest("[data-staff-entry]")) openAdmin();
    });

    let adminKeys = "";
    document.addEventListener("keydown", (event) => {
      adminKeys = (adminKeys + event.key.toLowerCase()).slice(-5);
      if (adminKeys === "admin") openAdmin();
    });

    if (location.hash === "#admin") {
      history.replaceState(null, "", location.pathname + location.search);
      setTimeout(openAdmin, 300);
    }
  }

  function bindCategories() {
    $$(".category-card button").forEach((button) => {
      button.addEventListener("click", () => button.closest(".category-card")?.classList.toggle("open"));
    });
  }

  function bindSearch() {
    const input = $("[data-search-input]");
    const results = $("[data-search-results]");
    if (!input || !results) return;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const matches = categories.filter((item) => item.toLowerCase().includes(q)).slice(0, 8);
      results.innerHTML = (q ? matches : categories.slice(0, 8)).map((item) => `<button type="button" data-result="${item}">${item}</button>`).join("");
    };
    input.addEventListener("input", render);
    results.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      toast(`Kategoria "${button.dataset.result}" u zgjodh.`);
      closeModal("search");
      $("#ofertat")?.scrollIntoView({ behavior: "smooth" });
    });
    render();
  }

  function bindForms() {
    $(".order-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const chosenModerator = data.moderator === "auto" ? "saim" : data.moderator;
      const tipAmount = data.tip === "custom" ? 0 : Number(data.tip || 0);
      const order = { id: `KO-${Date.now()}`, product: form.dataset.product || "Produkt", ...data, moderator: chosenModerator, tip: tipAmount, status: "Në pritje", stock: "mungon", ts: Date.now() };
      const orders = read(DB.orders);
      const payments = read(DB.payments);
      const ledger = read(DB.ledger);
      orders.unshift(order);
      payments.unshift({ id: order.id, product: order.product, method: data.payment, amount: "0.00 €", tip: tipAmount, moderator: chosenModerator, status: data.payment.includes("crypto") ? "Crypto në pritje" : "Në pritje", ts: order.ts });
      ledger.unshift({ id: order.id, type: "hyrje", description: `Porosi: ${order.product}`, amount: tipAmount, method: data.payment, moderator: chosenModerator, ts: order.ts });
      write(DB.orders, orders);
      write(DB.payments, payments);
      write(DB.ledger, ledger);
      form.reset();
      closeModal("order");
      addAudit(`Porosi e re për ${order.product}; moderator: ${chosenModerator.toUpperCase()}`);
      channel?.postMessage({ key: DB.orders, moderator: chosenModerator, text: "Porosi e re" });
      toast("Porosia u regjistrua. Moderatori u njoftua automatikisht.");
      renderAdmin();
    });

    $(".contact-form")?.addEventListener("submit", () => {
      toast("Mesazhi u ruajt. Ekipi do të përgjigjet së shpejti.");
    });

    document.addEventListener("click", (event) => {
      const reviewBtn = event.target.closest("[data-review-product]");
      if (reviewBtn) {
        const name = prompt("Emri për vlerësim:");
        if (!name) return;
        const comment = prompt("Komenti:");
        if (!comment) return;
        const reviews = read(DB.reviews);
        reviews.unshift({ product: reviewBtn.dataset.reviewProduct, name, rating: 5, comment, ts: Date.now() });
        write(DB.reviews, reviews);
        toast("Vlerësimi u shtua.");
        renderAdmin();
        return;
      }

      const shareBtn = event.target.closest("[data-share-product]");
      if (shareBtn) {
        const title = shareBtn.dataset.shareProduct;
        const payload = { title: "KapOfertën", text: `Shiko ofertën: ${title}`, url: location.href.split("#")[0] };
        if (navigator.share) {
          navigator.share(payload).catch(() => toast("Shpërndarja u anulua."));
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(`${payload.text} - ${payload.url}`).then(() => toast("Linku u kopjua."));
        } else {
          toast("Kopjo linkun nga shiriti i browser-it.");
        }
        return;
      }
    });

    document.addEventListener("click", (event) => {
      const deadLink = event.target.closest('a[href="#"]');
      if (!deadLink) return;
      event.preventDefault();
      toast("Ky link do të lidhet me profilin real kur të hapen rrjetet sociale.");
    });
  }

  function staffSession() {
    return read(DB.staffSession, null);
  }

  function setStaffSession(session) {
    localStorage.setItem(DB.staffSession, JSON.stringify(session));
  }

  function addAudit(message) {
    const audit = read(DB.audit);
    audit.unshift({ message, ts: Date.now(), user: staffSession()?.label || "system" });
    write(DB.audit, audit.slice(0, 80));
  }

  function openAdmin() {
    if (location.hash === "#admin") {
      history.replaceState(null, "", location.pathname + location.search);
    }
    const session = staffSession();
    if (!session) {
      openModal("staff-login");
      return;
    }
    const panel = $("[data-admin-panel]");
    panel?.classList.add("open");
    panel?.setAttribute("aria-hidden", "false");
    renderAdmin();
  }

  function closeAdmin() {
    const panel = $("[data-admin-panel]");
    panel?.classList.remove("open");
    panel?.setAttribute("aria-hidden", "true");
  }

  function switchAdminTab(name) {
    $$(".admin-sidebar nav button").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === name));
    $$(".admin-view").forEach((view) => view.classList.toggle("active", view.dataset.adminView === name));
    renderAdmin();
  }

  function role() {
    return staffSession()?.role || "guest";
  }

  function renderAdmin() {
    const orders = read(DB.orders);
    const payments = read(DB.payments);
    const ledger = read(DB.ledger);
    const reviews = read(DB.reviews);
    const ratings = read(DB.moderatorRatings);
    const likes = read(DB.likes, {});
    const moderators = read(DB.moderators);
    const chats = read(DB.chat);
    const audit = read(DB.audit);
    const likesTotal = Object.values(likes).reduce((sum, n) => sum + Number(n || 0), 0);
    const session = staffSession();
    const currentRole = role();
    const panel = $("[data-admin-panel]");
    panel?.classList.toggle("is-admin", currentRole === "admin");
    panel?.classList.toggle("is-moderator", currentRole === "moderator");

    const sessionBox = $("[data-staff-session]");
    if (sessionBox) {
      sessionBox.innerHTML = session ? `<strong>${session.label}</strong><span>${session.role === "admin" ? "Admin kryesor" : "Moderator teknik"}</span>` : "";
    }

    const stats = $("[data-admin-stats]");
    if (stats) {
      stats.innerHTML = [
        ["Porosi aktive", orders.length],
        ["Pagesa", payments.length],
        ["Chat mesazhe", chats.length],
        ["Feedback", reviews.length + likesTotal]
      ].map(([label, value]) => `<div class="admin-stat">${label}<strong>${value}</strong></div>`).join("");
    }

    const ordersTable = $("[data-orders-table]");
    if (ordersTable) {
      const visibleOrders = currentRole === "admin" ? orders : orders.filter((o) => (o.moderator || "").toLowerCase() === (session?.username || "").toLowerCase());
      ordersTable.innerHTML = visibleOrders.length
        ? `<table><thead><tr><th>ID</th><th>Produkt</th><th>Klient</th><th>Pagesa</th><th>Moderator</th><th>Status</th></tr></thead><tbody>${visibleOrders.map((o) => `<tr><td>${o.id}</td><td>${o.product}</td><td>${o.name || "-"}<br><small>${o.phone || ""}</small></td><td>${o.payment || "-"}<br><small>Tips: ${Number(o.tip || 0).toFixed(2)} €</small></td><td>${(o.moderator || "-").toUpperCase()}</td><td>${o.status}</td></tr>`).join("")}</tbody></table>`
        : `<div class="admin-row">Ende nuk ka porosi për këtë rol.</div>`;
    }

    const paymentsList = $("[data-payments-list]");
    const ledgerList = $("[data-ledger-list]");
    const ledgerSummary = $("[data-ledger-summary]");
    const ledgerForm = $("[data-ledger-form]");
    const income = ledger.filter((item) => item.type === "hyrje").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = ledger.filter((item) => item.type === "dalje").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (ledgerSummary) {
      ledgerSummary.innerHTML = currentRole !== "admin"
        ? `<div class="admin-locked">Pagesat, hyrjet dhe daljet i sheh vetëm admini.</div>`
        : `<div class="admin-stat">Hyrje<strong>${income.toFixed(2)} €</strong></div><div class="admin-stat">Dalje<strong>${expense.toFixed(2)} €</strong></div><div class="admin-stat">Bilanci<strong>${(income - expense).toFixed(2)} €</strong></div>`;
    }
    if (ledgerForm) ledgerForm.hidden = currentRole !== "admin";
    if (paymentsList) {
      paymentsList.innerHTML = currentRole !== "admin"
        ? ""
        : (payments.length ? payments.map((p) => `<div class="admin-row"><b>${p.id}</b> · ${p.product}<small>${p.method} · ${p.status} · moderator: ${(p.moderator || "-").toUpperCase()} · tips: ${Number(p.tip || 0).toFixed(2)} €</small></div>`).join("") : `<div class="admin-row">Ende nuk ka pagesa.</div>`);
    }
    if (ledgerList) {
      ledgerList.innerHTML = currentRole !== "admin"
        ? ""
        : (ledger.length ? ledger.map((item) => `<div class="admin-row ledger-${item.type}"><b>${item.type.toUpperCase()}</b> · ${item.description}<small>${Number(item.amount || 0).toFixed(2)} € · ${item.method || "manual"} · ${item.moderator ? "moderator: " + item.moderator.toUpperCase() + " · " : ""}${new Date(item.ts).toLocaleString()}</small></div>`).join("") : `<div class="admin-row">Ende nuk ka hyrje/dalje.</div>`);
    }

    const modList = $("[data-moderator-list]");
    const modForm = $("[data-moderator-form]");
    if (modForm) modForm.hidden = currentRole !== "admin";
    if (modList) {
      modList.innerHTML = currentRole !== "admin"
        ? `<div class="admin-locked">Moderatorët nuk menaxhojnë staf. Ata kontrollojnë porositë e tyre, chat-in dhe ndihmën teknike.</div>`
        : moderators.map((m) => `<div class="admin-row"><b>${m}</b><small>Moderator teknik: chat, ndihmë për klientë, komente dhe porosi të caktuara.</small></div>`).join("");
    }

    const modRatings = $("[data-moderator-ratings]");
    if (modRatings) {
      modRatings.innerHTML = ratings.length
        ? ratings.map((r) => `<div class="admin-row"><b>${r.moderator.toUpperCase()}</b><small>${"★".repeat(r.rating)} · ${r.note || "Vlerësim nga klienti"} · ${new Date(r.ts).toLocaleString()}</small></div>`).join("")
        : `<div class="admin-row">Ende nuk ka vlerësime për moderatorët.</div>`;
    }

    const feedback = $("[data-feedback-list]");
    if (feedback) {
      const likeRows = Object.entries(likes).map(([product, count]) => `<div class="admin-row"><b>${product}</b><small>${count} pëlqime</small></div>`);
      const reviewRows = reviews.map((r) => `<div class="admin-row"><b>${r.name}</b> · ${r.product}<small>${"★".repeat(r.rating)} · ${r.comment}</small></div>`);
      feedback.innerHTML = [...likeRows, ...reviewRows].join("") || `<div class="admin-row">Ende nuk ka feedback.</div>`;
    }

    const auditList = $("[data-audit-list]");
    if (auditList) {
      auditList.innerHTML = currentRole === "admin"
        ? (audit.length ? audit.map((a) => `<div class="admin-row"><b>${a.user}</b><small>${a.message} · ${new Date(a.ts).toLocaleString()}</small></div>`).join("") : `<div class="admin-row">Ende nuk ka aktivitet.</div>`)
        : "";
    }

    const chatForm = $("[data-admin-chat-form]");
    const chatNote = $("[data-admin-chat-note]");
    if (chatForm) chatForm.hidden = currentRole !== "moderator";
    if (chatNote) {
      chatNote.textContent = currentRole === "admin"
        ? "Admini menaxhon faqen, pagesat, databazën dhe moderatorët. Përgjigjet klientëve bëhen nga Saim/Fatlind."
        : `Je kyçur si ${session?.label}. Përgjigju klientëve që kanë zgjedhur moderatorin tënd.`;
    }
    const visibleChats = currentRole === "admin" ? chats : chats.filter((m) => !m.moderator || m.moderator === session?.username || m.sender === "moderator");
    renderChat($("[data-admin-chat]"), visibleChats);
    renderChat($("[data-client-chat]"), chats);
  }

  function renderChat(container, messages) {
    if (!container) return;
    container.innerHTML = messages.map((m) => `<div class="chat-message ${m.sender}"><small>${m.name || m.sender} · ${new Date(m.ts).toLocaleTimeString()}</small>${m.text}</div>`).join("");
    container.scrollTop = container.scrollHeight;
  }

  function sendChat(sender, text) {
    const messages = read(DB.chat);
    const selectedModerator = $("[data-client-moderator]")?.value || "saim";
    const session = staffSession();
    messages.push({ sender, name: sender === "client" ? "Klient" : (session?.label || "Moderator"), moderator: sender === "client" ? selectedModerator : session?.username, text, ts: Date.now() });
    write(DB.chat, messages);
    if (sender === "client") {
      write(DB.unread, Number(localStorage.getItem(DB.unread) || 0) + 1);
      channel?.postMessage({ key: DB.chat, sender, text });
    }
    renderAdmin();
  }

  function bindAdminAndChat() {
    $("[data-admin-close]")?.addEventListener("click", closeAdmin);
    $$(".admin-sidebar nav button").forEach((button) => button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab)));
    $("[data-staff-logout]")?.addEventListener("click", () => {
      localStorage.removeItem(DB.staffSession);
      closeAdmin();
      toast("Dole nga paneli i stafit.");
    });
    $("[data-staff-login-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const username = String(data.username || "").trim().toLowerCase();
      const user = STAFF_USERS[username];
      if (!user || user.password !== data.password) {
        toast("Login i pasaktë.");
        return;
      }
      setStaffSession({ username, role: user.role, label: user.label, ts: Date.now() });
      closeModal("staff-login");
      addAudit(`${user.label} hyri në panel`);
      event.currentTarget.reset();
      openAdmin();
      toast(`Mirë se erdhe, ${user.label}.`);
    });
    $("[data-client-moderator]")?.addEventListener("change", (event) => {
      const label = event.currentTarget.value === "auto" ? "automatik" : event.currentTarget.options[event.currentTarget.selectedIndex].text;
      const target = $("[data-selected-moderator]");
      if (target) target.textContent = `Moderator: ${label}`;
    });
    document.addEventListener("click", (event) => {
      const rate = event.target.closest("[data-rate-moderator]");
      if (!rate) return;
      const moderator = $("[data-client-moderator]")?.value || "saim";
      const ratings = read(DB.moderatorRatings);
      ratings.unshift({ moderator: moderator === "auto" ? "saim" : moderator, rating: Number(rate.dataset.rateModerator), ts: Date.now() });
      write(DB.moderatorRatings, ratings);
      toast("Faleminderit për vlerësimin e moderatorit.");
      renderAdmin();
    });
    $("[data-moderator-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (role() !== "admin") return toast("Vetëm admini mund të menaxhojë moderatorë.");
      const input = event.currentTarget.elements.name;
      const moderators = read(DB.moderators);
      moderators.push(input.value.trim());
      write(DB.moderators, moderators);
      addAudit(`U shtua moderatori ${input.value.trim()}`);
      input.value = "";
      renderAdmin();
      toast("Moderatori u shtua nga admini.");
    });
    $("[data-ledger-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (role() !== "admin") return toast("Vetëm admini mund të regjistrojë hyrje/dalje.");
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const ledger = read(DB.ledger);
      ledger.unshift({ id: `OUT-${Date.now()}`, type: "dalje", description: data.description, amount: Number(String(data.amount).replace(",", ".")) || 0, method: "manual", ts: Date.now() });
      write(DB.ledger, ledger);
      addAudit(`Dalje e regjistruar: ${data.description}`);
      form.reset();
      renderAdmin();
      toast("Dalja u regjistrua në databazën lokale.");
    });
    $("[data-client-chat-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.message;
      sendChat("client", input.value.trim());
      input.value = "";
      toast("Mesazhi shkoi te moderatori i zgjedhur.");
    });
    $("[data-admin-chat-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (role() !== "moderator") return toast("Vetëm moderatorët mund t'u përgjigjen klientëve.");
      const input = event.currentTarget.elements.message;
      sendChat("moderator", input.value.trim());
      input.value = "";
    });
  }

  function liveSync() {
    channel?.addEventListener("message", (event) => {
      renderAdmin();
      if ((event.data?.key === DB.chat || event.data?.key === DB.orders) && role() === "moderator") {
        const session = staffSession();
        if (!event.data?.moderator || event.data.moderator === session?.username || event.data.moderator === "auto") {
          toast(event.data?.key === DB.orders ? "Porosi e re për moderatorin." : "Mesazh i ri nga klienti.");
        }
      }
    });
    window.addEventListener("storage", (event) => {
      renderAdmin();
      if (event.key === DB.chat && role() === "moderator") toast("Mesazh i ri nga klienti.");
    });
    setInterval(renderAdmin, 1500);
  }

  document.addEventListener("DOMContentLoaded", () => {
    seed();
    enhanceProducts();
    bindNavigation();
    bindCategories();
    bindSearch();
    bindForms();
    bindAdminAndChat();
    liveSync();
    renderAdmin();
  });
})();
