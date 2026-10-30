/* Web feedback form for Khakichimp app pages.
 *
 * Posts to feedback-relay (jengels34/feedback-relay), the same Cloudflare
 * Worker the apps use, which files a GitHub issue labelled source:web. Unlike
 * the in-app form it sends no device details and keeps no status token, so a
 * web submitter gets no updates. Hearing back needs the in-app form.
 *
 * Mount it with an element per form; all config lives in data attributes so
 * each app's page can reuse this file:
 *   data-feedback          marks the mount point
 *   data-relay             the relay's https origin, e.g. https://feedback-relay.example.workers.dev
 *   data-app-key           a web key from the relay's APPS ("web": true). Not a secret.
 *   data-sitekey           the Turnstile widget's site key. Public.
 *   data-app               the app's display name, for copy
 *   data-privacy           link to the page's web-feedback disclosure
 * Leave data-relay, data-app-key or data-sitekey empty and the form shows an
 * email fallback instead.
 */
(() => {
    // Mirrors validate.ts in feedback-relay. The relay re-validates; these only
    // save a round trip and let the counters say the same thing.
    const TITLE_MIN = 4, TITLE_MAX = 120, BODY_MAX = 5000;
    const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const TOKEN_WAIT_MS = 15000;
    const REQUEST_TIMEOUT_MS = 20000;
    const CONTACT = "khakichimp" + "@" + "gmail.com";

    const KINDS = {
        bug:   { label: "Bug",   icon: "🐞", title: "What went wrong?",     body: "What you did, what you expected, and what happened instead. Your iOS version helps too." },
        idea:  { label: "Idea",  icon: "💡", title: "What's your idea?",    body: "What would it help you do?" },
        other: { label: "Other", icon: "💬", title: "What's on your mind?", body: "Tell us anything." },
    };

    /** Length in code points, as the relay counts it. */
    const len = (s) => [...s].length;
    let turnstileLoad;
    let uid = 0;

    document.querySelectorAll("[data-feedback]").forEach(mount);

    function mount(root) {
        const cfg = {
            relay: (root.dataset.relay || "").trim().replace(/\/+$/, ""),
            key: (root.dataset.appKey || "").trim(),
            sitekey: (root.dataset.sitekey || "").trim(),
            app: root.dataset.app || "the app",
            privacy: root.dataset.privacy || "",
        };
        if (!/^https:\/\/[^/]+$/.test(cfg.relay) || !cfg.key || !cfg.sitekey) {
            root.innerHTML = fallback(cfg);
            return;
        }
        const id = "fb" + (++uid);
        root.innerHTML = template(id, cfg);

        const form = root.querySelector(".fb-form");
        const done = root.querySelector(".fb-done");
        const status = root.querySelector(".fb-status");
        const send = root.querySelector(".fb-send");
        const f = {
            title: form.elements.title,
            body: form.elements.body,
            trap: form.elements.website,
        };
        const draftKey = "fb-draft:" + location.pathname;
        let token = null, tokenWaiters = [], widget = null, busy = false;

        /* ---------- Draft: survive a reload (per viewer, best effort) ---------- */
        try {
            const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
            if (saved) {
                if (KINDS[saved.kind]) form.querySelector(`input[name="kind"][value="${saved.kind}"]`).checked = true;
                f.title.value = saved.title || "";
                f.body.value = saved.body || "";
            }
        } catch { /* storage blocked: start empty */ }
        const saveDraft = () => {
            try {
                sessionStorage.setItem(draftKey, JSON.stringify({ kind: kind(), title: f.title.value, body: f.body.value }));
            } catch { /* ignore */ }
        };
        const clearDraft = () => { try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } };

        /* ---------- Kind, counters, inline validation ---------- */
        const kind = () => form.querySelector('input[name="kind"]:checked').value;
        const applyKind = () => {
            const k = KINDS[kind()];
            f.title.placeholder = k.title;
            f.body.placeholder = k.body;
        };
        const counter = (el, max) => {
            const out = root.querySelector(`#${el.id}-count`);
            const n = len(el.value.trim());
            out.textContent = `${n} / ${max}`;
            out.classList.toggle("over", n > max);
        };
        const problems = () => {
            const t = len(f.title.value.trim()), b = len(f.body.value.trim());
            return {
                title: t < TITLE_MIN ? `Add a title of at least ${TITLE_MIN} characters.` : t > TITLE_MAX ? `Keep the title under ${TITLE_MAX + 1} characters.` : "",
                body: b > BODY_MAX ? `Keep the details under ${BODY_MAX + 1} characters.` : "",
            };
        };
        const showProblem = (name, msg) => {
            f[name].setAttribute("aria-invalid", msg ? "true" : "false");
            root.querySelector(`#${f[name].id}-err`).textContent = msg;
        };
        const touched = new Set();
        const refresh = () => {
            counter(f.title, TITLE_MAX);
            counter(f.body, BODY_MAX);
            const p = problems();
            touched.forEach((name) => showProblem(name, p[name]));
        };
        ["title", "body"].forEach((name) => {
            f[name].addEventListener("input", () => { refresh(); saveDraft(); });
            f[name].addEventListener("blur", () => { if (f[name].value) touched.add(name); refresh(); });
        });
        form.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener("change", () => { applyKind(); saveDraft(); }));
        applyKind();
        refresh();

        /* ---------- Turnstile: load when the form comes near, run invisibly ---------- */
        const settleToken = (value) => {
            token = value;
            if (value) { tokenWaiters.forEach((w) => w.resolve(value)); tokenWaiters = []; }
        };
        const startTurnstile = () => {
            if (widget !== null) return;
            widget = "loading";
            loadTurnstile().then((ts) => {
                widget = ts.render(root.querySelector(".fb-turnstile"), {
                    sitekey: cfg.sitekey,
                    appearance: "interaction-only",
                    theme: "light",
                    action: "feedback",
                    callback: settleToken,
                    "expired-callback": () => settleToken(null),
                    "error-callback": () => { settleToken(null); },
                });
            }).catch(() => {
                widget = "failed";
                tokenWaiters.forEach((w) => w.reject(new Error("turnstile")));
                tokenWaiters = [];
            });
        };
        const nextToken = () => {
            if (token) return Promise.resolve(token);
            if (widget === "failed") widget = null; // the script may load on a retry
            const waiting = new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("turnstile")), TOKEN_WAIT_MS);
                tokenWaiters.push({
                    resolve: (t) => { clearTimeout(timer); resolve(t); },
                    reject: (e) => { clearTimeout(timer); reject(e); },
                });
            });
            startTurnstile();
            return waiting;
        };
        const spendToken = () => {
            token = null;
            if (window.turnstile && typeof widget === "string" && widget !== "loading" && widget !== "failed") {
                window.turnstile.reset(widget);
            }
        };
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                if (entries.some((e) => e.isIntersecting)) { io.disconnect(); startTurnstile(); }
            }, { rootMargin: "600px 0px" });
            io.observe(root);
        }
        form.addEventListener("focusin", startTurnstile, { once: true });

        /* ---------- Submit ---------- */
        const say = (msg, tone = "error") => {
            status.hidden = !msg;
            status.textContent = msg;
            status.dataset.tone = tone;
        };
        const setBusy = (on, label) => {
            busy = on;
            send.disabled = on;
            send.setAttribute("aria-busy", on ? "true" : "false");
            send.querySelector(".fb-send-label").textContent = label;
        };
        const finish = () => {
            clearDraft();
            form.reset();
            applyKind();
            touched.clear();
            refresh();
            form.hidden = true;
            done.hidden = false;
            done.focus();
        };

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (busy) return;
            say("");
            ["title", "body"].forEach((n) => touched.add(n));
            refresh();
            const p = problems();
            const first = ["title", "body"].find((n) => p[n]);
            if (first) { f[first].focus(); return; }

            // A filled honeypot means a bot. Look successful, send nothing.
            if (f.trap.value) { finish(); return; }

            setBusy(true, "Checking…");
            let turnstileToken;
            try {
                turnstileToken = await nextToken();
            } catch {
                setBusy(false, "Send feedback");
                say(widget === "failed"
                    ? `The spam check couldn't load. If you use a content blocker, allow challenges.cloudflare.com for this page, or email ${CONTACT}.`
                    : "The spam check is taking too long. Please try again in a moment.");
                return;
            }

            setBusy(true, "Sending…");
            const payload = {
                kind: kind(),
                title: f.title.value.trim(),
                body: f.body.value.trim(),
                // The page knows nothing about the reader's device, and doesn't guess.
                diagnostics: { appVersion: "", build: "", os: "", device: "" },
                turnstile: turnstileToken,
            };

            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
            try {
                const res = await fetch(cfg.relay + "/v1/feedback", {
                    method: "POST",
                    headers: { "content-type": "application/json", "x-app-key": cfg.key },
                    body: JSON.stringify(payload),
                    signal: ctrl.signal,
                });
                spendToken();
                if (res.status === 201) { finish(); return; }
                let message = "";
                try { message = (await res.json()).error || ""; } catch { /* not JSON */ }
                // The relay writes its error messages to be shown to people.
                say(message || "Couldn't send your feedback right now. Please try again later.");
            } catch {
                spendToken();
                say(`Couldn't reach the feedback service. Check your connection and try again, or email ${CONTACT}.`);
            } finally {
                clearTimeout(timer);
                if (!form.hidden) setBusy(false, "Send feedback");
            }
        });

        root.querySelector(".fb-again").addEventListener("click", () => {
            done.hidden = true;
            form.hidden = false;
            setBusy(false, "Send feedback");
            f.title.focus();
        });
    }

    function loadTurnstile() {
        if (window.turnstile) return Promise.resolve(window.turnstile);
        turnstileLoad = turnstileLoad || new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = TURNSTILE_SRC;
            s.async = true;
            s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
            s.onerror = () => { turnstileLoad = null; reject(new Error("turnstile")); };
            document.head.appendChild(s);
        });
        return turnstileLoad;
    }

    function template(id, cfg) {
        const kinds = Object.entries(KINDS).map(([value, k], i) => `
            <label class="fb-kind">
                <input type="radio" name="kind" value="${value}"${i === 0 ? " checked" : ""}>
                <span><span aria-hidden="true">${k.icon}</span> ${k.label}</span>
            </label>`).join("");
        const privacy = cfg.privacy ? ` <a href="${cfg.privacy}">What happens to it</a>` : "";
        return `
        <form class="fb-form" novalidate>
            <fieldset class="fb-kinds">
                <legend>What kind of feedback?</legend>
                <div class="fb-kind-row">${kinds}</div>
            </fieldset>

            <div class="fb-field">
                <label for="${id}-title">Title</label>
                <input id="${id}-title" name="title" type="text" maxlength="${TITLE_MAX}" required autocomplete="off"
                       aria-describedby="${id}-title-err ${id}-title-count">
                <div class="fb-meta"><span class="fb-err" id="${id}-title-err" aria-live="polite"></span><span class="fb-count" id="${id}-title-count"></span></div>
            </div>

            <div class="fb-field">
                <label for="${id}-body">Details <span class="fb-opt">optional</span></label>
                <textarea id="${id}-body" name="body" rows="6" maxlength="${BODY_MAX}"
                          aria-describedby="${id}-body-err ${id}-body-count"></textarea>
                <div class="fb-meta"><span class="fb-err" id="${id}-body-err" aria-live="polite"></span><span class="fb-count" id="${id}-body-count"></span></div>
            </div>

            <div class="fb-trap" aria-hidden="true">
                <label for="${id}-website">Leave this field empty</label>
                <input id="${id}-website" name="website" type="text" tabindex="-1" autocomplete="off">
            </div>

            <div class="fb-turnstile"></div>
            <p class="fb-status" role="alert" hidden></p>

            <div class="fb-actions">
                <button type="submit" class="fb-send"><span class="fb-send-label">Send feedback</span></button>
                <p class="fb-fine">Sends only what you type here. No device details, no tracking.${privacy}</p>
            </div>
        </form>

        <div class="fb-done" tabindex="-1" hidden>
            <div class="fb-done-mark" aria-hidden="true">✓</div>
            <h3>Got it. Thank you.</h3>
            <p>Your feedback is filed and will be read.</p>
            <p class="fb-tip">On your iPhone? <strong>Settings &gt; Send Feedback</strong> in ${cfg.app} lets you follow its status, and the app tells you when it's fixed.</p>
            <button type="button" class="fb-again">Send something else</button>
        </div>`;
    }

    function fallback(cfg) {
        return `
        <div class="fb-fallback">
            <h3>Tell us what's going on</h3>
            <p>In ${cfg.app}, open <strong>Settings &gt; Send Feedback</strong>. You can follow its status right in the app. Or email us and we'll reply within two business days.</p>
            <a class="fb-mail" href="mailto:${CONTACT}">${CONTACT}</a>
        </div>`;
    }
})();
