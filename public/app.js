(function () {
  "use strict";

  // =========================================================
  // 1. LANGUAGE TOGGLE
  // =========================================================
  const body = document.body;
  const langBtn = document.querySelector(".lang-btn");
  const SAVED_LANG_KEY = "dsl_lang";
  const savedLang = localStorage.getItem(SAVED_LANG_KEY) || "en";
  applyLang(savedLang);

  if (langBtn) {
    langBtn.addEventListener("click", () => {
      const next = body.classList.contains("lang-en") ? "id" : "en";
      applyLang(next);
      track("language_toggle", { lang: next });
    });
  }

  function applyLang(lang) {
    body.classList.remove("lang-en", "lang-id");
    body.classList.add(`lang-${lang}`);
    document.documentElement.lang = lang;
    try { localStorage.setItem(SAVED_LANG_KEY, lang); } catch (_) {}
  }

  // =========================================================
  // 2. ANALYTICS
  // =========================================================
  function track(name, payload) {
    payload = payload || {};
    try {
      fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name, payload: payload }),
      }).catch(function () {});
    } catch (_) {}

    if (typeof window.gtag === "function") {
      try { window.gtag("event", name, payload); } catch (_) {}
    }
    if (typeof window.fbq === "function") {
      try { window.fbq("trackCustom", name, payload); } catch (_) {}
    }
    if (window.ttq && typeof window.ttq.track === "function") {
      try { window.ttq.track(name, payload); } catch (_) {}
    }
    if (window.console && console.info) {
      console.info("[analytics]", name, payload);
    }
  }

  track("page_view");

  let scroll50 = false;
  let scroll90 = false;
  window.addEventListener(
    "scroll",
    function () {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) return;
      const p = window.scrollY / docH;
      if (!scroll50 && p >= 0.5) {
        scroll50 = true;
        track("scroll_50");
      }
      if (!scroll90 && p >= 0.9) {
        scroll90 = true;
        track("scroll_90");
      }
    },
    { passive: true }
  );

  document.querySelectorAll("[data-analytics]").forEach(function (el) {
    el.addEventListener("click", function () { track(el.dataset.analytics); });
  });

  // =========================================================
  // 3. CHOICE-GRID — JS-driven .is-checked (replaces :has())
  // =========================================================
  function syncChoiceState(input) {
    const label = input.closest("label");
    if (!label) return;
    const name = input.name;

    if (input.type === "radio") {
      // Clear all siblings with same name
      document.querySelectorAll('input[type="radio"][name="' + name + '"]').forEach(function (sib) {
        const sibLabel = sib.closest("label");
        if (sibLabel) sibLabel.classList.toggle("is-checked", sib.checked);
      });
    } else {
      label.classList.toggle("is-checked", input.checked);
    }
  }

  document.addEventListener("change", function (e) {
    const t = e.target;
    if (t && (t.type === "radio" || t.type === "checkbox")) {
      syncChoiceState(t);
    }
  });

  // Initial sync (e.g., if pre-checked)
  document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(syncChoiceState);

  // =========================================================
  // 4. WHY CREATINE CAROUSEL
  // =========================================================
  const eduCarousel = document.querySelector("[data-edu-carousel]");
  if (eduCarousel) {
    const slides = Array.prototype.slice.call(document.querySelectorAll("[data-edu-slide]"));
    const dots = Array.prototype.slice.call(document.querySelectorAll("[data-edu-dot]"));
    const prevBtn = document.querySelector("[data-edu-prev]");
    const nextBtn = document.querySelector("[data-edu-next]");
    let activeSlide = 0;
    let autoTimer = null;

    function showEduSlide(index, source) {
      if (!slides.length) return;
      activeSlide = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        const isActive = i === activeSlide;
        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === activeSlide);
      });
      if (source) track("why_creatine_slide", { index: activeSlide + 1, source: source });
    }

    function advanceEduSlide(source) {
      showEduSlide(activeSlide + 1, source);
    }

    function restartAutoSlide() {
      if (autoTimer) window.clearInterval(autoTimer);
      autoTimer = window.setInterval(function () {
        advanceEduSlide("auto");
      }, 4200);
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        showEduSlide(activeSlide - 1, "manual_prev");
        restartAutoSlide();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        advanceEduSlide("manual_next");
        restartAutoSlide();
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        showEduSlide(Number(dot.dataset.eduDot || 0), "dot");
        restartAutoSlide();
      });
    });

    eduCarousel.addEventListener("mouseenter", function () {
      if (autoTimer) window.clearInterval(autoTimer);
    });
    eduCarousel.addEventListener("mouseleave", restartAutoSlide);
    eduCarousel.addEventListener("focusin", function () {
      if (autoTimer) window.clearInterval(autoTimer);
    });
    eduCarousel.addEventListener("focusout", restartAutoSlide);

    showEduSlide(0);
    restartAutoSlide();
  }

  // =========================================================
  // 5. FORMAT VOTE MODULE
  // =========================================================
  const voteButtons = document.querySelectorAll(".vote-btn");
  const voteThanks = document.getElementById("voteThanks");
  let formatVote = null;

  voteButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      voteButtons.forEach(function (b) { b.classList.remove("is-selected"); });
      btn.classList.add("is-selected");
      formatVote = btn.dataset.vote;
      if (voteThanks) voteThanks.hidden = false;
      track("format_vote", { vote: formatVote });

      // Pre-select corresponding option in survey
      const map = { drink_mix: "Drink mix", gummy: "Gummy", either: "Either" };
      const target = map[formatVote];
      if (target) {
        const radio = document.querySelector('input[name="preferredFormat"][value="' + target + '"]');
        if (radio) {
          radio.checked = true;
          syncChoiceState(radio);
        }
      }
    });
  });

  // =========================================================
  // 6. STICKY MOBILE CTA
  // =========================================================
  const mobileCta = document.getElementById("mobileCta");
  const surveyEl = document.getElementById("survey");
  const heroEl = document.querySelector(".hero");

  if (mobileCta && surveyEl && heroEl) {
    let ticking = false;
    const update = function () {
      const hPast = window.scrollY > (heroEl.offsetTop + heroEl.offsetHeight - 80);
      const sRect = surveyEl.getBoundingClientRect();
      const inSurvey = sRect.top < window.innerHeight * 0.5 && sRect.bottom > 80;
      mobileCta.classList.toggle("is-visible", hPast && !inSurvey);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  // =========================================================
  // 7. INLINE SURVEY FALLBACK
  // =========================================================
  const form = document.getElementById("surveyForm");
  if (!form) return;

  const steps = Array.prototype.slice.call(form.querySelectorAll(".step"));
  const progressBar = document.getElementById("surveyProgressBar");
  const stepNum = document.getElementById("surveyStepNum");
  const stepTotal = document.getElementById("surveyStepTotal");
  const backBtn = document.getElementById("surveyBack");
  const nextBtn = document.getElementById("surveyNext");
  const submitBtn = document.getElementById("surveySubmit");
  const stepError = document.getElementById("surveyStepError");
  const profilePreview = document.getElementById("profilePreview");
  const profileType = document.getElementById("profileType");
  const profileNote = document.getElementById("profileNote");
  const successPanel = document.getElementById("surveySuccess");
  const successMessageEl = document.getElementById("surveySuccessMessage");
  let current = 0;
  let formStarted = false;

  if (stepTotal) stepTotal.textContent = String(steps.length);

  function renderStep() {
    steps.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
    if (progressBar) progressBar.style.width = ((current + 1) / steps.length) * 100 + "%";
    if (stepNum) stepNum.textContent = String(current + 1);
    if (backBtn) backBtn.hidden = current === 0;
    if (nextBtn) nextBtn.hidden = current === steps.length - 1;
    if (submitBtn) submitBtn.hidden = current !== steps.length - 1;
    if (stepError) stepError.hidden = true;
    if (current === steps.length - 1) renderProfilePreview();
  }

  function validateCurrentStep() {
    const step = steps[current];
    const checkboxes = step.querySelectorAll('input[type="checkbox"][name="concerns"]');
    const radios = step.querySelectorAll('input[type="radio"]');

    if (checkboxes.length > 0) {
      const checked = Array.prototype.filter.call(checkboxes, function (c) { return c.checked; });
      if (checked.length > 3) {
        showStepError({ en: "Please choose up to 3.", id: "Pilih maksimal 3." });
        return false;
      }
      return true;
    }

    if (radios.length > 0) {
      const r = step.querySelector('input[type="radio"]:checked');
      if (!r) {
        showStepError({ en: "Please choose one option.", id: "Pilih salah satu." });
        return false;
      }
      return true;
    }

    if (current === steps.length - 1) {
      const email = form.querySelector('input[name="email"]');
      const whatsapp = form.querySelector('input[name="whatsapp"]');
      const consent = form.querySelector('input[name="consent"]');
      if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        setFieldError("email", { en: "Please enter a valid email.", id: "Masukkan email yang valid." });
        return false;
      }
      if (whatsapp.value && !/^[+\d][\d\s()-]{6,}$/.test(whatsapp.value.trim())) {
        setFieldError("whatsapp", {
          en: "Please enter a valid WhatsApp number or leave blank.",
          id: "Masukkan nomor WhatsApp yang valid atau kosongkan.",
        });
        return false;
      }
      if (!consent.checked) {
        showStepError({
          en: "Please tick the consent box to continue.",
          id: "Centang kotak persetujuan untuk melanjutkan.",
        });
        return false;
      }
      return true;
    }
    return true;
  }

  function showStepError(messages) {
    if (!stepError) return;
    const lang = body.classList.contains("lang-id") ? "id" : "en";
    stepError.textContent = messages[lang];
    stepError.hidden = false;
  }
  function setFieldError(field, messages) {
    const lang = body.classList.contains("lang-id") ? "id" : "en";
    const t = document.querySelector('[data-error-for="' + field + '"]');
    if (t) t.textContent = messages[lang];
  }
  function clearFieldErrors() {
    document.querySelectorAll("[data-error-for]").forEach(function (e) { e.textContent = ""; });
  }

  function computeProfile(data) {
    const lang = body.classList.contains("lang-id") ? "id" : "en";
    const map = {
      gym_strength: { en: { label: "Strength Routine Builder", note: "You're already on the path. The product should make creatine effortless to repeat after training." }, id: { label: "Pembangun Rutinitas Kekuatan", note: "Kamu sudah di jalur yang tepat. Produk harus membuat creatine mudah dilakukan." } },
      running: { en: { label: "Everyday Endurance Mover", note: "Recovery and consistency matter more than intensity. Hydration-friendly formats fit your rhythm." }, id: { label: "Penggerak Endurance Harian", note: "Pemulihan dan konsistensi lebih penting daripada intensitas." } },
      padel: { en: { label: "Recreational Athlete", note: "Game days and social sport. Light, refreshing, easy on busy weeks." }, id: { label: "Atlet Rekreasional", note: "Hari pertandingan dan olahraga sosial. Praktis di minggu sibuk." } },
      pilates_yoga: { en: { label: "Active Wellness Explorer", note: "Strength curiosity without bulky positioning. Adult wellness format fits." }, id: { label: "Penjelajah Active Wellness", note: "Penasaran soal kekuatan tanpa positioning berlebihan." } },
      busy_professional: { en: { label: "Active Professional", note: "Less time, more demand. Daily repeat habits matter most." }, id: { label: "Profesional Aktif", note: "Waktu sedikit, tuntutan banyak. Kebiasaan harian paling penting." } },
      active_parent: { en: { label: "Fit Parent", note: "Energy management for family + work. Small daily habits between school runs." }, id: { label: "Orang Tua Aktif", note: "Manajemen energi untuk keluarga + kerja." } },
      wellness_beginner: { en: { label: "Daily Rhythm Builder", note: "Starting fresh. Approachable, simple, not intimidating." }, id: { label: "Pembangun Ritme Harian", note: "Memulai dari awal. Ramah, sederhana, tidak menakutkan." } },
    };
    const a = data.activity;
    if (!a || !map[a]) {
      return lang === "id"
        ? { label: "Pembangun Ritme Harian", note: "Masukanmu langsung membentuk format pertama yang kami buat." }
        : { label: "Daily Rhythm Builder", note: "Your input directly shapes the first format we build." };
    }
    return map[a][lang];
  }

  function renderProfilePreview() {
    const data = collectFormData();
    const profile = computeProfile(data);
    if (!profile) return;
    if (profilePreview) profilePreview.hidden = false;
    if (profileType) profileType.textContent = profile.label;
    if (profileNote) profileNote.textContent = profile.note;
  }

  function collectFormData() {
    const fd = new FormData(form);
    return {
      activity: fd.get("activity") || "",
      awareness: fd.get("awareness") || "",
      concerns: fd.getAll("concerns"),
      preferredFormat: fd.get("preferredFormat") || "",
      sampleInterest: fd.get("sampleInterest") || "",
      priceRange: fd.get("priceRange") || "",
      firstName: (fd.get("firstName") || "").toString().trim(),
      email: (fd.get("email") || "").toString().trim(),
      whatsapp: (fd.get("whatsapp") || "").toString().trim(),
      notes: (fd.get("notes") || "").toString().trim(),
      consent: !!fd.get("consent"),
    };
  }

  function buildLeadPayload() {
    const data = collectFormData();
    const params = new URLSearchParams(window.location.search);
    const profile = computeProfile(data);
    return {
      firstName: data.firstName,
      email: data.email,
      whatsapp: data.whatsapp,
      activityType: data.activity,
      creatineAwareness: data.awareness,
      preferredFormat: data.preferredFormat,
      mvpInterest: formatVote || data.preferredFormat,
      sampleInterest: data.sampleInterest,
      priceRange: data.priceRange,
      concerns: data.concerns,
      notes: (data.notes ? data.notes + "\n" : "") + "[Profile: " + (profile ? profile.label : "n/a") + "]",
      source: "daily_stack_lab_v2",
      consent: data.consent,
      language: body.classList.contains("lang-id") ? "id" : "en",
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmContent: params.get("utm_content") || "",
      utmTerm: params.get("utm_term") || "",
    };
  }

  form.addEventListener("input", function () {
    if (!formStarted) {
      formStarted = true;
      track("form_start");
    }
    clearFieldErrors();
    if (stepError) stepError.hidden = true;
  });

  form.addEventListener("change", function (e) {
    if (e.target.name === "preferredFormat") track("preferred_format_selected", { value: e.target.value });
    if (e.target.name === "activity") track("activity_selected", { value: e.target.value });
    if (e.target.name === "sampleInterest") track("sample_interest_selected", { value: e.target.value });
  });

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      current = Math.max(0, current - 1);
      renderStep();
      scrollToSurveyTop();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      clearFieldErrors();
      if (!validateCurrentStep()) return;
      current = Math.min(steps.length - 1, current + 1);
      renderStep();
      scrollToSurveyTop();
      track("survey_step_advance", { step: current + 1 });
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearFieldErrors();
    if (!validateCurrentStep()) return;

    const payload = buildLeadPayload();
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.6";

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        const errs = result.errors || {};
        if (errs.email) setFieldError("email", { en: errs.email, id: errs.email });
        else showStepError({ en: "Something went wrong. Please try again.", id: "Ada yang salah. Silakan coba lagi." });
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        return;
      }

      track("form_submit", {
        activity: payload.activityType,
        preferredFormat: payload.preferredFormat,
        sampleInterest: payload.sampleInterest,
        priceRange: payload.priceRange,
      });

      form.hidden = true;
      const progress = document.querySelector(".survey-progress");
      const stepIndicator = document.querySelector(".survey-step-text");
      if (progress) progress.style.display = "none";
      if (stepIndicator) stepIndicator.style.display = "none";
      if (successPanel) successPanel.hidden = false;

      if (successMessageEl && result.message) {
        const enSpan = successMessageEl.querySelector('[data-lang="en"]');
        const idSpan = successMessageEl.querySelector('[data-lang="id"]');
        if (enSpan) enSpan.textContent = result.message;
        if (idSpan) idSpan.textContent = result.message;
      }
      scrollToSurveyTop();
    } catch (err) {
      showStepError({ en: "Could not reach server. Please try again.", id: "Tidak bisa menghubungi server. Silakan coba lagi." });
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
    }
  });

  function scrollToSurveyTop() {
    const target = document.querySelector(".survey");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const top = rect.top + window.scrollY - 80;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  renderStep();
})();
