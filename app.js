const page = document.body.dataset.page;

const state = {
  allCards: [],
  day: 1,
  order: [],
  index: 0,
  revealed: false,
  hideDetails: localStorage.getItem("jlpt-n5-hide-details") === "true",
  known: new Set(JSON.parse(localStorage.getItem("jlpt-n5-known") || "[]")),
  voices: [],
};

const els = {
  daySelect: document.querySelector("#daySelect"),
  studyLink: document.querySelector("#studyLink"),
  dayTitle: document.querySelector("#dayTitle"),
  cardCounter: document.querySelector("#cardCounter"),
  flashcard: document.querySelector("#flashcard"),
  cardHint: document.querySelector("#cardHint"),
  kanjiText: document.querySelector("#kanjiText"),
  kanaText: document.querySelector("#kanaText"),
  meaningText: document.querySelector("#meaningText"),
  prevBtn: document.querySelector("#prevBtn"),
  revealBtn: document.querySelector("#revealBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  shuffleToggle: document.querySelector("#shuffleToggle"),
  hideDetailsToggle: document.querySelector("#hideDetailsToggle"),
  wordList: document.querySelector("#wordList"),
};

function totalDays() {
  return Math.max(...state.allCards.map((card) => card.day), 1);
}

function clampDay(day) {
  return Math.min(totalDays(), Math.max(1, Number(day) || 1));
}

function dayCards(day = state.day) {
  return state.allCards.filter((card) => card.day === day);
}

function visibleCards() {
  const cards = dayCards();
  return state.order.map((position) => cards[position]).filter(Boolean);
}

function currentCard() {
  return visibleCards()[state.index];
}

function persistKnown() {
  localStorage.setItem("jlpt-n5-known", JSON.stringify([...state.known]));
}

function persistDay() {
  localStorage.setItem("jlpt-n5-day", String(state.day));
}

function persistHideDetails() {
  localStorage.setItem("jlpt-n5-hide-details", String(state.hideDetails));
}

function dayLabel(day = state.day) {
  return `DAY ${String(day).padStart(2, "0")}`;
}

function makeOrder() {
  const cards = dayCards();
  state.order = cards.map((_, index) => index);

  if (els.shuffleToggle?.checked) {
    for (let i = state.order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
  }

  state.index = 0;
  state.revealed = false;
}

function setDay(day) {
  state.day = clampDay(day);
  persistDay();
  makeOrder();

  if (page === "flashcards") {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("day", String(state.day));
    window.history.replaceState({}, "", nextUrl);
  }

  render();
}

function setIndex(nextIndex) {
  const cards = visibleCards();
  if (!cards.length) return;

  state.index = (nextIndex + cards.length) % cards.length;
  state.revealed = false;
  render();
}

function reveal() {
  state.revealed = true;
  render();
}

function toggleKnown(card = currentCard()) {
  if (!card) return;

  if (state.known.has(card.id)) {
    state.known.delete(card.id);
  } else {
    state.known.add(card.id);
  }

  persistKnown();
  render();
}

function speak(card = currentCard()) {
  if (!card || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(card.kana);
  utterance.lang = "ja-JP";
  utterance.rate = 0.92;
  utterance.pitch = 1;

  const japaneseVoice = selectJapaneseVoice();
  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function selectJapaneseVoice() {
  const voices = state.voices.filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
  if (!voices.length) return null;

  const scoredVoices = voices.map((voice) => {
    const name = voice.name.toLowerCase();
    let score = 0;
    if (name.includes("siri")) score += 80;
    if (name.includes("kyoko") || name.includes("otoya")) score += 70;
    if (name.includes("google")) score += 55;
    if (name.includes("premium") || name.includes("enhanced")) score += 45;
    if (name.includes("compact")) score -= 50;
    if (voice.localService) score += 5;
    return { voice, score };
  });

  scoredVoices.sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name));
  return scoredVoices[0].voice;
}

function kanaToRomaji(input) {
  const kana = normalizeKana(input);
  const base = {
    あ: "a", い: "i", う: "u", え: "e", お: "o",
    か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
    が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
    さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
    ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
    た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
    だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
    な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
    は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
    ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
    や: "ya", ゆ: "yu", よ: "yo",
    ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
    わ: "wa", を: "o", ん: "n",
    ゔ: "vu", ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
  };
  const combos = {
    きゃ: "kya", きゅ: "kyu", きょ: "kyo",
    ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
    しゃ: "sha", しゅ: "shu", しょ: "sho",
    じゃ: "ja", じゅ: "ju", じょ: "jo",
    ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
    にゃ: "nya", にゅ: "nyu", にょ: "nyo",
    ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
    びゃ: "bya", びゅ: "byu", びょ: "byo",
    ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
    みゃ: "mya", みゅ: "myu", みょ: "myo",
    りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  };

  let result = "";
  for (let index = 0; index < kana.length; index += 1) {
    const char = kana[index];
    const next = kana[index + 1];
    const pair = char + next;

    if (char === "っ") {
      const nextRomaji = combos[pair] || base[next] || "";
      result += nextRomaji.match(/^[bcdfghjklmnpqrstvwxyz]/)?.[0] || "";
      continue;
    }

    if (char === "ー") {
      const vowel = result.match(/[aeiou](?!.*[aeiou])/)?.[0] || "";
      result += vowel;
      continue;
    }

    if (combos[pair]) {
      result += combos[pair];
      index += 1;
      continue;
    }

    result += base[char] ?? char;
  }

  return result;
}

function normalizeKana(input) {
  return input.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function renderSelectors() {
  if (els.daySelect) {
    els.daySelect.innerHTML = "";
  }

  for (let day = 1; day <= totalDays(); day += 1) {
    if (els.daySelect) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = dayLabel(day);
      els.daySelect.append(option);
    }
  }

  if (els.daySelect) {
    els.daySelect.value = String(state.day);
  }

  if (els.studyLink) {
    els.studyLink.href = `flashcards.html?day=${state.day}`;
  }

  if (els.hideDetailsToggle) {
    els.hideDetailsToggle.checked = state.hideDetails;
  }
}

function renderCard() {
  const cards = visibleCards();
  const card = currentCard();
  if (!card || !els.flashcard) return;

  els.dayTitle.textContent = dayLabel();
  els.cardCounter.textContent = `${state.index + 1} / ${cards.length}`;
  els.kanaText.textContent = card.kana;
  els.kanjiText.textContent = card.kanji;
  els.meaningText.textContent = card.meaning;
  els.flashcard.classList.toggle("is-revealed", state.revealed);
  els.cardHint.textContent = state.revealed ? "눌러서 가리기" : "눌러서 뜻 보기";
  if (els.revealBtn) {
    els.revealBtn.textContent = state.revealed ? "정답 가리기" : "정답 보기";
  }
}

function renderList() {
  if (!els.wordList) return;

  const cards = dayCards();
  els.wordList.innerHTML = "";
  els.wordList.classList.toggle("is-detail-hidden", state.hideDetails);

  cards
    .forEach((card) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      const dayIndex = cards.findIndex((item) => item.id === card.id);
      const orderedIndex = state.order.findIndex((position) => position === dayIndex);

      button.type = "button";
      button.innerHTML = `
        <span class="list-no">${String(card.no).padStart(2, "0")}</span>
        <span class="list-entry">
          <span class="list-row list-japanese">
            <span class="list-word">${card.kanji}</span>
            <span class="list-kana">${card.kana}</span>
          </span>
          <span class="list-row list-translation">
            <span class="list-meaning">${card.meaning}</span>
            <span class="list-romaji">${kanaToRomaji(card.kana)}</span>
          </span>
        </span>
      `;
      button.addEventListener("click", () => {
        if (page === "flashcards") {
          state.index = Math.max(0, orderedIndex);
          state.revealed = true;
          render();
        } else {
          speak(card);
        }
      });
      li.append(button);
      els.wordList.append(li);
    });
}

function render() {
  renderSelectors();
  renderCard();
  renderList();
}

function bindEvents() {
  els.daySelect?.addEventListener("change", (event) => setDay(Number(event.target.value)));
  els.prevBtn?.addEventListener("click", () => setIndex(state.index - 1));
  els.nextBtn?.addEventListener("click", () => setIndex(state.index + 1));
  els.revealBtn?.addEventListener("click", () => {
    state.revealed = !state.revealed;
    render();
  });
  els.shuffleToggle?.addEventListener("change", () => {
    makeOrder();
    render();
  });
  els.hideDetailsToggle?.addEventListener("change", (event) => {
    state.hideDetails = event.target.checked;
    persistHideDetails();
    renderList();
  });
  els.flashcard?.addEventListener("click", () => {
    speak();
  });

  document.addEventListener("keydown", (event) => {
    if (page !== "flashcards" || event.target.matches("input, select")) return;
    if (event.key === "ArrowLeft") setIndex(state.index - 1);
    if (event.key === "ArrowRight") setIndex(state.index + 1);
    if (event.key === " ") {
      event.preventDefault();
      reveal();
    }
    if (event.key.toLowerCase() === "p") speak();
    if (event.key.toLowerCase() === "k") toggleKnown();
  });
}

async function init() {
  const response = await fetch("data/vocab.json");
  state.allCards = await response.json();
  const params = new URLSearchParams(window.location.search);
  state.day = clampDay(Number(params.get("day")) || Number(localStorage.getItem("jlpt-n5-day")) || 1);
  state.voices = window.speechSynthesis?.getVoices?.() || [];

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      state.voices = window.speechSynthesis.getVoices();
    };
  }

  bindEvents();
  makeOrder();
  render();
}

init().catch((error) => {
  if (els.kanaText && els.kanjiText && els.meaningText && els.flashcard) {
    els.kanaText.textContent = "오류";
    els.kanjiText.textContent = "데이터를 불러오지 못했습니다";
    els.meaningText.textContent = error.message;
    els.flashcard.classList.add("is-revealed");
  } else {
    document.body.textContent = `데이터를 불러오지 못했습니다: ${error.message}`;
  }
});
