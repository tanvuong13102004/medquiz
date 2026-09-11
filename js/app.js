"use strict";

/* =========================================================
   GLOBAL
========================================================= */

window.medQuizQuestions = window.medQuizQuestions || {};
window.medQuizResources = window.medQuizResources || {};
window.medQuizFlashcards = window.medQuizFlashcards || {};
window.medQuizQuestionSets = window.medQuizQuestionSets || {};


/* =========================================================
   LAZY DATA LOADER — split PC/mobile architecture
   Heavy learning-data files are loaded only when needed or
   after the first screen has painted.
========================================================= */
const __lazyScriptPromises = new Map();
function loadLazyScript(path) {
    if (__lazyScriptPromises.has(path)) return __lazyScriptPromises.get(path);
    const task = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = path;
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => reject(new Error(`Không tải được ${path}`));
        document.head.appendChild(s);
    });
    __lazyScriptPromises.set(path, task);
    return task;
}

let __resourceDataPromise = null;
async function ensureResourceDataLoaded() {
    if (!__resourceDataPromise) {
        __resourceDataPromise = Promise.allSettled([
            loadLazyScript("resources/sachthamkhao.js"),
            loadLazyScript("resources/slidethamkhao.js")
        ]).then(() => {
            updateResourceCounts();
            updateHomeResourceTotal();
            return true;
        });
    }
    return __resourceDataPromise;
}

let __englishFlashcardsPromise = null;
async function ensureEnglishFlashcardsLoaded() {
    const existing = window.medQuizFlashcards && window.medQuizFlashcards["Tiếng Anh"];
    if (Array.isArray(existing) && existing.length) return true;
    if (!__englishFlashcardsPromise) {
        __englishFlashcardsPromise = loadLazyScript("flashcards/tienganh.js")
            .catch((error) => { console.warn(error); return false; });
    }
    return __englishFlashcardsPromise;
}

function scheduleBackgroundDataWarmup() {
    const warmup = () => {
        ensureResourceDataLoaded().catch(() => {});
        refreshHomeQuestionTotal().catch(() => {});
    };
    if ("requestIdleCallback" in window) {
        requestIdleCallback(warmup, { timeout: 3500 });
    } else {
        setTimeout(warmup, 1800);
    }
}


/* =========================================================
   CẤU HÌNH 10 BỘ CHO TẤT CẢ MÔN
========================================================= */

const SUBJECT_SET_CONFIG = {

    "Nội Khoa": {
        prefix: "noikhoa",
        icon: "🫀",
        kicker: "NỘI KHOA",
        stickers: ["🩺", "💊", "🧪"]
    },

    "Ngoại Khoa": {
        prefix: "ngoaikhoa",
        icon: "🩺",
        kicker: "NGOẠI KHOA",
        stickers: ["🔪", "🩹", "🏥"]
    },

    "Nhi Khoa": {
        prefix: "nhikhoa",
        icon: "👶",
        kicker: "NHI KHOA",
        stickers: ["🍼", "🧸", "🌈"]
    },

    "Sản Phụ Khoa": {
        prefix: "sanphukhoa",
        icon: "🤰",
        kicker: "SẢN PHỤ KHOA",
        stickers: ["👶", "🩷", "🩺"]
    },

    "Giải Phẫu": {
        prefix: "giaiphau",
        icon: "🦴",
        kicker: "GIẢI PHẪU",
        stickers: ["🦴", "🧠", "🫀"]
    },

    "Sinh Lý": {
        prefix: "sinhly",
        icon: "🧠",
        kicker: "SINH LÝ",
        stickers: ["⚡", "🫀", "🧬"]
    },

    "Hóa Sinh": {
        prefix: "hoasinh",
        icon: "🧪",
        kicker: "HÓA SINH",
        stickers: ["🧪", "🧬", "🔬"]
    },

    "Các môn khác": {
        prefix: "cacmonkhac",
        icon: "📚",
        kicker: "CÁC MÔN KHÁC",
        stickers: ["📚", "📝", "✨"]
    },

    "Tiếng Anh": {
        prefix: "tienganh",
        icon: "🔤",
        kicker: "TIẾNG ANH",
        stickers: ["💬", "🎧", "✏️"]
    }

};


const SUBJECT_SET_COUNT = 10;

const KAWAII_SET_MASCOTS = [
    "assets/stickers/capybara-doctor.svg",
    "assets/stickers/dino-study.svg",
    "assets/stickers/cat-chick.svg",
    "assets/stickers/bunny-heart.svg",
    "assets/stickers/bear-book.svg",
    "assets/stickers/panda-note.svg",
    "assets/stickers/dino-study.svg",
    "assets/stickers/cat-chick.svg",
    "assets/stickers/bunny-heart.svg",
    "assets/stickers/bear-book.svg"
];
const subjectSetLoadState = {};

let allSubjectSetsPreloaded = false;
let allSubjectSetsPreloadPromise = null;

const READ_PAGE_SIZE = 50;

let selectedQuestionCount = 15;
let selectedTimeMinutes = 15;


/* QUIZ */

let selectedSubject = "";
let selectedQuestionSet = "";
let selectedQuestionSetNumber = 0;

let quizQuestions = [];
let currentQuestion = 0;
let userAnswers = [];

let flaggedQuestions = new Set();

let timerInterval = null;
let timeRemaining = 0;
let quizStartedAt = 0;

let isSubmitted = false;
let reviewFilter = "all";

let wrongQuestions = [];
let exitTarget = "exercise";


/* READ */

let readCurrentPage = 1;


/* RESOURCE */

let currentResourceType = "";
let activeBook = null;


/* FLASHCARD */

let flashcards = [];
let filteredFlashcards = [];
let flashCurrentIndex = 0;
let knownFlashcards = new Set();


/* WORD PRACTICE */

let wordPracticeCards = [];
let wordPracticeQueue = [];
let wordPracticeIndex = 0;
let wordPracticeDirection = "mixed";
let wordPracticeCorrectCount = 0;
let wordPracticeWrongCount = 0;
let wordPracticeAttemptCount = 0;
let wordPracticeLocked = false;
let wordPracticeHintLevel = 0;
let wordPracticeCurrentDirection = "en-vi";


/* =========================================================
   HELPER
========================================================= */

const $ = id =>
    document.getElementById(id);


/* =========================================================
   PAGE
========================================================= */

const landingPage = $("landingPage");
const exerciseHub = $("exerciseHub");
const subjectPage = $("subjectPage");
const quizConfigPage = $("quizConfigPage");
const notebookPage = $("notebookPage");
const resourceHub = $("resourceHub");
const resourceListPage = $("resourceListPage");
const quizPage = $("quizPage");
const readPage = $("readPage");
const flashcardPage = $("flashcardPage");
const wordPracticePage = $("wordPracticePage");
const modeArea = $("modeArea");

let questionSetArea = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    ensureQuestionSetUI();

    setupHistoryNavigation();

    setupPortal();

    setupSubjects();

    setupQuestionSets();

    setupChoices();

    setupQuiz();

    setupRead();

    setupResources();

    setupFlashcards();

    setupWordPractice();

    setupNotebook();

    setupFullscreen();

    setupRipple();

    setupScrollTop();

    updateSubjectCounts();

    // Resource data is lazy-loaded; keep the home counter at … until it arrives.
    scheduleBackgroundDataWarmup();

    updateQuestionLegend();

    setupKawaiiExperience();

}


/* =========================================================
   PAGE
========================================================= */

function hidePages() {

    document
        .querySelectorAll(
            ".page-section"
        )
        .forEach(
            page => {

                page.classList.remove(
                    "show"
                );

            }
        );

}


/* =========================================================
   APP HISTORY / BROWSER BACK
   - Mỗi màn hình là một history state riêng.
   - Nút Back/Forward của trình duyệt hoạt động trên toàn web.
   - Dùng hash route nên chạy an toàn trên GitHub Pages/hosting tĩnh.
========================================================= */
let appHistoryReady = false;
let allowQuizHistoryExit = false;

function getVisiblePage() {
    return document.querySelector(".page-section.show") || landingPage;
}

function getPageState(page, depth) {
    return {
        medquiz: true,
        pageId: page?.id || "landingPage",
        depth: Number.isFinite(depth) ? depth : 0,
        subject: selectedSubject || "",
        questionSet: selectedQuestionSet || "",
        questionSetNumber: selectedQuestionSetNumber || 0,
        resourceType: currentResourceType || ""
    };
}

function pageHash(page, state = {}) {
    const id = page?.id || "landingPage";
    const subject = encodeURIComponent(state.subject || selectedSubject || "");
    const set = encodeURIComponent(state.questionSet || selectedQuestionSet || "");
    const resourceType = encodeURIComponent(state.resourceType || currentResourceType || "");

    if (id === "landingPage") return "#home";
    if (id === "exerciseHub") return "#bai-hoc";
    if (id === "subjectPage") return `#mon/${subject}`;
    if (id === "quizConfigPage") return `#chon-bai/${subject}/${set || "bo"}`;
    if (id === "quizPage") return `#lam-bai/${subject}/${set || "bo"}`;
    if (id === "readPage") return `#doc-cau-hoi/${subject}/${set || "bo"}`;
    if (id === "resourceHub") return "#tai-lieu";
    if (id === "resourceListPage") return `#tai-lieu/${resourceType || "danh-sach"}`;
    if (id === "notebookPage") return "#so-tay";
    if (id === "flashcardPage") return "#flashcard";
    if (id === "wordPracticePage") return "#luyen-tu";
    return `#${id}`;
}

function historyUrl(page, state) {
    return `${window.location.pathname}${window.location.search}${pageHash(page, state)}`;
}

function sameHistoryState(a, b) {
    return Boolean(
        a && b &&
        a.medquiz && b.medquiz &&
        a.pageId === b.pageId &&
        (a.subject || "") === (b.subject || "") &&
        (a.questionSet || "") === (b.questionSet || "") &&
        (a.resourceType || "") === (b.resourceType || "")
    );
}

function syncDevicePageBackground(page) {
    const isMobileHome =
        document.documentElement.dataset.device === "mobile" &&
        page === landingPage;

    document.body.classList.toggle("mobile-home-white", isMobileHome);
}


function renderPageOnly(page) {
    if (!page) return;

    hidePages();
    page.classList.add("show");
    syncDevicePageBackground(page);

    document.body.classList.toggle(
        "study-meadow-background",
        page !== landingPage
    );

    window.scrollTo({
        top: 0,
        behavior: "auto"
    });
}

function showPage(page, options = {}) {
    if (!page) return;

    renderPageOnly(page);

    if (!appHistoryReady || options.fromHistory) {
        return;
    }

    const current = window.history.state;
    const currentDepth = current?.medquiz ? Number(current.depth || 0) : 0;
    const nextState = getPageState(page, options.replace ? currentDepth : currentDepth + 1);

    if (options.replace) {
        window.history.replaceState(nextState, "", historyUrl(page, nextState));
        return;
    }

    if (sameHistoryState(current, nextState)) {
        window.history.replaceState(
            { ...nextState, depth: currentDepth },
            "",
            historyUrl(page, nextState)
        );
        return;
    }

    window.history.pushState(nextState, "", historyUrl(page, nextState));
}

function updateQuizConfigHeader() {
    const title = $("quizConfigTitle");
    if (!title) return;

    if (selectedQuestionSet === "__all__") {
        title.textContent = `${selectedSubject} • Test tất cả 10 bộ`;
    }
    else if (selectedQuestionSetNumber) {
        title.textContent = `${selectedSubject} • Bộ trắc nghiệm ${selectedQuestionSetNumber}`;
    }
    else {
        title.textContent = selectedSubject || "Bộ trắc nghiệm";
    }
}

function appBack(fallbackPage = landingPage) {
    const state = window.history.state;

    if (state?.medquiz && Number(state.depth || 0) > 0) {
        window.history.back();
        return;
    }

    showPage(fallbackPage);
}

function syncStateSelection(state) {
    if (!state?.medquiz) return;

    if (state.subject) {
        selectedSubject = state.subject;

        const config = SUBJECT_SET_CONFIG[selectedSubject] || {};
        const title = $("subjectPageTitle");
        const icon = $("subjectPageIcon");
        if (title) title.textContent = selectedSubject;
        if (icon) icon.textContent = config.icon || "📚";
    }

    if (Object.prototype.hasOwnProperty.call(state, "questionSet")) {
        selectedQuestionSet = state.questionSet || "";
        selectedQuestionSetNumber = Number(state.questionSetNumber || 0);
    }

    if (state.resourceType) {
        currentResourceType = state.resourceType;
    }

    if (state.pageId === "quizConfigPage") {
        if (modeArea) modeArea.classList.add("show");
        if ($("selectedSubjectName")) $("selectedSubjectName").textContent = getCurrentSelectionLabel();
        const count = getQuestions().length;
        if ($("subjectCountText")) $("subjectCountText").textContent = `${count} câu hỏi`;
        updateQuizConfigHeader();
    }
}

function setupHistoryNavigation() {
    if (appHistoryReady) return;

    const initialPage = getVisiblePage();
    syncDevicePageBackground(initialPage);
    const initialState = getPageState(initialPage, 0);
    window.history.replaceState(initialState, "", historyUrl(initialPage, initialState));
    appHistoryReady = true;

    window.addEventListener("popstate", event => {
        const state = event.state;
        if (!state?.medquiz) return;

        const targetPage = $(state.pageId) || landingPage;
        const leavingActiveQuiz =
            quizPage.classList.contains("show") &&
            quizQuestions.length &&
            !isSubmitted &&
            state.pageId !== "quizPage";

        if (leavingActiveQuiz && !allowQuizHistoryExit) {
            /*
               Popstate đã lùi một bước. Đi tới lại trang làm bài,
               sau đó dùng hộp xác nhận có sẵn để tránh mất bài ngoài ý muốn.
            */
            window.history.forward();
            setTimeout(() => requestExit("history"), 70);
            return;
        }

        allowQuizHistoryExit = false;
        closeExitConfirm();
        $("submitConfirmModal")?.classList.remove("show");
        $("resultModal")?.classList.remove("show");

        syncStateSelection(state);
        renderPageOnly(targetPage);

        if (targetPage === resourceListPage) {
            renderResourceList();
        }
        else if (targetPage === readPage) {
            renderReadQuestions();
        }
        else if (targetPage === flashcardPage) {
            renderFlashcard();
        }
        else if (targetPage === wordPracticePage) {
            renderWordPractice();
        }
    });
}


/* =========================================================
   HOME
========================================================= */

function setupPortal() {

    $("exercisePortalBtn")
        .addEventListener(
            "click",
            () => {
                // Open immediately. Subject banks continue warming in background.
                showPage(exerciseHub);
                preloadAllSubjectQuestionSets()
                    .then(updateSubjectCounts)
                    .catch(error => console.warn("Tải nền ngân hàng câu hỏi:", error));
            }
        );


    $("resourcePortalBtn")
        .addEventListener(
            "click",
            async () => {
                await ensureResourceDataLoaded();
                updateResourceCounts();
                showPage(resourceHub);
            }
        );


    const notebookPortalBtn = $("notebookPortalBtn");
    if (notebookPortalBtn) {
        notebookPortalBtn.addEventListener("click", () => {
            showPage(notebookPage);
            syncNotebookFromStorage();
        });
    }

    const notebookHomeBtn = $("notebookHomeBtn");
    if (notebookHomeBtn) {
        notebookHomeBtn.addEventListener("click", goHome);
    }


    $("exerciseHomeBtn")
        .addEventListener(
            "click",
            goHome
        );


    const subjectBackBtn = $("subjectBackBtn");
    if (subjectBackBtn) {
        subjectBackBtn.addEventListener(
            "click",
            () => appBack(exerciseHub)
        );
    }

    const quizConfigBackBtn = $("quizConfigBackBtn");
    if (quizConfigBackBtn) {
        quizConfigBackBtn.addEventListener(
            "click",
            () => appBack(subjectPage)
        );
    }

    const quizConfigHomeBtn = $("quizConfigHomeBtn");
    if (quizConfigHomeBtn) {
        quizConfigHomeBtn.addEventListener(
            "click",
            goHome
        );
    }


    const subjectPageHomeBtn = $("subjectPageHomeBtn");
    if (subjectPageHomeBtn) {
        subjectPageHomeBtn.addEventListener(
            "click",
            goHome
        );
    }


    $("resourceHomeBtn")
        .addEventListener(
            "click",
            goHome
        );


    $("brandHomeBtn")
        .addEventListener(
            "click",
            () => {

                if (
                    quizPage.classList.contains(
                        "show"
                    )
                    &&
                    quizQuestions.length
                    &&
                    !isSubmitted
                ) {

                    requestExit(
                        "home"
                    );

                    return;

                }

                goHome();

            }
        );

}


function goHome() {

    clearInterval(
        timerInterval
    );

    closeAllModals();

    showPage(
        landingPage
    );

}


/* =========================================================
   SỔ TAY — LOCAL STORAGE
========================================================= */
const NOTEBOOK_STORAGE_KEY = "medquiz_notebook_v1";
let notebookSaveTimer = null;

function setupNotebook() {
    const textarea = $("notebookTextarea");
    const clearBtn = $("notebookClearBtn");

    if (!textarea) return;

    syncNotebookFromStorage();

    textarea.addEventListener("input", () => {
        updateNotebookStats();
        const status = $("notebookSaveStatus");
        if (status) status.textContent = "Đang lưu...";

        clearTimeout(notebookSaveTimer);
        notebookSaveTimer = setTimeout(() => {
            try {
                localStorage.setItem(NOTEBOOK_STORAGE_KEY, textarea.value);
                if (status) status.textContent = "Đã lưu ✓";
            } catch (e) {
                if (status) status.textContent = "Không thể lưu";
            }
        }, 350);
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (!textarea.value.trim()) return;
            const ok = window.confirm("Bạn có chắc muốn xóa toàn bộ nội dung Sổ tay không?");
            if (!ok) return;
            textarea.value = "";
            try { localStorage.removeItem(NOTEBOOK_STORAGE_KEY); } catch (e) {}
            updateNotebookStats();
            const status = $("notebookSaveStatus");
            if (status) status.textContent = "Đã xóa ✓";
            textarea.focus();
        });
    }
}

function syncNotebookFromStorage() {
    const textarea = $("notebookTextarea");
    if (!textarea) return;
    try {
        textarea.value = localStorage.getItem(NOTEBOOK_STORAGE_KEY) || "";
    } catch (e) {}
    updateNotebookStats();
}

function updateNotebookStats() {
    const textarea = $("notebookTextarea");
    const stats = $("notebookStats");
    if (!textarea || !stats) return;
    const chars = textarea.value.length;
    const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
    stats.textContent = `${chars.toLocaleString("vi-VN")} ký tự • ${words.toLocaleString("vi-VN")} từ`;
}

/* =========================================================
   CSS 10 BỘ + TEST TẤT CẢ
========================================================= */

const QUESTION_SET_EXTRA_CSS = `

.question-set-area{
    display:none;
    margin-top:24px;
}

.question-set-area.show{
    display:block;
    animation:questionSetAreaEnter .55s cubic-bezier(.2,.8,.2,1) both;
}

@keyframes questionSetAreaEnter{
    from{
        opacity:0;
        transform:translateY(18px) scale(.985);
    }

    to{
        opacity:1;
        transform:translateY(0) scale(1);
    }
}

.question-set-heading{
    position:relative;
    min-height:132px;
    padding:24px 28px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:20px;
    overflow:hidden;
    border-radius:28px;
    border:1px solid rgba(236,154,181,.25);

    background:
        radial-gradient(
            circle at 88% 15%,
            rgba(152,119,239,.15),
            transparent 25%
        ),
        radial-gradient(
            circle at 74% 90%,
            rgba(76,200,222,.13),
            transparent 27%
        ),
        rgba(255,255,255,.84);
}

.question-set-heading::before{
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;

    background:
        linear-gradient(
            110deg,
            transparent 28%,
            rgba(255,255,255,.58) 47%,
            transparent 66%
        );

    transform:translateX(-120%);

    animation:
        questionSetShine
        6s
        ease-in-out
        infinite;
}

@keyframes questionSetShine{

    0%,
    65%{
        transform:translateX(-120%);
    }

    82%,
    100%{
        transform:translateX(120%);
    }
}

.question-set-heading-main{
    position:relative;
    z-index:2;
    display:flex;
    align-items:center;
    gap:17px;
}

.question-set-heading-icon{
    width:66px;
    height:66px;
    flex:0 0 66px;
    display:grid;
    place-items:center;
    border-radius:22px;
    font-size:31px;

    background:
        linear-gradient(
            135deg,
            #ffe7ef,
            #efe8ff
        );

    box-shadow:
        0 14px 30px
        rgba(190,89,132,.15);

    animation:
        questionSetHeart
        3.4s
        ease-in-out
        infinite;
}

@keyframes questionSetHeart{

    0%,
    100%{
        transform:
            translateY(0)
            rotate(-3deg);
    }

    50%{
        transform:
            translateY(-6px)
            rotate(4deg)
            scale(1.04);
    }
}

.question-set-kicker{
    display:inline-block;
    margin-bottom:5px;
    font-size:11px;
    font-weight:950;
    letter-spacing:1.8px;
    color:#c1567a;
}

.question-set-heading h2{
    margin:0;
    font-size:clamp(22px,3vw,31px);
    font-weight:950;
    letter-spacing:-.6px;
    color:#383845;
}

.question-set-heading p{
    margin:6px 0 0;
    color:#777986;
    font-size:14px;
    font-weight:650;
}

.question-set-heading-stickers{
    position:relative;
    z-index:2;
    display:flex;
    gap:10px;
    padding-right:5px;
}

.question-set-heading-stickers span{
    width:46px;
    height:46px;
    display:grid;
    place-items:center;
    border-radius:16px;
    background:rgba(255,255,255,.76);
    box-shadow:0 10px 24px rgba(93,69,128,.10);
    font-size:22px;
    animation:setHeaderSticker 4s ease-in-out infinite;
}

.question-set-heading-stickers span:nth-child(2){
    animation-delay:.45s;
}

.question-set-heading-stickers span:nth-child(3){
    animation-delay:.9s;
}

@keyframes setHeaderSticker{

    50%{
        transform:
            translateY(-7px)
            rotate(7deg);
    }
}

.question-set-grid{
    margin-top:18px;
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:16px;
}

.question-set-card{
    --set-a:#f28da8;
    --set-b:#9a78ee;
    --set-soft:#fff0f5;

    position:relative;
    min-height:192px;
    padding:20px 18px 17px;

    display:flex;
    flex-direction:column;
    align-items:flex-start;

    border:1px solid rgba(255,255,255,.92);
    border-radius:27px;

    overflow:hidden;
    cursor:pointer;
    text-align:left;

    color:#3d3e49;

    background:
        radial-gradient(
            circle at 85% 12%,
            rgba(255,255,255,.82),
            transparent 27%
        ),
        linear-gradient(
            145deg,
            var(--set-soft),
            rgba(255,255,255,.90)
        );

    box-shadow:
        0 15px 38px
        rgba(102,72,120,.10);

    transition:
        transform .32s cubic-bezier(.2,.8,.2,1),
        box-shadow .32s,
        border-color .32s;

    isolation:isolate;
}

.question-set-card::before{
    content:"";
    position:absolute;
    z-index:-1;

    width:112px;
    height:112px;

    right:-38px;
    bottom:-42px;

    border-radius:50%;

    background:
        linear-gradient(
            135deg,
            var(--set-a),
            var(--set-b)
        );

    opacity:.15;

    transition:
        transform .35s,
        opacity .35s;
}

.question-set-card::after{
    content:"✦";
    position:absolute;
    right:17px;
    top:49px;
    font-size:17px;
    color:var(--set-a);
    opacity:.45;
    animation:setSparkle 3.2s ease-in-out infinite;
}

@keyframes setSparkle{

    0%,
    100%{
        transform:scale(.9) rotate(0deg);
        opacity:.35;
    }

    50%{
        transform:scale(1.2) rotate(15deg);
        opacity:.78;
    }
}

.question-set-card:hover{
    transform:
        translateY(-8px)
        rotate(-.6deg);

    border-color:#fff;

    box-shadow:
        0 24px 50px
        rgba(100,70,122,.16);
}

.question-set-card:hover::before{
    transform:scale(1.35);
    opacity:.24;
}

.question-set-card:disabled{
    cursor:wait;
    opacity:.72;
    transform:none!important;
}

.question-set-card.active{
    transform:
        translateY(-6px)
        scale(1.015);

    border:
        2px solid
        var(--set-a);

    box-shadow:
        0 23px 55px rgba(100,70,122,.19),
        0 0 0 5px rgba(255,255,255,.72);
}

.question-set-card.active
.set-card-arrow{
    transform:
        translateX(4px)
        scale(1.08);
}

.set-card-number{
    position:absolute;
    right:16px;
    top:13px;
    font-size:11px;
    font-weight:950;
    letter-spacing:1.2px;
    color:var(--set-b);
    opacity:.72;
}

.set-card-icon{
    width:48px;
    height:48px;

    display:grid;
    place-items:center;

    border-radius:17px;

    font-size:24px;

    background:
        rgba(255,255,255,.77);

    box-shadow:
        0 9px 22px
        rgba(84,69,104,.10);

    animation:
        setIconFloat
        4.6s
        ease-in-out
        infinite;
}

.question-set-card:nth-child(2n) .set-card-icon{
    animation-delay:.4s;
}

.question-set-card:nth-child(3n) .set-card-icon{
    animation-delay:.8s;
}

@keyframes setIconFloat{

    0%,
    100%{
        transform:
            translateY(0)
            rotate(-3deg);
    }

    50%{
        transform:
            translateY(-5px)
            rotate(5deg);
    }
}

.set-card-title{
    margin-top:16px;
    max-width:85%;
    font-size:16px;
    line-height:1.25;
    font-weight:950;
}

.set-card-count{
    margin-top:7px;
    padding:5px 9px;
    border-radius:999px;
    color:var(--set-b);
    background:rgba(255,255,255,.70);
    font-size:10px;
    font-weight:900;
}

.set-card-arrow{
    position:absolute;

    right:17px;
    bottom:16px;

    width:34px;
    height:34px;

    display:grid;
    place-items:center;

    border-radius:12px;

    color:white;

    background:
        linear-gradient(
            135deg,
            var(--set-a),
            var(--set-b)
        );

    box-shadow:
        0 8px 18px
        rgba(92,71,115,.14);

    font-weight:950;

    transition:
        transform .25s;
}


/* 10 MÀU */

.set-theme-1{
    --set-a:#ef769b;
    --set-b:#c85b91;
    --set-soft:#fff0f5;
}

.set-theme-2{
    --set-a:#f19a67;
    --set-b:#ea7379;
    --set-soft:#fff3eb;
}

.set-theme-3{
    --set-a:#9b7be9;
    --set-b:#765bd3;
    --set-soft:#f2edff;
}

.set-theme-4{
    --set-a:#ef6f7e;
    --set-b:#d74c67;
    --set-soft:#ffedf0;
}

.set-theme-5{
    --set-a:#5cc6bb;
    --set-b:#3fa696;
    --set-soft:#eafaf6;
}

.set-theme-6{
    --set-a:#58a7ef;
    --set-b:#397bd7;
    --set-soft:#eaf4ff;
}

.set-theme-7{
    --set-a:#58c99a;
    --set-b:#339b73;
    --set-soft:#e9faf2;
}

.set-theme-8{
    --set-a:#55c5db;
    --set-b:#329ab4;
    --set-soft:#eafaff;
}

.set-theme-9{
    --set-a:#f0bf54;
    --set-b:#e49a3d;
    --set-soft:#fff7de;
}

.set-theme-10{
    --set-a:#b779df;
    --set-b:#8a5ac8;
    --set-soft:#f7edff;
}

#modeArea.show{
    animation:
        modeAreaFromSet
        .48s
        cubic-bezier(.2,.8,.2,1)
        both;
}

@keyframes modeAreaFromSet{

    from{
        opacity:0;
        transform:
            translateY(13px)
            scale(.992);
    }
}

@media(max-width:1100px){

    .question-set-grid{
        grid-template-columns:
            repeat(3,minmax(0,1fr));
    }
}

@media(max-width:760px){

    .question-set-heading{
        padding:20px;
        align-items:flex-start;
    }

    .question-set-heading-stickers{
        display:none;
    }

    .question-set-grid{
        grid-template-columns:
            repeat(2,minmax(0,1fr));

        gap:12px;
    }

    .question-set-card{
        min-height:174px;
        padding:17px 15px 15px;
        border-radius:23px;
    }

    .set-card-title{
        max-width:100%;
        padding-right:8px;
        font-size:14px;
    }
}

@media(max-width:430px){

    .question-set-heading-main{
        align-items:flex-start;
    }

    .question-set-heading-icon{
        width:54px;
        height:54px;
        flex-basis:54px;
        border-radius:18px;
        font-size:26px;
    }

    .question-set-heading p{
        font-size:12px;
    }

    .question-set-card{
        min-height:164px;
    }

    .set-card-icon{
        width:43px;
        height:43px;
        border-radius:15px;
        font-size:21px;
    }
}

`;


/* =========================================================
   CSS NÚT TEST TẤT CẢ
========================================================= */

const TEST_ALL_SETS_CSS = `

.question-set-heading-right{
    position:relative;
    z-index:5;
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:13px;
    margin-left:auto;
}

.test-all-sets-btn{
    position:relative;
    min-width:174px;
    min-height:66px;
    padding:10px 17px 10px 12px;
    display:flex;
    align-items:center;
    gap:11px;
    border:0;
    border-radius:21px;
    cursor:pointer;
    overflow:hidden;
    color:#fff;
    text-align:left;

    background:
        linear-gradient(
            135deg,
            #e66b93,
            #a16be0,
            #638eea
        );

    background-size:200% 200%;

    box-shadow:
        0 14px 30px rgba(131,79,181,.20),
        inset 0 1px 0 rgba(255,255,255,.32);

    transition:
        transform .28s cubic-bezier(.2,.8,.2,1),
        box-shadow .28s,
        filter .28s;

    animation:
        testAllGradient
        5s
        ease
        infinite;
}

@keyframes testAllGradient{

    0%{
        background-position:0% 50%;
    }

    50%{
        background-position:100% 50%;
    }

    100%{
        background-position:0% 50%;
    }
}

.test-all-sets-btn:before{
    content:"";
    position:absolute;
    width:75px;
    height:150px;
    left:-90px;
    top:-40px;
    transform:rotate(25deg);

    background:
        linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.38),
            transparent
        );

    animation:
        testAllShine
        4.2s
        ease-in-out
        infinite;
}

@keyframes testAllShine{

    0%,
    58%{
        left:-90px;
    }

    82%,
    100%{
        left:calc(100% + 60px);
    }
}

.test-all-sets-btn:hover{
    transform:
        translateY(-5px)
        scale(1.025);

    box-shadow:
        0 21px 40px rgba(120,72,175,.27),
        inset 0 1px 0 rgba(255,255,255,.38);
}

.test-all-sets-btn:active{
    transform:
        translateY(-1px)
        scale(.98);
}

.test-all-sets-btn.active{
    transform:
        translateY(-4px)
        scale(1.025);

    box-shadow:
        0 20px 42px rgba(111,70,174,.30),
        0 0 0 5px rgba(151,103,216,.13);
}

.test-all-sets-btn:disabled{
    cursor:wait;
    opacity:.65;
    transform:none;
}

.test-all-icon{
    position:relative;
    z-index:2;
    width:45px;
    height:45px;
    flex:0 0 45px;
    display:grid;
    place-items:center;
    border-radius:15px;

    background:
        rgba(255,255,255,.19);

    border:
        1px solid
        rgba(255,255,255,.20);

    box-shadow:
        inset
        0 1px 0
        rgba(255,255,255,.22);

    font-size:21px;

    animation:
        testAllIconMove
        3.2s
        ease-in-out
        infinite;
}

@keyframes testAllIconMove{

    0%,
    100%{
        transform:
            rotate(-4deg)
            scale(1);
    }

    50%{
        transform:
            rotate(5deg)
            scale(1.08);
    }
}

.test-all-content{
    position:relative;
    z-index:2;
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    line-height:1.1;
}

.test-all-content strong{
    font-size:13px;
    font-weight:950;
    letter-spacing:.4px;
    white-space:nowrap;
}

.test-all-content small{
    margin-top:5px;
    color:rgba(255,255,255,.83);
    font-size:9px;
    font-weight:800;
    white-space:nowrap;
}

.test-all-arrow{
    position:relative;
    z-index:2;
    margin-left:auto;
    font-size:17px;
    font-weight:950;
    transition:transform .25s;
}

.test-all-sets-btn:hover
.test-all-arrow{
    transform:translateX(4px);
}

@media(max-width:900px){

    .question-set-heading{
        flex-wrap:wrap;
    }

    .question-set-heading-right{
        width:100%;
        justify-content:space-between;
        margin-top:5px;
    }

    .test-all-sets-btn{
        min-width:185px;
    }
}

@media(max-width:760px){

    .question-set-heading-right{
        width:100%;
    }

    .test-all-sets-btn{
        width:100%;
        min-width:0;
        min-height:62px;
    }

    .question-set-heading-right
    .question-set-heading-stickers{
        display:none;
    }
}

@media(max-width:430px){

    .test-all-sets-btn{
        padding:9px 13px 9px 9px;
        border-radius:18px;
    }

    .test-all-icon{
        width:42px;
        height:42px;
        flex-basis:42px;
        border-radius:13px;
        font-size:19px;
    }

    .test-all-content strong{
        font-size:12px;
    }
}

`;


/* =========================================================
   ICON 10 BỘ
========================================================= */

const SET_CARD_ICONS = [
    "🫀",
    "🫁",
    "🧠",
    "🩸",
    "🧬",
    "💉",
    "🧫",
    "🔬",
    "💊",
    "⚕️"
];


/* =========================================================
   SET HELPERS
========================================================= */

function getSubjectSetConfig(
    subject = selectedSubject
) {

    return SUBJECT_SET_CONFIG[
        subject
    ] || null;

}


function isSetManagedSubject(
    subject = selectedSubject
) {

    return Boolean(
        getSubjectSetConfig(
            subject
        )
    );

}


function getSubjectSetKeys(
    subject = selectedSubject
) {

    const config =
        getSubjectSetConfig(
            subject
        );


    if (
        !config
    ) {

        return [];

    }


    return Array.from(
        {
            length:
                SUBJECT_SET_COUNT
        },
        (
            _,
            index
        ) =>
            `${config.prefix}${index + 1}`
    );

}


/* =========================================================
   TỰ CHÈN UI 10 BỘ
========================================================= */

function ensureQuestionSetUI() {

    if (
        !document.getElementById(
            "questionSetStyles"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );


        style.id =
            "questionSetStyles";


        style.textContent =
            QUESTION_SET_EXTRA_CSS;


        document.head.appendChild(
            style
        );

    }


    if (
        !document.getElementById(
            "testAllSetsStyles"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );


        style.id =
            "testAllSetsStyles";


        style.textContent =
            TEST_ALL_SETS_CSS;


        document.head.appendChild(
            style
        );

    }


    if (
        !$(
            "questionSetArea"
        )
    ) {

        const area =
            document.createElement(
                "div"
            );


        area.className =
            "question-set-area";


        area.id =
            "questionSetArea";


        const subjectContainer = $("subjectPage");
        const subjectIntro = subjectContainer?.querySelector(".subject-page-intro");

        if (subjectContainer) {
            if (subjectIntro) {
                subjectIntro.insertAdjacentElement("afterend", area);
            }
            else {
                subjectContainer.appendChild(area);
            }
        }

    }


    questionSetArea =
        $("questionSetArea");


    const readButton =
        $("readQuestionsBtn");


    if (
        readButton
    ) {

        const heading =
            readButton.querySelector(
                ".mode-content h3"
            );


        const description =
            readButton.querySelector(
                ".mode-content p"
            );


        if (
            heading
        ) {

            heading.textContent =
                "Đọc FULL BỘ";

        }


        if (
            description
        ) {

            description.textContent =
                "Xem toàn bộ câu hỏi, đáp án và giải thích.";

        }

    }

}


/* =========================================================
   RENDER 10 BỘ
========================================================= */

function renderQuestionSetArea(
    subject
) {

    if (
        !questionSetArea
    ) {

        return;

    }


    const config =
        getSubjectSetConfig(
            subject
        );


    if (
        !config
    ) {

        questionSetArea.innerHTML =
            "";

        return;

    }


    const keys =
        getSubjectSetKeys(
            subject
        );


    const loaded =
        subjectSetLoadState[
            subject
        ] === true;


    const allCount =
        loaded
            ? getAllSubjectQuestions(
                subject
            ).length
            : 0;


    const cards =
        keys
            .map(
                (
                    key,
                    index
                ) => {

                    const cardNumber =
                        String(index + 1)
                            .padStart(2, "0");

                    const cardImage =
                        `./assets/question-sets/set-${cardNumber}.png?v=20260911q3`;

                    return `

                    <button
                        class="question-set-pro-card pro-set-${index + 1} ripple-target"
                        data-question-set="${key}"
                        data-set-number="${index + 1}"
                        type="button"
                        aria-label="Bộ trắc nghiệm ${index + 1}"
                        ${
                            loaded
                                ? ""
                                : "disabled"
                        }
                    >

                        <img
                            class="question-set-pro-bg"
                            src="${cardImage}"
                            alt=""
                            aria-hidden="true"
                            decoding="async"
                        >

                        <span
                            class="question-set-pro-count"
                            data-question-set-count="${key}"
                            aria-live="polite"
                        >
                            ${
                                loaded
                                    ? "0 câu"
                                    : "đang tải..."
                            }
                        </span>

                        <span
                            class="question-set-pro-active-indicator"
                            aria-hidden="true"
                        >✓</span>

                    </button>

                    `;

                }
            )
            .join("");


    questionSetArea.innerHTML =
        `

        <div class="question-set-heading glass-card">

            <div class="question-set-heading-main">

                <div class="question-set-heading-icon">
                    ${config.icon}
                </div>


                <div>

                    <span class="question-set-kicker">
                        ${config.kicker}
                    </span>

                    <h2>
                        Chọn bộ trắc nghiệm
                    </h2>

                    <p>
                        Chọn 1 trong 10 bộ phía dưới để bắt đầu học.
                    </p>

                </div>

            </div>


            <div class="question-set-heading-right">

                <img class="question-set-header-mascot" src="assets/stickers/cat-chick.svg" alt="" aria-hidden="true">

                <button
                    class="test-all-sets-btn ripple-target ${selectedQuestionSet === "__all__" ? "active" : ""}"
                    data-test-all-sets="true"
                    type="button"
                    ${loaded ? "" : "disabled"}
                >

                    <span class="test-all-icon">
                        🎯
                    </span>

                    <span class="test-all-content">

                        <strong>
                            TEST TẤT CẢ
                        </strong>

                        <small class="test-all-count">
                            ${loaded ? `${allCount} câu • 10 bộ` : "Đang tải..."}
                        </small>

                    </span>

                    <span class="test-all-arrow">
                        →
                    </span>

                </button>


                <div
                    class="question-set-heading-stickers"
                    aria-hidden="true"
                >

                    ${
                        config.stickers
                            .map(
                                sticker =>
                                    `<span>${sticker}</span>`
                            )
                            .join("")
                    }

                </div>

            </div>

        </div>


        <div class="question-set-grid">

            ${cards}

        </div>

        `;

}


/* =========================================================
   LOAD FILE JS
========================================================= */

function loadQuestionScript(
    path
) {

    return new Promise(
        resolve => {

            const script =
                document.createElement(
                    "script"
                );


            script.src =
                path;


            script.async =
                false;


            script.onload =
                () => {

                    resolve(
                        true
                    );

                };


            script.onerror =
                () => {

                    console.warn(
                        `Không tải được ${path}`
                    );


                    resolve(
                        false
                    );

                };


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================================
   LOAD 10 FILE CỦA MỘT MÔN
========================================================= */

async function loadSubjectQuestionSets(
    subject
) {

    const config =
        getSubjectSetConfig(
            subject
        );


    if (
        !config
    ) {

        return;

    }


    if (
        subjectSetLoadState[
            subject
        ] === true
    ) {

        return;

    }


    if (
        subjectSetLoadState[
            subject
        ] instanceof Promise
    ) {

        await subjectSetLoadState[
            subject
        ];


        return;

    }


    const task =
        (
            async () => {

                window.medQuizQuestions =
                    window.medQuizQuestions || {};


                window.medQuizQuestionSets =
                    window.medQuizQuestionSets || {};


                const legacyQuestions =

                    Array.isArray(
                        window.medQuizQuestions[
                            subject
                        ]
                    )

                        ? [
                            ...window.medQuizQuestions[
                                subject
                            ]
                        ]

                        : [];


                window.medQuizQuestionSets[
                    subject
                ] = {};


                const keys =
                    getSubjectSetKeys(
                        subject
                    );


                for (
                    let index = 0;

                    index < keys.length;

                    index++
                ) {

                    const key =
                        keys[
                            index
                        ];


                    window.medQuizQuestions[
                        subject
                    ] = [];


                    const loadedOk =
                        await loadQuestionScript(
                            `questions/${key}.js`
                        );


                    const loaded =
                        window.medQuizQuestions[
                            subject
                        ];


                    const questions =

                        Array.isArray(
                            loaded
                        )
                        &&
                        loaded.length

                            ? [
                                ...loaded
                            ]

                            : (
                                !loadedOk
                                &&
                                index === 0
                                &&
                                legacyQuestions.length

                                    ? [
                                        ...legacyQuestions
                                    ]

                                    : []
                            );


                    window.medQuizQuestionSets[
                        subject
                    ][key] =
                        questions;

                }


                window.medQuizQuestions[
                    subject
                ] =
                    getAllSubjectQuestions(
                        subject
                    );


                subjectSetLoadState[
                    subject
                ] =
                    true;

            }
        )();


    subjectSetLoadState[
        subject
    ] =
        task;


    await task;

}


/* =========================================================
   PRELOAD TẤT CẢ MÔN KHI MỞ BÀI TẬP
========================================================= */

async function preloadAllSubjectQuestionSets() {

    /*
        Nếu đã tải xong trước đó thì chỉ cập nhật lại
        số câu và không tải 90 file lần thứ hai.
    */

    if (
        allSubjectSetsPreloaded
    ) {

        updateSubjectCounts();

        return;

    }


    /*
        Nếu một lần preload đang chạy,
        dùng lại Promise hiện tại để tránh tải trùng file.
    */

    if (
        allSubjectSetsPreloadPromise
    ) {

        await allSubjectSetsPreloadPromise;

        updateSubjectCounts();

        return;

    }


    const subjects =
        Object.keys(
            SUBJECT_SET_CONFIG
        );


    allSubjectSetsPreloadPromise =
        Promise.all(
            subjects.map(
                subject =>
                    loadSubjectQuestionSets(
                        subject
                    )
            )
        );


    try {

        await allSubjectSetsPreloadPromise;

        allSubjectSetsPreloaded =
            true;


        /*
            Sau khi tất cả môn đã tải xong,
            cập nhật số câu trên 9 ô môn học.
        */

        updateSubjectCounts();

    }

    finally {

        allSubjectSetsPreloadPromise =
            null;

    }

}


/* =========================================================
   SUBJECT
========================================================= */

function setupSubjects() {

    document
        .querySelectorAll(
            ".subject-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await selectSubject(
                            button
                        );

                    }
                );

            }
        );

}


async function selectSubject(
    button
) {

    document
        .querySelectorAll(
            ".subject-btn"
        )
        .forEach(
            item => {

                item.classList.remove(
                    "active"
                );

            }
        );


    button.classList.add(
        "active"
    );


    selectedSubject =
        button.dataset.subject;


    const subjectConfig =
        SUBJECT_SET_CONFIG[
            selectedSubject
        ] || {};


    const subjectPageTitle =
        $("subjectPageTitle");


    const subjectPageIcon =
        $("subjectPageIcon");


    if (subjectPageTitle) {
        subjectPageTitle.textContent =
            selectedSubject;
    }


    if (subjectPageIcon) {
        subjectPageIcon.textContent =
            subjectConfig.icon || "📚";
    }


    if (subjectPage) {
        showPage(
            subjectPage
        );
    }


    const subjectAtClick =
        selectedSubject;


    selectedQuestionSet =
        "";


    selectedQuestionSetNumber =
        0;


    modeArea.classList.remove(
        "show"
    );


    const flashButton =
        $("flashcardModeBtn");


    const wordPracticeButton =
        $("wordPracticeModeBtn");


    const modeGrid =
        $("modeGrid");


    const isEnglishSubject =
        selectedSubject ===
        "Tiếng Anh";


    /*
        Flashcard và Luyện từ CHỈ dành cho môn Tiếng Anh.
        Dùng đồng thời hidden + class show để không bị các rule CSS
        chung của .mode-card ép hiển thị ở những môn khác.
    */
    flashButton.hidden =
        !isEnglishSubject;

    wordPracticeButton.hidden =
        !isEnglishSubject;

    flashButton.classList.toggle(
        "show",
        isEnglishSubject
    );

    wordPracticeButton.classList.toggle(
        "show",
        isEnglishSubject
    );

    modeGrid.classList.toggle(
        "english-mode-grid",
        isEnglishSubject
    );


    if (
        !isSetManagedSubject(
            selectedSubject
        )
    ) {

        if (
            questionSetArea
        ) {

            questionSetArea.classList.remove(
                "show"
            );

        }


        const count =
            getRawQuestions(
                selectedSubject
            ).length;


        $("selectedSubjectName")
            .textContent =
            selectedSubject;


        $("subjectCountText")
            .textContent =
            `${count} câu hỏi`;


        modeArea.classList.add(
            "show"
        );

        updateQuizConfigHeader();
        showPage(quizConfigPage);

        return;

    }


    renderQuestionSetArea(
        selectedSubject
    );


    questionSetArea.classList.add(
        "show"
    );


    await loadSubjectQuestionSets(
        subjectAtClick
    );


    if (
        selectedSubject !==
        subjectAtClick
    ) {

        return;

    }


    renderQuestionSetArea(
        selectedSubject
    );


    updateQuestionSetCounts();


    updateSubjectCountFor(
        selectedSubject
    );

}


/* =========================================================
   QUESTION SET EVENTS
========================================================= */

function setupQuestionSets() {

    if (
        !questionSetArea
    ) {

        return;

    }


    questionSetArea.addEventListener(
        "click",
        event => {

            const testAllButton =
                event.target.closest(
                    ".test-all-sets-btn"
                );


            if (
                testAllButton
            ) {

                selectAllQuestionSets();

                return;

            }


            const button =
                event.target.closest(
                    ".question-set-pro-card"
                );


            if (
                !button
            ) {

                return;

            }


            selectQuestionSet(
                button
            );

        }
    );

}


/* =========================================================
   SELECT SET
========================================================= */

function selectQuestionSet(
    button
) {

    if (
        !isSetManagedSubject(
            selectedSubject
        )
    ) {

        return;

    }


    questionSetArea
        .querySelectorAll(
            ".question-set-pro-card"
        )
        .forEach(
            item => {

                item.classList.remove(
                    "active"
                );

            }
        );


    const testAllButton =
        questionSetArea.querySelector(
            ".test-all-sets-btn"
        );


    if (
        testAllButton
    ) {

        testAllButton.classList.remove(
            "active"
        );

    }


    button.classList.add(
        "active"
    );


    selectedQuestionSet =
        button.dataset.questionSet;


    selectedQuestionSetNumber =
        Number(
            button.dataset.setNumber
        ) || 0;


    const count =
        getRawQuestions(
            selectedSubject
        ).length;


    $("selectedSubjectName")
        .textContent =
        getCurrentSelectionLabel();


    $("subjectCountText")
        .textContent =
        `${count} câu hỏi`;


    modeArea.classList.add(
        "show"
    );

    updateQuizConfigHeader();
    showPage(quizConfigPage);

}


/* =========================================================
   TEST TẤT CẢ 10 BỘ
========================================================= */

function selectAllQuestionSets() {

    if (
        !isSetManagedSubject(
            selectedSubject
        )
    ) {

        return;

    }


    if (
        subjectSetLoadState[
            selectedSubject
        ] !== true
    ) {

        showToast(
            "Các bộ câu hỏi đang được tải, vui lòng chờ một chút.",
            "info"
        );

        return;

    }


    const allQuestions =
        getAllSubjectQuestions(
            selectedSubject
        );


    if (
        !allQuestions.length
    ) {

        showToast(
            `${selectedSubject} chưa có câu hỏi.`,
            "warning"
        );

        return;

    }


    selectedQuestionSet =
        "__all__";


    selectedQuestionSetNumber =
        0;


    questionSetArea
        .querySelectorAll(
            ".question-set-pro-card"
        )
        .forEach(
            card => {

                card.classList.remove(
                    "active"
                );

            }
        );


    const testAllButton =
        questionSetArea.querySelector(
            ".test-all-sets-btn"
        );


    if (
        testAllButton
    ) {

        testAllButton.classList.add(
            "active"
        );

    }


    $("selectedSubjectName")
        .textContent =
        getCurrentSelectionLabel();


    $("subjectCountText")
        .textContent =
        `${allQuestions.length} câu hỏi • 10 bộ`;


    modeArea.classList.add(
        "show"
    );

    updateQuizConfigHeader();
    showPage(quizConfigPage);

}


/* =========================================================
   GET QUESTIONS SET
========================================================= */

function getSubjectQuestionSet(
    subject,
    key
) {

    const collection =
        window.medQuizQuestionSets?.[
            subject
        ];


    const questions =
        collection?.[
            key
        ];


    return Array.isArray(
        questions
    )

        ? questions

        : [];

}


/* =========================================================
   GET ALL 10 SETS
========================================================= */

function getAllSubjectQuestions(
    subject = selectedSubject
) {

    return getSubjectSetKeys(
        subject
    )
        .flatMap(
            key =>

                getSubjectQuestionSet(
                    subject,
                    key
                )

        );

}


/* =========================================================
   LABEL
========================================================= */

function getCurrentSelectionLabel() {

    if (
        isSetManagedSubject(
            selectedSubject
        )
        &&
        selectedQuestionSet ===
        "__all__"
    ) {

        return (
            `${selectedSubject} • TEST TẤT CẢ`
        );

    }


    if (
        isSetManagedSubject(
            selectedSubject
        )
        &&
        selectedQuestionSetNumber
    ) {

        return (
            `${selectedSubject} • Bộ trắc nghiệm `
            +
            `${selectedQuestionSetNumber}`
        );

    }


    return selectedSubject;

}


/* =========================================================
   COUNT SET
========================================================= */

function updateQuestionSetCounts() {

    if (
        !questionSetArea
    ) {

        return;

    }


    questionSetArea
        .querySelectorAll(
            "[data-question-set-count]"
        )
        .forEach(
            element => {

                const key =
                    element.dataset
                        .questionSetCount;


                const count =
                    getSubjectQuestionSet(
                        selectedSubject,
                        key
                    ).length;


                setSubjectTotalCount(
                    element,
                    count
                );

            }
        );

}


/* =========================================================
   COUNT ONE SUBJECT
========================================================= */

function updateSubjectCountFor(
    subject
) {

    const element =
        document.querySelector(
            `[data-subject-count="${subject}"]`
        );


    if (
        !element
    ) {

        return;

    }


    const count =

        isSetManagedSubject(
            subject
        )

            ? getAllSubjectQuestions(
                subject
            ).length

            : getRawQuestions(
                subject
            ).length;


    setSubjectTotalCount(
        element,
        count
    );

}


function setSubjectTotalCount(element, count) {

    if (!element) return;

    element.textContent =
        `${count} Câu`;

    element.classList.remove(
        "count-pop"
    );

    void element.offsetWidth;

    element.classList.add(
        "count-pop"
    );

    window.setTimeout(
        () => element.classList.remove("count-pop"),
        650
    );

}


/* =========================================================
   COUNT ALL SUBJECTS
========================================================= */

function updateSubjectCounts() {

    document
        .querySelectorAll(
            "[data-subject-count]"
        )
        .forEach(
            element => {

                const subject =
                    element.dataset.subjectCount;


                const hasLoadedSets =

                    subjectSetLoadState[
                        subject
                    ] === true;


                const count =

                    isSetManagedSubject(
                        subject
                    )
                    &&
                    hasLoadedSets

                        ? getAllSubjectQuestions(
                            subject
                        ).length

                        : getRawQuestions(
                            subject
                        ).length;


                element.textContent =
                    `${count} câu`;

            }
        );


    updateHomeQuestionTotal();

}


/* =========================================================
   TỔNG SỐ CÂU / TÀI LIỆU Ở TRANG CHỦ
========================================================= */

function getCurrentSubjectQuestionCount(subject) {

    const setMap =
        window.medQuizQuestionSets &&
        window.medQuizQuestionSets[subject];

    if (
        setMap &&
        typeof setMap === "object"
    ) {
        const setArrays =
            Object.values(setMap)
                .filter(Array.isArray);

        if (setArrays.length) {
            return setArrays.reduce(
                (sum, questions) => sum + questions.length,
                0
            );
        }
    }

    const direct =
        window.medQuizQuestions &&
        window.medQuizQuestions[subject];

    return Array.isArray(direct)
        ? direct.length
        : 0;
}


function getCurrentAllQuestionTotal() {

    const subjects =
        Object.keys(SUBJECT_SET_CONFIG);

    return subjects.reduce(
        (sum, subject) =>
            sum + getCurrentSubjectQuestionCount(subject),
        0
    );
}


function formatHomeTotalV2(value) {
    const number = Number(value) || 0;
    return number.toLocaleString("vi-VN");
}


function animateHomeTotalV2(element) {

    if (!element) {
        return;
    }

    element.classList.remove("home-total-v2-updated");
    void element.offsetWidth;
    element.classList.add("home-total-v2-updated");
}


function setHomeTotalV2(element, value) {

    if (!element) {
        return;
    }

    element.textContent = formatHomeTotalV2(value);
    element.classList.remove("is-loading");
    animateHomeTotalV2(element);
}


function updateHomeQuestionTotal() {

    const element = $("homeQuestionTotal");

    if (!element) {
        return;
    }

    setHomeTotalV2(
        element,
        getCurrentAllQuestionTotal()
    );
}


async function refreshHomeQuestionTotal() {

    const element = $("homeQuestionTotal");

    if (!element) {
        return;
    }

    element.textContent = "…";
    element.classList.add("is-loading");

    try {
        /*
           Tải đủ 10 bộ của từng môn trước khi cộng.
           Mỗi bộ chỉ được cộng đúng một lần từ
           window.medQuizQuestionSets[subject].
        */
        await preloadAllSubjectQuestionSets();
    }
    catch (error) {
        console.warn(
            "Không tải đủ toàn bộ bộ câu hỏi, dùng dữ liệu đã tải được:",
            error
        );
    }

    setHomeTotalV2(
        element,
        getCurrentAllQuestionTotal()
    );
}


function getHomeResourceTotalV2() {

    const categories = [
        "Sách Tham Khảo",
        "Slide Tham Khảo"
    ];

    return categories.reduce(
        (sum, category) => {
            const items =
                window.medQuizResources &&
                window.medQuizResources[category];

            return sum + (
                Array.isArray(items)
                    ? items.length
                    : 0
            );
        },
        0
    );
}


function updateHomeResourceTotal() {

    const elements =
        Array.from(
            document.querySelectorAll(
                "[data-home-resource-total]"
            )
        );

    const fallback = $("homeResourceTotal");

    if (
        fallback &&
        !elements.includes(fallback)
    ) {
        elements.push(fallback);
    }

    if (!elements.length) {
        return;
    }

    const total = getHomeResourceTotalV2();

    elements.forEach(
        element => setHomeTotalV2(element, total)
    );
}


/* =========================================================
   CONFIG
========================================================= */

function setupChoices() {

    $("questionCountChoices")
        .querySelectorAll(
            "[data-count]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        $("questionCountChoices")
                            .querySelectorAll(
                                "[data-count]"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        button.classList.add(
                            "active"
                        );


                        selectedQuestionCount =

                            button.dataset.count ===
                            "all"

                                ? "all"

                                : Number(
                                    button.dataset.count
                                );

                    }
                );

            }
        );


    $("timeChoices")
        .querySelectorAll(
            "[data-time]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        $("timeChoices")
                            .querySelectorAll(
                                "[data-time]"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        button.classList.add(
                            "active"
                        );


                        selectedTimeMinutes =
                            Number(
                                button.dataset.time
                            );

                    }
                );

            }
        );

}


/* =========================================================
   QUESTION DATA
========================================================= */

function getRawQuestions(
    subject = selectedSubject
) {

    if (
        isSetManagedSubject(
            subject
        )
    ) {

        if (
            subject ===
            selectedSubject
            &&
            selectedQuestionSet ===
            "__all__"
        ) {

            return getAllSubjectQuestions(
                subject
            );

        }


        if (
            subject ===
            selectedSubject
            &&
            selectedQuestionSet
        ) {

            return getSubjectQuestionSet(
                subject,
                selectedQuestionSet
            );

        }


        if (
            subjectSetLoadState[
                subject
            ] === true
        ) {

            return getAllSubjectQuestions(
                subject
            );

        }

    }


    const questions =
        window.medQuizQuestions[
            subject
        ];


    return Array.isArray(
        questions
    )

        ? questions

        : [];

}


/* =========================================================
   GET QUESTIONS NORMALIZED
========================================================= */

function getQuestions(
    subject = selectedSubject
) {

    return getRawQuestions(
        subject
    )
        .map(
            (
                question,
                index
            ) =>

                normalizeQuestion(
                    question,
                    index
                )
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   NORMALIZE QUESTION
========================================================= */

function normalizeQuestion(
    question,
    sourceIndex
) {

    if (
        !question
        ||
        !question.question
        ||
        !Array.isArray(
            question.answers
        )
        ||
        question.answers.length < 2
    ) {

        return null;

    }


    const correct =
        resolveCorrectIndex(
            question.correct,
            question.answers
        );


    if (
        correct < 0
        ||
        correct >=
        question.answers.length
    ) {

        return null;

    }


    return {

        question:
            String(
                question.question
            ),

        answers:
            question.answers.map(
                answer =>
                    String(
                        answer
                    )
            ),

        correct,

        explanation:
            String(
                question.explanation
                ||
                ""
            ),

        explanationAnswers:

            Array.isArray(
                question.explanationAnswers
            )

                ? question
                    .explanationAnswers
                    .map(
                        value =>
                            String(
                                value || ""
                            )
                    )

                : [],

        sourceIndex:
            sourceIndex + 1

    };

}


/* =========================================================
   CORRECT INDEX
========================================================= */

function resolveCorrectIndex(
    value,
    answers
) {

    const numeric =
        Number(
            value
        );


    if (
        Number.isInteger(
            numeric
        )
        &&
        numeric >= 0
        &&
        numeric <
        answers.length
    ) {

        return numeric;

    }


    const text =
        String(
            value ?? ""
        ).trim();


    if (
        /^[A-Z]$/i.test(
            text
        )
    ) {

        const index =
            text
                .toUpperCase()
                .charCodeAt(0)
            -
            65;


        if (
            index >= 0
            &&
            index <
            answers.length
        ) {

            return index;

        }

    }


    return answers.findIndex(
        answer =>
            String(
                answer
            ).trim()
            ===
            text
    );

}


/* =========================================================
   RANDOM
========================================================= */

function shuffleArray(
    array
) {

    const result =
        [
            ...array
        ];


    for (
        let i =
            result.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random()
                *
                (
                    i + 1
                )
            );


        [
            result[i],
            result[j]
        ]
        =
        [
            result[j],
            result[i]
        ];

    }


    return result;

}


/* =========================================================
   RANDOM ANSWER
========================================================= */

function randomizeAnswers(
    question
) {

    const items =
        question.answers.map(
            (
                answer,
                index
            ) => ({

                answer,

                correct:
                    index ===
                    question.correct,

                explanation:
                    question
                        .explanationAnswers[
                            index
                        ]
                    ||
                    ""

            })
        );


    const shuffled =
        shuffleArray(
            items
        );


    return {

        ...question,

        answers:
            shuffled.map(
                item =>
                    item.answer
            ),

        correct:
            shuffled.findIndex(
                item =>
                    item.correct
            ),

        explanationAnswers:
            shuffled.map(
                item =>
                    item.explanation
            )

    };

}


/* =========================================================
   CREATE TEST
========================================================= */

function createRandomTest() {

    const questions =
        getQuestions();


    if (
        !questions.length
    ) {

        return [];

    }


    const count =

        selectedQuestionCount ===
        "all"

            ? questions.length

            : Math.min(
                selectedQuestionCount,
                questions.length
            );


    if (
        selectedQuestionCount !==
        "all"
        &&
        selectedQuestionCount >
        questions.length
    ) {

        showToast(
            `${getCurrentSelectionLabel()} hiện có ${questions.length} câu.`,
            "warning"
        );

    }


    return shuffleArray(
        questions
    )
        .slice(
            0,
            count
        )
        .map(
            randomizeAnswers
        );

}


/* =========================================================
   QUIZ SETUP
========================================================= */

function setupQuiz() {

    $("startTestBtn")
        .addEventListener(
            "click",
            prepareTest
        );


    $("prevBtn")
        .addEventListener(
            "click",
            previousQuestion
        );


    $("nextBtn")
        .addEventListener(
            "click",
            nextQuestion
        );


    $("flagBtn")
        .addEventListener(
            "click",
            toggleFlag
        );


    $("jumpUnansweredBtn")
        .addEventListener(
            "click",
            jumpToUnanswered
        );


    $("submitBtn")
        .addEventListener(
            "click",
            openSubmitConfirm
        );


    $("cancelSubmitBtn")
        .addEventListener(
            "click",
            closeSubmitConfirm
        );


    $("confirmSubmitBtn")
        .addEventListener(
            "click",
            submitQuiz
        );


    $("retryWrongBtn")
        .addEventListener(
            "click",
            retryWrong
        );


    $("sidebarNewQuizBtn")
        .addEventListener(
            "click",
            startNewQuiz
        );


    $("newQuizBtn")
        .addEventListener(
            "click",
            startNewQuiz
        );


    $("closeResultBtn")
        .addEventListener(
            "click",
            closeResult
        );


    $("resultHomeBtn")
        .addEventListener(
            "click",
            () => {

                closeResult();

                goHome();

            }
        );


    $("exitQuizBtn")
        .addEventListener(
            "click",
            () =>
                requestExit(
                    "exercise"
                )
        );


    $("quizHomeBtn")
        .addEventListener(
            "click",
            () =>
                requestExit(
                    "home"
                )
        );


    $("cancelExitBtn")
        .addEventListener(
            "click",
            closeExitConfirm
        );


    $("confirmExitBtn")
        .addEventListener(
            "click",
            executeExit
        );


    document
        .querySelectorAll(
            ".review-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        setReviewFilter(
                            button.dataset.review
                        )
                );

            }
        );

}


/* =========================================================
   PREPARE TEST
========================================================= */

function prepareTest() {

    if (
        !selectedSubject
    ) {

        showToast(
            "Hãy chọn môn học.",
            "warning"
        );

        return;

    }


    if (
        isSetManagedSubject(
            selectedSubject
        )
        &&
        !selectedQuestionSet
    ) {

        showToast(
            `Hãy chọn một bộ trắc nghiệm ${selectedSubject}.`,
            "warning"
        );

        return;

    }


    const questions =
        createRandomTest();


    if (
        !questions.length
    ) {

        showToast(
            "Bộ này chưa có câu hỏi.",
            "warning"
        );

        return;

    }


    showLoading(
        "Đang chuẩn bị bài thi",
        `Random ${questions.length} câu hỏi...`
    );


    setTimeout(
        () => {

            hideLoading();

            startQuizWithQuestions(
                questions
            );

        },
        400
    );

}


/* =========================================================
   START QUIZ
========================================================= */

function startQuizWithQuestions(
    questions
) {

    clearInterval(
        timerInterval
    );


    quizQuestions =
        [
            ...questions
        ];


    currentQuestion =
        0;


    userAnswers =
        new Array(
            quizQuestions.length
        ).fill(
            null
        );


    flaggedQuestions =
        new Set();


    wrongQuestions =
        [];


    isSubmitted =
        false;


    reviewFilter =
        "all";


    quizStartedAt =
        Date.now();


    $("quizSubject")
        .textContent =
        getCurrentSelectionLabel();


    $("quizTopSubject")
        .textContent =
        getCurrentSelectionLabel();


    $("quizInfoText")
        .textContent =
        `${quizQuestions.length} câu • ${
            selectedTimeMinutes === 0
                ? "Không giới hạn thời gian"
                : `${selectedTimeMinutes} phút`
        }`;


    $("sidebarScore")
        .classList.remove(
            "show"
        );


    $("reviewTools")
        .classList.remove(
            "show"
        );


    $("retryWrongBtn")
        .classList.remove(
            "show"
        );


    $("sidebarNewQuizBtn")
        .classList.remove(
            "show"
        );


    $("submitBtn")
        .style.display =
        "block";


    $("jumpUnansweredBtn")
        .style.display =
        "block";


    createQuestionGrid();

    resetReviewButtons();

    updateQuestionLegend();

    showPage(
        quizPage
    );

    showQuestion();

    startTimer();

}


/* =========================================================
   NEW QUIZ
========================================================= */

function startNewQuiz() {

    closeResult();

    const questions =
        createRandomTest();


    if (
        !questions.length
    ) {

        return;

    }


    startQuizWithQuestions(
        questions
    );

}


/* =========================================================
   SHOW QUESTION
========================================================= */

function showQuestion() {

    if (
        !quizQuestions.length
    ) {

        return;

    }


    const question =
        quizQuestions[
            currentQuestion
        ];


    const letters =
        "ABCDEFGH".split(
            ""
        );


    $("questionNumber")
        .textContent =
        `CÂU ${currentQuestion + 1}`;


    $("questionText")
        .textContent =
        question.question;


    const area =
        $("answersArea");


    area.innerHTML =
        "";


    question.answers.forEach(
        (
            answer,
            index
        ) => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "answer";


            if (
                userAnswers[
                    currentQuestion
                ]
                ===
                index
            ) {

                button.classList.add(
                    "selected"
                );

            }


            if (
                isSubmitted
            ) {

                button.disabled =
                    true;


                if (
                    index ===
                    question.correct
                ) {

                    button.classList.add(
                        "correct"
                    );

                }


                if (
                    userAnswers[
                        currentQuestion
                    ]
                    ===
                    index
                    &&
                    index !==
                    question.correct
                ) {

                    button.classList.add(
                        "incorrect"
                    );

                }

            }


            button.innerHTML =
                `
                <span class="answer-letter">
                    ${
                        letters[index]
                        ||
                        index + 1
                    }
                </span>

                <span>
                    ${escapeHtml(answer)}
                </span>
                `;


            if (
                !isSubmitted
            ) {

                button.addEventListener(
                    "click",
                    () =>
                        selectAnswer(
                            index
                        )
                );

            }


            area.appendChild(
                button
            );

        }
    );


    const flagged =
        flaggedQuestions.has(
            currentQuestion
        );


    $("flagBtn")
        .classList.toggle(
            "active",
            flagged
        );


    $("flagBtn")
        .textContent =
        flagged
            ? "⭐ Đã đánh dấu"
            : "⭐ Đánh dấu";


    if (
        isSubmitted
    ) {

        showExplanation();

    }

    else {

        $("answerExplanation")
            .classList.remove(
                "show"
            );

    }


    updateQuizNavigation();

    updateProgress();

    updateQuestionGrid();

}


/* =========================================================
   SELECT ANSWER
========================================================= */

function selectAnswer(
    index
) {

    if (
        isSubmitted
    ) {

        return;

    }


    userAnswers[
        currentQuestion
    ] =
        index;


    showQuestion();

}


/* =========================================================
   FLAG
========================================================= */

function toggleFlag() {

    if (
        flaggedQuestions.has(
            currentQuestion
        )
    ) {

        flaggedQuestions.delete(
            currentQuestion
        );

    }

    else {

        flaggedQuestions.add(
            currentQuestion
        );

    }


    showQuestion();

}


/* =========================================================
   NAV
========================================================= */

function getVisibleIndexes() {

    const indexes =
        quizQuestions.map(
            (
                item,
                index
            ) =>
                index
        );


    if (
        !isSubmitted
        ||
        reviewFilter ===
        "all"
    ) {

        return indexes;

    }


    if (
        reviewFilter ===
        "wrong"
    ) {

        return indexes.filter(
            index =>
                userAnswers[index]
                ===
                null
                ||
                userAnswers[index]
                !==
                quizQuestions[index]
                    .correct
        );

    }


    if (
        reviewFilter ===
        "flagged"
    ) {

        return indexes.filter(
            index =>
                flaggedQuestions.has(
                    index
                )
        );

    }


    return indexes;

}


/* =========================================================
   NEXT
========================================================= */

function nextQuestion() {

    const indexes =
        getVisibleIndexes();


    const position =
        indexes.indexOf(
            currentQuestion
        );


    if (
        position >= 0
        &&
        position <
        indexes.length - 1
    ) {

        currentQuestion =
            indexes[
                position + 1
            ];


        showQuestion();

    }

}


/* =========================================================
   PREVIOUS
========================================================= */

function previousQuestion() {

    const indexes =
        getVisibleIndexes();


    const position =
        indexes.indexOf(
            currentQuestion
        );


    if (
        position > 0
    ) {

        currentQuestion =
            indexes[
                position - 1
            ];


        showQuestion();

    }

}


/* =========================================================
   NAV STATE
========================================================= */

function updateQuizNavigation() {

    const indexes =
        getVisibleIndexes();


    const position =
        indexes.indexOf(
            currentQuestion
        );


    $("prevBtn")
        .disabled =
        position <= 0;


    $("nextBtn")
        .disabled =
        position < 0
        ||
        position >=
        indexes.length - 1;

}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgress() {

    const total =
        quizQuestions.length;


    const answered =
        userAnswers.filter(
            value =>
                value !== null
        ).length;


    const percent =
        total
            ? Math.round(
                answered /
                total *
                100
            )
            : 0;


    $("progressText")
        .textContent =
        `Câu ${currentQuestion + 1} / ${total}`;


    $("progressPercent")
        .textContent =
        `${percent}%`;


    $("progressValue")
        .style.width =
        `${percent}%`;


    $("answeredStatus")
        .textContent =
        `Đã làm ${answered}/${total} • Còn ${total - answered} câu`;

}


/* =========================================================
   CREATE GRID
========================================================= */

function createQuestionGrid() {

    const grid =
        $("questionGrid");


    grid.innerHTML =
        "";


    quizQuestions.forEach(
        (
            question,
            index
        ) => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "q-number";


            button.textContent =
                index + 1;


            button.addEventListener(
                "click",
                () => {

                    currentQuestion =
                        index;


                    showQuestion();

                }
            );


            grid.appendChild(
                button
            );

        }
    );

}


/* =========================================================
   UPDATE GRID
========================================================= */

function updateQuestionGrid() {

    $("questionGrid")
        .querySelectorAll(
            ".q-number"
        )
        .forEach(
            (
                button,
                index
            ) => {

                button.className =
                    "q-number";


                if (
                    isSubmitted
                    &&
                    reviewFilter ===
                    "wrong"
                    &&
                    userAnswers[index]
                    ===
                    quizQuestions[index]
                        .correct
                ) {

                    button.classList.add(
                        "grid-hidden"
                    );

                }


                if (
                    isSubmitted
                    &&
                    reviewFilter ===
                    "flagged"
                    &&
                    !flaggedQuestions.has(
                        index
                    )
                ) {

                    button.classList.add(
                        "grid-hidden"
                    );

                }


                if (
                    !isSubmitted
                    &&
                    userAnswers[index]
                    !==
                    null
                ) {

                    button.classList.add(
                        "answered"
                    );

                }


                if (
                    flaggedQuestions.has(
                        index
                    )
                ) {

                    button.classList.add(
                        "flagged"
                    );

                }


                if (
                    isSubmitted
                ) {

                    if (
                        userAnswers[index]
                        ===
                        null
                    ) {

                        button.classList.add(
                            "blank-result"
                        );

                    }

                    else if (
                        userAnswers[index]
                        ===
                        quizQuestions[index]
                            .correct
                    ) {

                        button.classList.add(
                            "correct-result"
                        );

                    }

                    else {

                        button.classList.add(
                            "wrong-result"
                        );

                    }

                }


                if (
                    index ===
                    currentQuestion
                ) {

                    button.classList.add(
                        "current"
                    );

                }

            }
        );

}


/* =========================================================
   LEGEND
========================================================= */

function updateQuestionLegend() {

    if (
        isSubmitted
    ) {

        $("questionLegend")
            .innerHTML =
            `
            <div class="legend-item">
                <span class="legend-dot legend-correct"></span>
                Đúng
            </div>

            <div class="legend-item">
                <span class="legend-dot legend-wrong"></span>
                Sai
            </div>

            <div class="legend-item">
                <span class="legend-dot legend-blank"></span>
                Trống
            </div>

            <div class="legend-item">
                <span class="legend-dot legend-flagged"></span>
                Đánh dấu
            </div>
            `;

    }

    else {

        $("questionLegend")
            .innerHTML =
            `
            <div class="legend-item">
                <span class="legend-dot legend-current"></span>
                Đang xem
            </div>

            <div class="legend-item">
                <span class="legend-dot legend-answered"></span>
                Đã làm
            </div>

            <div class="legend-item">
                <span class="legend-dot legend-flagged"></span>
                Đánh dấu
            </div>
            `;

    }

}


/* =========================================================
   JUMP UNANSWERED
========================================================= */

function jumpToUnanswered() {

    let index =
        -1;


    for (
        let i =
            currentQuestion + 1;

        i < userAnswers.length;

        i++
    ) {

        if (
            userAnswers[i]
            ===
            null
        ) {

            index =
                i;

            break;

        }

    }


    if (
        index === -1
    ) {

        index =
            userAnswers.findIndex(
                value =>
                    value === null
            );

    }


    if (
        index === -1
    ) {

        showToast(
            "Bạn đã làm tất cả câu hỏi.",
            "success"
        );

        return;

    }


    currentQuestion =
        index;


    showQuestion();

}


/* =========================================================
   TIMER
========================================================= */

function startTimer() {

    clearInterval(
        timerInterval
    );


    $("timer")
        .classList.remove(
            "warning",
            "danger"
        );


    if (
        selectedTimeMinutes ===
        0
    ) {

        $("timerText")
            .textContent =
            "∞";

        return;

    }


    timeRemaining =
        selectedTimeMinutes *
        60;


    updateTimer();


    timerInterval =
        setInterval(
            () => {

                timeRemaining--;


                updateTimer();


                if (
                    timeRemaining <= 0
                ) {

                    clearInterval(
                        timerInterval
                    );


                    submitQuiz();

                }

            },
            1000
        );

}


/* =========================================================
   UPDATE TIMER
========================================================= */

function updateTimer() {

    const minutes =
        Math.floor(
            timeRemaining / 60
        );


    const seconds =
        timeRemaining % 60;


    $("timerText")
        .textContent =
        `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;


    $("timer")
        .classList.remove(
            "warning",
            "danger"
        );


    if (
        timeRemaining <= 60
    ) {

        $("timer")
            .classList.add(
                "danger"
            );

    }

    else if (
        timeRemaining <= 300
    ) {

        $("timer")
            .classList.add(
                "warning"
            );

    }

}


/* =========================================================
   SUBMIT
========================================================= */

function openSubmitConfirm() {

    const blank =
        userAnswers.filter(
            answer =>
                answer === null
        ).length;


    $("submitConfirmMessage")
        .textContent =
        blank
            ? `Bạn còn ${blank} câu chưa trả lời. Vẫn muốn nộp bài?`
            : "Bạn đã hoàn thành tất cả câu hỏi. Nộp bài ngay?";


    $("submitConfirmModal")
        .classList.add(
            "show"
        );

}


function closeSubmitConfirm() {

    $("submitConfirmModal")
        .classList.remove(
            "show"
        );

}


function submitQuiz() {

    if (
        isSubmitted
        ||
        !quizQuestions.length
    ) {

        return;

    }


    closeSubmitConfirm();


    clearInterval(
        timerInterval
    );


    isSubmitted =
        true;


    let correct = 0;
    let wrong = 0;
    let blank = 0;


    wrongQuestions =
        [];


    quizQuestions.forEach(
        (
            question,
            index
        ) => {

            const answer =
                userAnswers[
                    index
                ];


            if (
                answer === null
            ) {

                blank++;

                wrongQuestions.push(
                    question
                );

            }

            else if (
                answer ===
                question.correct
            ) {

                correct++;

            }

            else {

                wrong++;

                wrongQuestions.push(
                    question
                );

            }

        }
    );


    const total =
        quizQuestions.length;


    const percent =
        Math.round(
            correct /
            total *
            100
        );


    const score =
        (
            correct /
            total *
            10
        ).toFixed(
            1
        );


    const tier =
        getScoreTier(
            Number(
                score
            )
        );


    const elapsed =
        Math.floor(
            (
                Date.now()
                -
                quizStartedAt
            )
            /
            1000
        );


    const gradient =
        createScoreGradient(
            percent
        );


    $("circlePercent")
        .textContent =
        `${percent}%`;


    $("circleScore")
        .textContent =
        `${score} điểm`;


    $("sidebarFraction")
        .textContent =
        `${correct} / ${total} câu đúng`;


    applyTier(
        $("sidebarTier"),
        tier
    );


    $("correctCount")
        .textContent =
        correct;


    $("wrongCount")
        .textContent =
        wrong;


    $("blankCount")
        .textContent =
        blank;


    $("resultTime")
        .textContent =
        `⏱ ${formatDuration(elapsed)}`;


    $("scoreCircle")
        .style.background =
        gradient;


    $("modalPercent")
        .textContent =
        `${percent}%`;


    $("scoreText")
        .textContent =
        `${score} điểm`;


    $("modalScoreFraction")
        .textContent =
        `${correct} / ${total} câu đúng`;


    applyTier(
        $("modalTier"),
        tier
    );


    $("modalCorrect")
        .textContent =
        correct;


    $("modalWrong")
        .textContent =
        wrong;


    $("modalBlank")
        .textContent =
        blank;


    $("bigScoreCircle")
        .style.background =
        gradient;


    $("resultMessage")
        .textContent =
        getResultMessage(
            percent
        );


    $("sidebarScore")
        .classList.add(
            "show"
        );


    $("reviewTools")
        .classList.add(
            "show"
        );


    $("sidebarNewQuizBtn")
        .classList.add(
            "show"
        );


    if (
        wrongQuestions.length
    ) {

        $("retryWrongBtn")
            .classList.add(
                "show"
            );

    }


    $("submitBtn")
        .style.display =
        "none";


    $("jumpUnansweredBtn")
        .style.display =
        "none";


    updateQuestionLegend();

    updateQuestionGrid();

    showQuestion();


    $("resultModal")
        .classList.add(
            "show"
        );


    createConfetti(
        percent
    );

}


/* =========================================================
   SCORE
========================================================= */

function getScoreTier(
    score
) {

    if (
        score >= 9
    ) {

        return {

            label:
                "🏆 Xuất sắc",

            color:
                "#267a5a",

            background:
                "#e7f9f1"

        };

    }


    if (
        score >= 8
    ) {

        return {

            label:
                "✨ Tốt",

            color:
                "#3e6ba5",

            background:
                "#edf4ff"

        };

    }


    if (
        score >= 6.5
    ) {

        return {

            label:
                "💜 Khá",

            color:
                "#7054b2",

            background:
                "#eee9ff"

        };

    }


    if (
        score >= 5
    ) {

        return {

            label:
                "🌟 Trung bình",

            color:
                "#80600e",

            background:
                "#fff5d8"

        };

    }


    return {

        label:
            "📚 Cần ôn lại",

        color:
            "#b23d50",

        background:
            "#ffedf0"

    };

}


function applyTier(
    element,
    tier
) {

    element.textContent =
        tier.label;


    element.style.color =
        tier.color;


    element.style.background =
        tier.background;

}


function createScoreGradient(
    percent
) {

    const degree =
        percent * 3.6;


    return `
        conic-gradient(
            #4fc895 0deg,
            #9877ef ${degree}deg,
            #eee4e8 ${degree}deg,
            #eee4e8 360deg
        )
    `;

}


function getResultMessage(
    percent
) {

    if (
        percent >= 90
    ) {

        return "Xuất sắc! Kiến thức của bạn đang rất chắc chắn.";

    }


    if (
        percent >= 80
    ) {

        return "Kết quả rất tốt. Tiếp tục duy trì nhé.";

    }


    if (
        percent >= 65
    ) {

        return "Kết quả khá. Hãy xem lại một số câu sai.";

    }


    if (
        percent >= 50
    ) {

        return "Hãy luyện lại các câu chưa đúng để nhớ lâu hơn.";

    }


    return "Nên đọc kỹ phần giải thích rồi luyện lại câu sai.";

}


function closeResult() {

    $("resultModal")
        .classList.remove(
            "show"
        );

}


/* =========================================================
   EXPLANATION
========================================================= */

function showExplanation() {

    const question =
        quizQuestions[
            currentQuestion
        ];


    const letters =
        "ABCDEFGH".split(
            ""
        );


    $("answerExplanation")
        .classList.add(
            "show"
        );


    $("correctAnswerText")
        .textContent =
        `Đáp án đúng: ${
            letters[
                question.correct
            ]
            ||
            question.correct + 1
        }. ${
            question.answers[
                question.correct
            ]
        }`;


    $("explanationText")
        .textContent =
        question.explanation
        ||
        "Chưa có giải thích.";


    const list =
        $("answerDetailList");


    list.innerHTML =
        "";


    question
        .explanationAnswers
        .forEach(
            (
                detail,
                index
            ) => {

                if (
                    !detail
                ) {

                    return;

                }


                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "answer-detail-item";


                element.innerHTML =
                    `
                    <strong>
                        ${
                            letters[index]
                            ||
                            index + 1
                        }.
                    </strong>

                    ${escapeHtml(detail)}
                    `;


                list.appendChild(
                    element
                );

            }
        );

}


/* =========================================================
   REVIEW
========================================================= */

function setReviewFilter(
    filter
) {

    document
        .querySelectorAll(
            ".review-btn"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.review ===
                    filter
                );

            }
        );


    reviewFilter =
        filter;


    const indexes =
        getVisibleIndexes();


    if (
        !indexes.length
    ) {

        showToast(
            "Không có câu hỏi trong bộ lọc này.",
            "info"
        );


        resetReviewButtons();

        updateQuestionGrid();

        return;

    }


    currentQuestion =
        indexes[
            0
        ];


    showQuestion();

}


function resetReviewButtons() {

    reviewFilter =
        "all";


    document
        .querySelectorAll(
            ".review-btn"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.review ===
                    "all"
                );

            }
        );

}


function retryWrong() {

    if (
        !wrongQuestions.length
    ) {

        return;

    }


    const questions =
        shuffleArray(
            wrongQuestions
        )
        .map(
            randomizeAnswers
        );


    startQuizWithQuestions(
        questions
    );

}


/* =========================================================
   EXIT
========================================================= */

function requestExit(
    target
) {

    exitTarget =
        target;


    if (
        quizQuestions.length
        &&
        !isSubmitted
    ) {

        $("exitConfirmModal")
            .classList.add(
                "show"
            );

        return;

    }


    executeExit();

}


function closeExitConfirm() {

    $("exitConfirmModal")
        .classList.remove(
            "show"
        );

}


function executeExit() {

    clearInterval(
        timerInterval
    );


    closeExitConfirm();

    closeResult();


    quizQuestions =
        [];


    userAnswers =
        [];


    if (
        exitTarget ===
        "history"
    ) {

        allowQuizHistoryExit = true;

        if (window.history.state?.medquiz && Number(window.history.state.depth || 0) > 0) {
            window.history.back();
        }
        else {
            showPage(quizConfigPage || exerciseHub);
        }

        return;

    }

    if (
        exitTarget ===
        "home"
    ) {

        goHome();

    }

    else {

        showPage(
            exerciseHub
        );

    }

}


/* =========================================================
   READ
========================================================= */

function setupRead() {

    $("readQuestionsBtn")
        .addEventListener(
            "click",
            openReadMode
        );


    $("backFromReadBtn")
        .addEventListener(
            "click",
            () => appBack(quizConfigPage || exerciseHub)
        );


    $("readHomeBtn")
        .addEventListener(
            "click",
            goHome
        );


    $("readSearchInput")
        .addEventListener(
            "input",
            () => {

                readCurrentPage =
                    1;


                renderReadQuestions();

            }
        );


    $("readPrevPageBtn")
        .addEventListener(
            "click",
            () => {

                if (
                    readCurrentPage > 1
                ) {

                    readCurrentPage--;

                    renderReadQuestions();

                }

            }
        );


    $("readNextPageBtn")
        .addEventListener(
            "click",
            () => {

                const pages =
                    getReadTotalPages();


                if (
                    readCurrentPage <
                    pages
                ) {

                    readCurrentPage++;

                    renderReadQuestions();

                    /*
                        Sau khi chuyển sang trang câu hỏi tiếp theo,
                        tự động cuộn mượt về đầu trang để bắt đầu đọc
                        ngay từ câu đầu tiên của trang mới.
                    */
                    requestAnimationFrame(
                        () => {
                            window.scrollTo({
                                top: 0,
                                behavior: "smooth"
                            });
                        }
                    );

                }

            }
        );

}


function openReadMode() {

    if (
        !selectedSubject
    ) {

        showToast(
            "Hãy chọn môn.",
            "warning"
        );

        return;

    }


    if (
        isSetManagedSubject(
            selectedSubject
        )
        &&
        !selectedQuestionSet
    ) {

        showToast(
            `Hãy chọn một bộ trắc nghiệm ${selectedSubject}.`,
            "warning"
        );

        return;

    }


    if (
        !getQuestions().length
    ) {

        showToast(
            "Bộ này chưa có câu hỏi.",
            "warning"
        );

        return;

    }


    $("readSubject")
        .textContent =
        getCurrentSelectionLabel();


    $("readSearchInput")
        .value =
        "";


    readCurrentPage =
        1;


    showPage(
        readPage
    );


    renderReadQuestions();

}


function getFilteredReadQuestions() {

    let questions =
        getQuestions();


    const keyword =
        normalizeText(
            $("readSearchInput")
                .value
        );


    if (
        keyword
    ) {

        questions =
            questions.filter(
                question => {

                    const content =
                        normalizeText(
                            question.question
                            +
                            " "
                            +
                            question.answers.join(
                                " "
                            )
                            +
                            " "
                            +
                            question.explanation
                            +
                            " "
                            +
                            question.explanationAnswers.join(
                                " "
                            )
                        );


                    return content.includes(
                        keyword
                    );

                }
            );

    }


    return questions;

}


function getReadTotalPages() {

    return Math.max(
        1,
        Math.ceil(
            getFilteredReadQuestions()
                .length
            /
            READ_PAGE_SIZE
        )
    );

}


function renderReadQuestions() {

    const questions =
        getFilteredReadQuestions();


    const total =
        questions.length;


    const pages =
        Math.max(
            1,
            Math.ceil(
                total /
                READ_PAGE_SIZE
            )
        );


    readCurrentPage =
        Math.min(
            Math.max(
                readCurrentPage,
                1
            ),
            pages
        );


    const start =
        (
            readCurrentPage - 1
        )
        *
        READ_PAGE_SIZE;


    const current =
        questions.slice(
            start,
            start +
            READ_PAGE_SIZE
        );


    $("readResultCount")
        .textContent =
        `${total} câu`;


    $("readPageIndicator")
        .textContent =
        `${readCurrentPage} / ${pages}`;


    $("readPrevPageBtn")
        .disabled =
        readCurrentPage <= 1;


    $("readNextPageBtn")
        .disabled =
        readCurrentPage >=
        pages;


    $("readPagination")
        .style.display =
        total
            ? "grid"
            : "none";


    const list =
        $("readList");


    list.innerHTML =
        "";


    if (
        !current.length
    ) {

        list.innerHTML =
            `
            <div class="book-empty">
                <span>
                    🔎
                </span>

                <h3>
                    Không tìm thấy câu hỏi
                </h3>
            </div>
            `;

        return;

    }


    const letters =
        "ABCDEFGH".split(
            ""
        );


    current.forEach(
        question => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "read-card";


            const answers =
                question.answers
                    .map(
                        (
                            answer,
                            index
                        ) => {

                            const detail =
                                question
                                    .explanationAnswers[
                                        index
                                    ]
                                ||
                                "";


                            return `
                                <div
                                    class="read-answer ${
                                        index ===
                                        question.correct
                                            ? "correct"
                                            : ""
                                    }"
                                >

                                    <strong>
                                        ${
                                            letters[index]
                                            ||
                                            index + 1
                                        }.
                                    </strong>

                                    ${escapeHtml(answer)}

                                    ${
                                        index ===
                                        question.correct
                                            ? " ✓"
                                            : ""
                                    }

                                    ${
                                        detail
                                            ?
                                            `
                                            <div class="read-answer-detail">
                                                ${escapeHtml(detail)}
                                            </div>
                                            `
                                            :
                                            ""
                                    }

                                </div>
                            `;

                        }
                    )
                    .join(
                        ""
                    );


            card.innerHTML =
                `
                <div class="read-index">
                    CÂU ${question.sourceIndex}
                </div>

                <div class="read-question">
                    ${escapeHtml(question.question)}
                </div>

                ${answers}

                <div class="read-explanation">

                    <strong>
                        💡 Giải thích:
                    </strong>

                    <br>

                    ${
                        escapeHtml(
                            question.explanation
                            ||
                            "Chưa có giải thích."
                        )
                    }

                </div>
                `;


            list.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   GOOGLE DRIVE
========================================================= */

function extractGoogleDriveId(
    value
) {

    const text =
        String(
            value || ""
        ).trim();


    if (
        !text
    ) {

        return "";

    }


    let match =
        text.match(
            /\/file\/d\/([a-zA-Z0-9_-]+)/
        );


    if (
        match
    ) {

        return match[
            1
        ];

    }


    match =
        text.match(
            /[?&]id=([a-zA-Z0-9_-]+)/
        );


    if (
        match
    ) {

        return match[
            1
        ];

    }


    if (
        /^[a-zA-Z0-9_-]{15,}$/
            .test(
                text
            )
        &&
        !text.includes(
            "/"
        )
    ) {

        return text;

    }


    return "";

}


function getGoogleDriveUrls(
    url
) {

    const id =
        extractGoogleDriveId(
            url
        );


    if (
        !id
    ) {

        return {

            id:
                "",

            previewUrl:
                "",

            viewUrl:
                "",

            downloadUrl:
                ""

        };

    }


    return {

        id,

        previewUrl:
            `https://drive.google.com/file/d/${id}/preview`,

        viewUrl:
            `https://drive.google.com/file/d/${id}/view`,

        downloadUrl:
            `https://drive.google.com/uc?export=download&id=${id}`

    };

}


/* =========================================================
   RESOURCE
========================================================= */

function getResources(
    type
) {

    const data =
        window.medQuizResources[
            type
        ];


    return Array.isArray(
        data
    )
        ? data
        : [];

}


function normalizeResource(
    resource,
    index
) {

    if (
        !resource
        ||
        typeof resource !==
        "object"
    ) {

        return null;

    }


    const title =
        String(
            resource.title
            ||
            `Tài liệu ${index + 1}`
        );


    const cover =
        String(
            resource.cover
            ||
            ""
        );


    const googleDriveUrl =
        String(
            resource.googleDriveUrl
            ||
            resource.url
            ||
            resource.source?.url
            ||
            ""
        );


    const drive =
        getGoogleDriveUrls(
            googleDriveUrl
        );


    return {

        title,

        cover,

        googleDriveUrl,

        fileId:
            drive.id,

        previewUrl:
            drive.previewUrl,

        viewUrl:
            drive.viewUrl,

        downloadUrl:
            drive.downloadUrl

    };

}


function updateResourceCounts() {

    const books =
        getResources(
            "Sách Tham Khảo"
        ).length;


    const slides =
        getResources(
            "Slide Tham Khảo"
        ).length;


    $("bookCount")
        .textContent =
        `${books} sách`;


    $("slideCount")
        .textContent =
        `${slides} tài liệu`;


    updateHomeResourceTotal();

}


/* =========================================================
   RESOURCE UI
========================================================= */

function setupResources() {

    $("bookResourceBtn")
        .addEventListener(
            "click",
            () =>
                openResourceType(
                    "Sách Tham Khảo"
                )
        );


    $("slideResourceBtn")
        .addEventListener(
            "click",
            () =>
                openResourceType(
                    "Slide Tham Khảo"
                )
        );


    $("backToResourcesBtn")
        .addEventListener(
            "click",
            () => appBack(resourceHub)
        );


    $("resourceListHomeBtn")
        .addEventListener(
            "click",
            goHome
        );


    $("resourceSearchInput")
        .addEventListener(
            "input",
            renderResourceList
        );


    $("resourceClearSearchBtn")
        .addEventListener(
            "click",
            () => {

                $("resourceSearchInput")
                    .value =
                    "";


                renderResourceList();

            }
        );


    $("viewerCloseBtn")
        .addEventListener(
            "click",
            closeResourceViewer
        );


    $("viewerFullBtn")
        .addEventListener(
            "click",
            toggleViewerFullscreen
        );


    $("resourceIframe")
        .addEventListener(
            "load",
            () => {

                $("viewerLoading")
                    .classList.remove(
                        "show"
                    );

            }
        );


    $("resourceViewerModal")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("resourceViewerModal")
                ) {

                    closeResourceViewer();

                }

            }
        );

}


function openResourceType(
    type
) {

    currentResourceType =
        type;


    $("resourceListTitle")
        .textContent =
        type;


    $("resourceListIcon")
        .textContent =
        type ===
        "Sách Tham Khảo"
            ? "📘"
            : "🖥️";


    $("resourceSearchInput")
        .value =
        "";


    showPage(
        resourceListPage
    );


    renderResourceList();

}


function getFilteredResources() {

    const keyword =
        normalizeText(
            $("resourceSearchInput")
                .value
        );


    return getResources(
        currentResourceType
    )
        .map(
            normalizeResource
        )
        .filter(
            Boolean
        )
        .filter(
            resource =>
                !keyword
                ||
                normalizeText(
                    resource.title
                ).includes(
                    keyword
                )
        );

}


function renderResourceList() {

    const resources =
        getFilteredResources();


    const isBook =
        currentResourceType ===
        "Sách Tham Khảo";


    $("resourceResultCount")
        .textContent =
        `${resources.length} ${
            isBook
                ? "sách"
                : "tài liệu"
        }`;


    const list =
        $("resourceList");


    list.innerHTML =
        "";


    if (
        !resources.length
    ) {

        list.innerHTML =
            `
            <div class="book-empty">
                <span>
                    📚
                </span>

                <h3>
                    Chưa có tài liệu
                </h3>
            </div>
            `;

        return;

    }


    resources.forEach(
        (
            book,
            index
        ) => {

            const row =
                document.createElement(
                    "article"
                );


            row.className =
                "book-row";


            row.style.animationDelay =
                `${Math.min(
                    index * .05,
                    .3
                )}s`;


            const theme =
                (
                    index % 4
                )
                +
                1;


            let coverHtml;


            if (
                book.cover
            ) {

                coverHtml =
                    `
                    <img
                        src="${escapeHtml(book.cover)}"
                        alt="${escapeHtml(book.title)}"
                    >
                    `;

            }

            else {

                coverHtml =
                    `
                    <div class="default-book-cover">

                        <span class="default-cover-icon">
                            ${
                                isBook
                                    ? "📘"
                                    : "🖥️"
                            }
                        </span>

                        <strong>
                            ${escapeHtml(book.title)}
                        </strong>

                        <small>
                            ⚕️
                        </small>

                    </div>
                    `;

            }


            row.innerHTML =
                `
                <div
                    class="book-cover-wrapper ${
                        theme > 1
                            ? `theme-${theme}`
                            : ""
                    }"
                >

                    <div class="book-cover">
                        ${coverHtml}
                    </div>

                </div>


                <div class="book-row-main">

                    <small>
                        ${
                            isBook
                                ? "SÁCH THAM KHẢO"
                                : "SLIDE THAM KHẢO"
                        }
                    </small>

                    <h2>
                        ${escapeHtml(book.title)}
                    </h2>

                    <div class="book-line"></div>

                </div>


                <div class="book-actions">

                    <button
                        class="book-action-btn book-read-btn ripple-target"
                        type="button"
                        ${
                            book.previewUrl
                                ? ""
                                : "disabled"
                        }
                    >

                        ${
                            isBook
                                ? "📖 Đọc sách"
                                : "📖 Xem slide"
                        }

                    </button>


                    <a
                        class="book-action-btn book-download-btn"
                        href="${
                            escapeHtml(
                                book.downloadUrl
                                ||
                                "#"
                            )
                        }"
                        target="_blank"
                        rel="noopener noreferrer"
                    >

                        ${
                            isBook
                                ? "⬇ Tải sách"
                                : "⬇ Tải slide"
                        }

                    </a>

                </div>
                `;


            const readButton =
                row.querySelector(
                    ".book-read-btn"
                );


            if (
                book.previewUrl
            ) {

                readButton.addEventListener(
                    "click",
                    () =>
                        openResourceViewer(
                            book
                        )
                );

            }


            list.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   VIEWER
========================================================= */

function openResourceViewer(
    book
) {

    activeBook =
        book;


    $("viewerTitle")
        .textContent =
        book.title;


    $("viewerDownloadBtn")
        .href =
        book.downloadUrl
        ||
        "#";


    $("viewerOpenSourceBtn")
        .href =
        book.viewUrl
        ||
        "#";


    $("viewerLoading")
        .classList.add(
            "show"
        );


    $("resourceIframe")
        .src =
        book.previewUrl;


    $("resourceViewerModal")
        .classList.add(
            "show"
        );


    document.body.classList.add(
        "modal-open"
    );


    setTimeout(
        () => {

            $("viewerLoading")
                .classList.remove(
                    "show"
                );

        },
        6500
    );

}


async function closeResourceViewer() {

    if (
        document.fullscreenElement ===
        $("resourceViewerBox")
    ) {

        try {

            await document
                .exitFullscreen();

        }

        catch (
            error
        ) {}

    }


    $("resourceIframe")
        .src =
        "";


    $("resourceViewerModal")
        .classList.remove(
            "show"
        );


    $("viewerLoading")
        .classList.remove(
            "show"
        );


    document.body.classList.remove(
        "modal-open"
    );


    activeBook =
        null;

}


async function toggleViewerFullscreen() {

    try {

        if (
            document.fullscreenElement ===
            $("resourceViewerBox")
        ) {

            await document
                .exitFullscreen();

        }

        else {

            await $("resourceViewerBox")
                .requestFullscreen();

        }

    }

    catch (
        error
    ) {

        showToast(
            "Không bật được toàn màn hình.",
            "warning"
        );

    }

}


/* =========================================================
   FLASHCARD
========================================================= */

function setupFlashcards() {

    $("flashcardModeBtn")
        .addEventListener(
            "click",
            openFlashcards
        );


    $("backFromFlashcardBtn")
        .addEventListener(
            "click",
            () => appBack(quizConfigPage || exerciseHub)
        );


    $("flashcardHomeBtn")
        .addEventListener(
            "click",
            goHome
        );


    $("flashcard")
        .addEventListener(
            "click",
            flipFlashcard
        );


    $("flashPrevBtn")
        .addEventListener(
            "click",
            previousFlashcard
        );


    $("flashNextBtn")
        .addEventListener(
            "click",
            nextFlashcard
        );


    $("flashKnownBtn")
        .addEventListener(
            "click",
            toggleKnownFlashcard
        );


    $("flashShuffleBtn")
        .addEventListener(
            "click",
            shuffleFlashcards
        );


    $("flashResetBtn")
        .addEventListener(
            "click",
            resetFlashcards
        );


    $("flashSearchInput")
        .addEventListener(
            "input",
            filterFlashcards
        );

}


function normalizeFlashcard(
    card,
    index
) {

    if (
        !card
        ||
        typeof card !==
        "object"
    ) {

        return null;

    }


    const front =
        String(
            card.front
            ||
            card.word
            ||
            ""
        ).trim();


    const back =
        String(
            card.back
            ||
            card.meaning
            ||
            ""
        ).trim();


    if (
        !front
        ||
        !back
    ) {

        return null;

    }


    return {

        id:
            String(
                card.id
                ||
                `flash-${index + 1}`
            ),

        front,

        back,

        pronunciation:
            String(
                card.pronunciation
                ||
                ""
            ),

        example:
            String(
                card.example
                ||
                ""
            )

    };

}


async function openFlashcards() {

    await ensureEnglishFlashcardsLoaded();

    const raw =
        window.medQuizFlashcards[
            "Tiếng Anh"
        ];


    flashcards =
        Array.isArray(
            raw
        )
            ? raw
                .map(
                    normalizeFlashcard
                )
                .filter(
                    Boolean
                )
            : [];


    filteredFlashcards =
        [
            ...flashcards
        ];


    flashCurrentIndex =
        0;


    knownFlashcards =
        new Set();


    $("flashSearchInput")
        .value =
        "";


    showPage(
        flashcardPage
    );


    renderFlashcard();

}


function renderFlashcard() {

    const total =
        filteredFlashcards.length;


    if (
        !total
    ) {

        $("flashFrontText")
            .textContent =
            "Chưa có flashcard";


        $("flashFrontHint")
            .textContent =
            "Thêm dữ liệu vào flashcards/tienganh.js";


        $("flashBackText")
            .textContent =
            "";


        $("flashPronunciation")
            .textContent =
            "";


        $("flashExample")
            .textContent =
            "";


        $("flashPosition")
            .textContent =
            "Thẻ 0 / 0";


        $("flashProgressPercent")
            .textContent =
            "0%";


        $("flashProgressValue")
            .style.width =
            "0%";


        updateFlashStats();

        return;

    }


    flashCurrentIndex =
        Math.max(
            0,
            Math.min(
                flashCurrentIndex,
                total - 1
            )
        );


    const card =
        filteredFlashcards[
            flashCurrentIndex
        ];


    $("flashcard")
        .classList.remove(
            "flipped"
        );


    $("flashcard")
        .classList.toggle(
            "known",
            knownFlashcards.has(
                card.id
            )
        );


    $("flashFrontText")
        .textContent =
        card.front;


    $("flashFrontHint")
        .textContent =
        "Nhấn để xem nghĩa";


    $("flashBackText")
        .textContent =
        card.back;


    $("flashPronunciation")
        .textContent =
        card.pronunciation;


    $("flashExample")
        .textContent =
        card.example;


    $("flashExample")
        .style.display =
        card.example
            ? "block"
            : "none";


    $("flashPosition")
        .textContent =
        `Thẻ ${flashCurrentIndex + 1} / ${total}`;


    const percent =
        Math.round(
            (
                flashCurrentIndex + 1
            )
            /
            total
            *
            100
        );


    $("flashProgressPercent")
        .textContent =
        `${percent}%`;


    $("flashProgressValue")
        .style.width =
        `${percent}%`;


    $("flashPrevBtn")
        .disabled =
        flashCurrentIndex ===
        0;


    $("flashNextBtn")
        .disabled =
        flashCurrentIndex ===
        total - 1;


    const known =
        knownFlashcards.has(
            card.id
        );


    $("flashKnownBtn")
        .classList.toggle(
            "active",
            known
        );


    $("flashKnownBtn")
        .textContent =
        known
            ? "✓ Đã nhớ"
            : "○ Đánh dấu đã nhớ";


    updateFlashStats();

}


function flipFlashcard() {

    if (
        !filteredFlashcards.length
    ) {

        return;

    }


    $("flashcard")
        .classList.toggle(
            "flipped"
        );

}


function previousFlashcard() {

    if (
        flashCurrentIndex >
        0
    ) {

        flashCurrentIndex--;

        renderFlashcard();

    }

}


function nextFlashcard() {

    if (
        flashCurrentIndex <
        filteredFlashcards.length -
        1
    ) {

        flashCurrentIndex++;

        renderFlashcard();

    }

}


function toggleKnownFlashcard() {

    if (
        !filteredFlashcards.length
    ) {

        return;

    }


    const card =
        filteredFlashcards[
            flashCurrentIndex
        ];


    if (
        knownFlashcards.has(
            card.id
        )
    ) {

        knownFlashcards.delete(
            card.id
        );

    }

    else {

        knownFlashcards.add(
            card.id
        );

    }


    renderFlashcard();

}


function shuffleFlashcards() {

    if (
        !filteredFlashcards.length
    ) {

        return;

    }


    filteredFlashcards =
        shuffleArray(
            filteredFlashcards
        );


    flashCurrentIndex =
        0;


    renderFlashcard();


    showToast(
        "Đã random bộ flashcard 🔀",
        "info"
    );

}


function resetFlashcards() {

    filteredFlashcards =
        [
            ...flashcards
        ];


    flashCurrentIndex =
        0;


    knownFlashcards =
        new Set();


    $("flashSearchInput")
        .value =
        "";


    renderFlashcard();

}


function filterFlashcards() {

    const keyword =
        normalizeText(
            $("flashSearchInput")
                .value
        );


    filteredFlashcards =
        flashcards.filter(
            card => {

                const content =
                    normalizeText(
                        card.front
                        +
                        " "
                        +
                        card.back
                        +
                        " "
                        +
                        card.example
                    );


                return !keyword
                    ||
                    content.includes(
                        keyword
                    );

            }
        );


    flashCurrentIndex =
        0;


    renderFlashcard();

}


function updateFlashStats() {

    const total =
        flashcards.length;


    const known =
        knownFlashcards.size;


    $("flashTotalCount")
        .textContent =
        total;


    $("flashKnownCount")
        .textContent =
        known;


    $("flashRemainingCount")
        .textContent =
        Math.max(
            total - known,
            0
        );

}


/* =========================================================
   WORD PRACTICE - LUYỆN TỪ TIẾNG ANH
========================================================= */

function setupWordPractice() {

    $("wordPracticeModeBtn")
        .addEventListener(
            "click",
            openWordPractice
        );


    $("backFromWordPracticeBtn")
        .addEventListener(
            "click",
            () => appBack(quizConfigPage || exerciseHub)
        );


    $("wordPracticeHomeBtn")
        .addEventListener(
            "click",
            goHome
        );


    $("wordPracticeForm")
        .addEventListener(
            "submit",
            event => {

                event.preventDefault();

                checkWordPracticeAnswer();

            }
        );


    $("wordPracticeHintBtn")
        .addEventListener(
            "click",
            showWordPracticeHint
        );


    $("wordPracticeAnswerBtn")
        .addEventListener(
            "click",
            revealWordPracticeAnswer
        );


    $("wordPracticeShuffleBtn")
        .addEventListener(
            "click",
            resetWordPracticeQueue
        );


    document
        .querySelectorAll(
            "[data-word-direction]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        wordPracticeDirection =
                            button.dataset.wordDirection;


                        document
                            .querySelectorAll(
                                "[data-word-direction]"
                            )
                            .forEach(
                                item =>
                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    )
                            );


                        resetWordPracticeQueue();

                    }
                );

            }
        );

}


function getNormalizedEnglishFlashcards() {

    const raw =
        window.medQuizFlashcards[
            "Tiếng Anh"
        ];


    return Array.isArray(
        raw
    )
        ? raw
            .map(
                normalizeFlashcard
            )
            .filter(
                Boolean
            )
        : [];

}


async function openWordPractice() {

    await ensureEnglishFlashcardsLoaded();

    wordPracticeCards =
        getNormalizedEnglishFlashcards();


    wordPracticeDirection =
        "mixed";


    document
        .querySelectorAll(
            "[data-word-direction]"
        )
        .forEach(
            button =>
                button.classList.toggle(
                    "active",
                    button.dataset.wordDirection ===
                    "mixed"
                )
        );


    wordPracticeCorrectCount = 0;
    wordPracticeWrongCount = 0;
    wordPracticeAttemptCount = 0;


    showPage(
        wordPracticePage
    );


    resetWordPracticeQueue();

}


function resetWordPracticeQueue() {

    wordPracticeQueue =
        shuffleArray(
            wordPracticeCards
        );


    wordPracticeIndex = 0;


    renderWordPractice();


    if (
        wordPracticeCards.length
    ) {

        showToast(
            "Đã xáo trộn bộ Luyện từ ✨",
            "info"
        );

    }

}


function pickWordPracticeDirection() {

    if (
        wordPracticeDirection ===
        "mixed"
    ) {

        return Math.random() < .5
            ? "en-vi"
            : "vi-en";

    }


    return wordPracticeDirection;

}


function renderWordPractice() {

    const total =
        wordPracticeQueue.length;


    const input =
        $("wordPracticeInput");


    const card =
        $("wordPracticeCard");


    wordPracticeLocked = false;
    wordPracticeHintLevel = 0;


    card.classList.remove(
        "is-correct",
        "is-wrong",
        "celebrate"
    );


    input.classList.remove(
        "is-correct",
        "is-wrong"
    );


    input.value = "";


    $("wordPracticeFeedback")
        .className =
        "word-practice-feedback";


    $("wordPracticeFeedback")
        .textContent =
        "Nhập đáp án rồi nhấn Enter hoặc nút Kiểm tra.";


    $("wordPracticeHintBox")
        .classList.remove(
            "show",
            "answer-revealed"
        );


    $("wordPracticeHintBox")
        .textContent =
        "";


    if (
        !total
    ) {

        $("wordPracticePrompt")
            .textContent =
            "Chưa có từ vựng";


        $("wordPracticeDirectionLabel")
            .textContent =
            "Hãy thêm dữ liệu vào flashcards/tienganh.js";


        $("wordPracticeQuestionLabel")
            .textContent =
            "VOCABULARY";


        $("wordPracticePronunciation")
            .textContent =
            "";


        $("wordPracticeExample")
            .textContent =
            "";


        $("wordPracticeExample")
            .style.display =
            "none";


        $("wordPracticePosition")
            .textContent =
            "Từ 0 / 0";


        $("wordPracticeProgressValue")
            .style.width =
            "0%";


        input.disabled = true;


        updateWordPracticeStats();

        return;

    }


    input.disabled = false;


    if (
        wordPracticeIndex >= total
    ) {

        wordPracticeQueue =
            shuffleArray(
                wordPracticeCards
            );

        wordPracticeIndex = 0;


        showToast(
            "Hoàn thành một vòng! Bắt đầu vòng mới 🎉",
            "success"
        );

    }


    const current =
        wordPracticeQueue[
            wordPracticeIndex
        ];


    wordPracticeCurrentDirection =
        pickWordPracticeDirection();


    const isEnglishToVietnamese =
        wordPracticeCurrentDirection ===
        "en-vi";


    $("wordPracticeQuestionLabel")
        .textContent =
        isEnglishToVietnamese
            ? "ENGLISH → VIETNAMESE"
            : "VIETNAMESE → ENGLISH";


    $("wordPracticePrompt")
        .textContent =
        isEnglishToVietnamese
            ? current.front
            : current.back;


    $("wordPracticeDirectionLabel")
        .textContent =
        isEnglishToVietnamese
            ? "Hãy nhập nghĩa tiếng Việt"
            : "Hãy nhập từ / cụm từ tiếng Anh";


    $("wordPracticeInputLabel")
        .textContent =
        isEnglishToVietnamese
            ? "Nghĩa tiếng Việt của bạn"
            : "Từ tiếng Anh của bạn";


    input.placeholder =
        isEnglishToVietnamese
            ? "Nhập tiếng Việt tại đây..."
            : "Type English here...";


    $("wordPracticePronunciation")
        .textContent =
        isEnglishToVietnamese
            ? current.pronunciation
            : "";


    $("wordPracticeExample")
        .textContent =
        current.example;


    $("wordPracticeExample")
        .style.display =
        current.example
            ? "block"
            : "none";


    $("wordPracticePosition")
        .textContent =
        `Từ ${wordPracticeIndex + 1} / ${total}`;


    const percent =
        Math.round(
            wordPracticeIndex
            /
            total
            *
            100
        );


    $("wordPracticeProgressValue")
        .style.width =
        `${percent}%`;


    updateWordPracticeStats();


    setTimeout(
        () =>
            input.focus(),
        90
    );

}


function getCurrentWordPracticeCard() {

    return wordPracticeQueue[
        wordPracticeIndex
    ] || null;

}


function getWordPracticeExpectedAnswer() {

    const current =
        getCurrentWordPracticeCard();


    if (
        !current
    ) {

        return "";

    }


    return wordPracticeCurrentDirection ===
        "en-vi"
            ? current.back
            : current.front;

}


function normalizePracticeAnswer(
    value
) {

    return String(
        value || ""
    )
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/[^a-z0-9'\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


function splitPracticeAnswers(
    answer
) {

    const source =
        String(
            answer || ""
        ).trim();


    const options =
        source
            .split(/\s*(?:;|\||\/|\n|,\s*(?=[^,]{1,50}$))\s*/)
            .map(
                item => item.trim()
            )
            .filter(
                Boolean
            );


    return [
        source,
        ...options
    ];

}


function isWordPracticeAnswerCorrect(
    value,
    expected
) {

    const userValue =
        normalizePracticeAnswer(
            value
        );


    if (
        !userValue
    ) {

        return false;

    }


    return splitPracticeAnswers(
        expected
    ).some(
        option =>
            normalizePracticeAnswer(
                option
            ) === userValue
    );

}


function checkWordPracticeAnswer() {

    if (
        wordPracticeLocked
        ||
        !wordPracticeQueue.length
    ) {

        return;

    }


    const input =
        $("wordPracticeInput");


    const value =
        input.value.trim();


    if (
        !value
    ) {

        input.classList.add(
            "is-wrong"
        );


        $("wordPracticeFeedback")
            .className =
            "word-practice-feedback wrong";


        $("wordPracticeFeedback")
            .textContent =
            "Bạn chưa nhập đáp án ✍️";


        setTimeout(
            () =>
                input.classList.remove(
                    "is-wrong"
                ),
            450
        );

        return;

    }


    const expected =
        getWordPracticeExpectedAnswer();


    wordPracticeAttemptCount++;


    if (
        isWordPracticeAnswerCorrect(
            value,
            expected
        )
    ) {

        wordPracticeCorrectCount++;
        wordPracticeLocked = true;


        input.classList.remove(
            "is-wrong"
        );


        input.classList.add(
            "is-correct"
        );


        $("wordPracticeCard")
            .classList.remove(
                "is-wrong"
            );


        $("wordPracticeCard")
            .classList.add(
                "is-correct",
                "celebrate"
            );


        $("wordPracticeFeedback")
            .className =
            "word-practice-feedback correct";


        $("wordPracticeFeedback")
            .textContent =
            "Chính xác! 🌟 Đang chuyển sang từ tiếp theo...";


        updateWordPracticeStats();


        setTimeout(
            () => {

                wordPracticeIndex++;

                renderWordPractice();

            },
            850
        );

    }

    else {

        wordPracticeWrongCount++;


        input.classList.remove(
            "is-correct"
        );


        input.classList.add(
            "is-wrong"
        );


        $("wordPracticeCard")
            .classList.remove(
                "is-correct"
            );


        $("wordPracticeCard")
            .classList.add(
                "is-wrong"
            );


        $("wordPracticeFeedback")
            .className =
            "word-practice-feedback wrong";


        $("wordPracticeFeedback")
            .textContent =
            "Chưa đúng rồi 💪 Hãy nhập lại đến khi chính xác nhé!";


        updateWordPracticeStats();


        setTimeout(
            () => {

                input.classList.remove(
                    "is-wrong"
                );


                $("wordPracticeCard")
                    .classList.remove(
                        "is-wrong"
                    );


                input.select();

            },
            520
        );

    }

}


function showWordPracticeHint() {

    const expected =
        getWordPracticeExpectedAnswer();


    if (
        !expected
    ) {

        return;

    }


    wordPracticeHintLevel++;


    const clean =
        String(
            expected
        ).trim();


    const visibleCount =
        Math.min(
            Math.max(
                1,
                wordPracticeHintLevel * 2
            ),
            clean.length
        );


    const hint =
        Array.from(
            clean
        )
            .map(
                (char, index) => {

                    if (
                        /\s|[-_/(),.;:]/.test(
                            char
                        )
                    ) {

                        return char;

                    }


                    return index < visibleCount
                        ? char
                        : "•";

                }
            )
            .join("");


    const box =
        $("wordPracticeHintBox");


    box.classList.add(
        "show"
    );


    box.classList.remove(
        "answer-revealed"
    );


    box.innerHTML =
        `<strong>💡 Gợi ý:</strong> ${escapeHtml(hint)}`;

}


function revealWordPracticeAnswer() {

    const expected =
        getWordPracticeExpectedAnswer();


    if (
        !expected
    ) {

        return;

    }


    const box =
        $("wordPracticeHintBox");


    box.classList.add(
        "show",
        "answer-revealed"
    );


    box.innerHTML =
        `<strong>👀 Đáp án:</strong> ${escapeHtml(expected)}<span> — Bạn vẫn cần tự nhập đúng để qua từ tiếp theo.</span>`;


    $("wordPracticeInput")
        .focus();

}


function updateWordPracticeStats() {

    $("wordPracticeCorrectCount")
        .textContent =
        wordPracticeCorrectCount;


    $("wordPracticeWrongCount")
        .textContent =
        wordPracticeWrongCount;


    const accuracy =
        wordPracticeAttemptCount
            ? Math.round(
                wordPracticeCorrectCount
                /
                wordPracticeAttemptCount
                *
                100
            )
            : 100;


    $("wordPracticeAccuracy")
        .textContent =
        `${accuracy}%`;

}


/* =========================================================
   FULLSCREEN
========================================================= */

function setupFullscreen() {

    $("fullscreenBtn")
        .addEventListener(
            "click",
            toggleFullscreen
        );


    $("quizFullscreenBtn")
        .addEventListener(
            "click",
            toggleFullscreen
        );


    document.addEventListener(
        "fullscreenchange",
        updateFullscreenButtons
    );

}


async function toggleFullscreen() {

    try {

        if (
            !document.fullscreenElement
        ) {

            await document
                .documentElement
                .requestFullscreen();

        }

        else {

            await document
                .exitFullscreen();

        }

    }

    catch (
        error
    ) {

        showToast(
            "Không bật được toàn màn hình.",
            "warning"
        );

    }

}


function updateFullscreenButtons() {

    const active =
        Boolean(
            document.fullscreenElement
        );


    $("fullscreenIcon")
        .textContent =
        active
            ? "✕"
            : "⛶";


    $("quizFullscreenBtn")
        .textContent =
        active
            ? "✕"
            : "⛶";


    $("viewerFullBtn")
        .textContent =
        document.fullscreenElement ===
        $("resourceViewerBox")
            ? "✕ Thoát toàn màn hình"
            : "⛶ Toàn màn hình";

}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            if (
                $("resourceViewerModal")
                    .classList
                    .contains(
                        "show"
                    )
            ) {

                closeResourceViewer();

                return;

            }


            if (
                $("submitConfirmModal")
                    .classList
                    .contains(
                        "show"
                    )
            ) {

                closeSubmitConfirm();

                return;

            }


            if (
                $("exitConfirmModal")
                    .classList
                    .contains(
                        "show"
                    )
            ) {

                closeExitConfirm();

                return;

            }


            if (
                $("resultModal")
                    .classList
                    .contains(
                        "show"
                    )
            ) {

                closeResult();

                return;

            }

        }


        if (
            flashcardPage.classList.contains(
                "show"
            )
        ) {

            if (
                event.code ===
                "Space"
            ) {

                event.preventDefault();

                flipFlashcard();

            }


            if (
                event.key ===
                "ArrowLeft"
            ) {

                previousFlashcard();

            }


            if (
                event.key ===
                "ArrowRight"
            ) {

                nextFlashcard();

            }


            return;

        }


        if (
            !quizPage.classList.contains(
                "show"
            )
        ) {

            return;

        }


        if (
            event.key ===
            "ArrowLeft"
        ) {

            previousQuestion();

        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            nextQuestion();

        }


        if (
            !isSubmitted
            &&
            [
                "1",
                "2",
                "3",
                "4"
            ].includes(
                event.key
            )
        ) {

            const index =
                Number(
                    event.key
                ) - 1;


            if (
                quizQuestions[
                    currentQuestion
                ]
                &&
                index <
                quizQuestions[
                    currentQuestion
                ].answers.length
            ) {

                selectAnswer(
                    index
                );

            }

        }

    }
);


/* =========================================================
   LOADING
========================================================= */

function showLoading(
    title,
    text
) {

    $("loadingTitle")
        .textContent =
        title;


    $("loadingText")
        .textContent =
        text;


    $("loadingOverlay")
        .classList.add(
            "show"
        );

}


function hideLoading() {

    $("loadingOverlay")
        .classList.remove(
            "show"
        );

}


/* =========================================================
   SCROLL TOP
========================================================= */

function setupScrollTop() {

    window.addEventListener(
        "scroll",
        () => {

            $("scrollTopBtn")
                .classList.toggle(
                    "show",
                    window.scrollY >
                    500
                );

        }
    );


    $("scrollTopBtn")
        .addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

}


/* =========================================================
   RIPPLE
========================================================= */

function setupRipple() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    ".ripple-target"
                );


            if (
                !target
                ||
                target.disabled
            ) {

                return;

            }


            createRipple(
                target,
                event
            );

        }
    );

}


function createRipple(
    target,
    event
) {

    const rect =
        target
            .getBoundingClientRect();


    const size =
        Math.max(
            rect.width,
            rect.height
        ) * .65;


    const ripple =
        document.createElement(
            "span"
        );


    ripple.className =
        "ripple";


    ripple.style.width =
        `${size}px`;


    ripple.style.height =
        `${size}px`;


    ripple.style.left =
        `${
            event.clientX
            -
            rect.left
            -
            size / 2
        }px`;


    ripple.style.top =
        `${
            event.clientY
            -
            rect.top
            -
            size / 2
        }px`;


    target.appendChild(
        ripple
    );


    setTimeout(
        () =>
            ripple.remove(),
        600
    );

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info",
    duration = 2500
) {

    const icons = {

        success:
            "✓",

        warning:
            "⚠",

        error:
            "×",

        info:
            "✦"

    };


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.innerHTML =
        `
        <strong>
            ${
                icons[type]
                ||
                "✦"
            }
        </strong>

        <span>
            ${escapeHtml(message)}
        </span>
        `;


    $("toastContainer")
        .appendChild(
            toast
        );


    setTimeout(
        () =>
            toast.classList.add(
                "hide"
            ),
        duration
    );


    setTimeout(
        () =>
            toast.remove(),
        duration + 300
    );

}


/* =========================================================
   CONFETTI
========================================================= */

function createConfetti(
    percent
) {

    const container =
        $("confettiContainer");


    container.innerHTML =
        "";


    const count =
        percent >= 80
            ? 70
            : 35;


    const colors = [
        "#f28da8",
        "#9877ef",
        "#4cc8de",
        "#4fc895",
        "#ffc95c"
    ];


    for (
        let i = 0;

        i < count;

        i++
    ) {

        const element =
            document.createElement(
                "span"
            );


        element.className =
            "confetti";


        element.style.left =
            `${
                Math.random()
                *
                100
            }%`;


        element.style.background =
            colors[
                Math.floor(
                    Math.random()
                    *
                    colors.length
                )
            ];


        element.style.animationDuration =
            `${
                2.5
                +
                Math.random()
                *
                2
            }s`;


        element.style.animationDelay =
            `${
                Math.random()
                *
                .5
            }s`;


        container.appendChild(
            element
        );

    }


    setTimeout(
        () => {

            container.innerHTML =
                "";

        },
        5000
    );

}


/* =========================================================
   MODALS
========================================================= */

function closeAllModals() {

    $("submitConfirmModal")
        .classList.remove(
            "show"
        );


    $("exitConfirmModal")
        .classList.remove(
            "show"
        );


    $("resultModal")
        .classList.remove(
            "show"
        );


    if (
        $("resourceViewerModal")
            .classList
            .contains(
                "show"
            )
    ) {

        closeResourceViewer();

    }

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeText(
    value
) {

    return String(
        value || ""
    )
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /đ/g,
            "d"
        )
        .replace(
            /Đ/g,
            "D"
        )
        .toLowerCase()
        .trim();

}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function formatDuration(
    seconds
) {

    const minutes =
        Math.floor(
            seconds / 60
        );


    const remain =
        seconds % 60;


    return (
        String(
            minutes
        )
            .padStart(
                2,
                "0"
            )
        +
        ":"
        +
        String(
            remain
        )
            .padStart(
                2,
                "0"
            )
    );

}

/* =========================================================
   KAWAII EXPERIENCE 2026 — purely visual/interaction layer
   Does not change quiz data, scoring, timers or storage.
========================================================= */
function setupKawaiiExperience() {
    const navButtons = Array.from(document.querySelectorAll('.kawaii-nav-btn'));
    const setActive = (name) => navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.kawaiiNav === name));

    navButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.dataset.kawaiiNav;

            const quizIsActive = quizPage.classList.contains('show') && quizQuestions.length && !isSubmitted;
            if (quizIsActive) {
                if (target === 'home') { requestExit('home'); return; }
                if (target === 'exercise' || target === 'study') { requestExit('exercise'); return; }
                showToast('Hãy thoát hoặc nộp bài trước khi mở Tài liệu.', 'warning');
                return;
            }

            if (target === 'home') {
                goHome();
                setActive('home');
                return;
            }
            if (target === 'exercise' || target === 'study') {
                showPage(exerciseHub);
                setActive('exercise');
                preloadAllSubjectQuestionSets()
                    .then(updateSubjectCounts)
                    .catch(error => console.warn('Tải nền ngân hàng câu hỏi:', error));
                return;
            }
            if (target === 'resource') {
                await ensureResourceDataLoaded();
                updateResourceCounts();
                showPage(resourceHub);
                setActive('resource');
                return;
            }
            if (target === 'flashcard') {
                openFlashcards();
                setActive('flashcard');
                return;
            }
            if (target === 'word') {
                openWordPractice();
                setActive('word');
                return;
            }
        });
    });

    const sparkle = (x, y) => {
        const chars = ['✦','♡','✧','★'];
        for (let i=0; i<5; i++) {
            const s = document.createElement('span');
            s.className = 'kawaii-click-spark';
            s.textContent = chars[Math.floor(Math.random()*chars.length)];
            s.style.left = `${x + (Math.random()*34-17)}px`;
            s.style.top = `${y + (Math.random()*20-10)}px`;
            s.style.setProperty('--dx', `${Math.random()*70-35}px`);
            s.style.setProperty('--dy', `${-35-Math.random()*45}px`);
            document.body.appendChild(s);
            setTimeout(()=>s.remove(), 750);
        }
    };
    document.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button,.subject-btn,.question-set-pro-card,.portal-card,.mode-card,.answer')) sparkle(e.clientX, e.clientY);
    }, {passive:true});

    const tiltTargets = document.querySelectorAll('.subject-btn,.portal-card,.mode-card,.config-group');
    tiltTargets.forEach(el => {
        el.addEventListener('pointermove', e => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const r = el.getBoundingClientRect();
            const rx = ((e.clientY-r.top)/r.height-.5)*-2.4;
            const ry = ((e.clientX-r.left)/r.width-.5)*2.8;
            el.style.setProperty('--tilt-x', `${rx}deg`);
            el.style.setProperty('--tilt-y', `${ry}deg`);
        });
        el.addEventListener('pointerleave', () => {
            el.style.setProperty('--tilt-x','0deg');
            el.style.setProperty('--tilt-y','0deg');
        });
    });

    const observer = new MutationObserver(() => {
        document.querySelectorAll('.question-set-pro-card:not([data-kawaii-ready])').forEach((el, i) => {
            el.dataset.kawaiiReady = '1';
            el.style.animationDelay = `${Math.min(i,9)*45}ms`;
        });
    });
    if (questionSetArea) observer.observe(questionSetArea, {childList:true, subtree:true});

    const homeFlashcardBtn = document.getElementById('homeFlashcardBtn');
    if (homeFlashcardBtn) {
        homeFlashcardBtn.addEventListener('click', () => {
            openFlashcards();
            setActive('flashcard');
        });
    }

    const homeWordPracticeBtn = document.getElementById('homeWordPracticeBtn');
    if (homeWordPracticeBtn) {
        homeWordPracticeBtn.addEventListener('click', () => {
            openWordPractice();
            setActive('word');
        });
    }

    document.querySelectorAll('[data-home-subject]').forEach(tile => {
        tile.addEventListener('click', async () => {
            const subject = tile.dataset.homeSubject;
            showLoading('Đang mở môn học', `Chuẩn bị ${subject}...`);
            try {
                showPage(exerciseHub);
                await loadSubjectQuestionSets(subject);
                updateSubjectCountFor(subject);
                setActive('exercise');
                const subjectButton = document.querySelector(`.subject-btn[data-subject="${subject}"]`);
                if (subjectButton) {
                    await selectSubject(subjectButton);
                }
            } finally {
                hideLoading();
            }
        });
    });
}


/* =========================================================
   EXTRA KAWAII PAGE STATE SYNC + CARD MASCOTS
========================================================= */
(function(){
    const originalShowPage = window.showPage;
    if (typeof originalShowPage === 'function') {
        window.showPage = function(page){
            const result = originalShowPage.apply(this, arguments);
            try {
                const activeName = page && page.id === 'landingPage' ? 'home'
                    : page && page.id === 'resourceHub' ? 'resource'
                    : page && page.id === 'notebookPage' ? 'home'
                    : page && (page.id === 'exerciseHub' || page.id === 'subjectPage' || page.id === 'quizConfigPage' || page.id === 'quizPage' || page.id === 'readPage') ? 'exercise'
                    : 'home';
                document.querySelectorAll('.kawaii-nav-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.kawaiiNav === activeName || (activeName==='exercise' && btn.dataset.kawaiiNav==='study'));
                });
                if (activeName === 'exercise') {
                    document.querySelectorAll('.kawaii-nav-btn').forEach(btn => {
                        if (btn.dataset.kawaiiNav !== 'exercise' && btn.dataset.kawaiiNav !== 'study') btn.classList.remove('active');
                    });
                }
            } catch (e) {}
            return result;
        }
    }
})();


/* =========================================================
   HOME V2 QUICK ACTIONS — preserves original learning logic
========================================================= */
function setupHomeV2Actions(){
    const flash = document.getElementById('homeFlashcardBtn');
    const word = document.getElementById('homeWordPracticeBtn');
    if (flash && !flash.dataset.ready){
        flash.dataset.ready='1';
        flash.addEventListener('click', () => openFlashcards());
    }
    if (word && !word.dataset.ready){
        word.dataset.ready='1';
        word.addEventListener('click', () => openWordPractice());
    }
    document.querySelectorAll('[data-home-subject]').forEach(btn => {
        if(btn.dataset.ready) return;
        btn.dataset.ready='1';
        btn.addEventListener('click', async () => {
            const subject = btn.dataset.homeSubject;
            showLoading('Đang mở môn học', `Chuẩn bị ${subject}...`);
            try{
                showPage(exerciseHub);
                await loadSubjectQuestionSets(subject);
                updateSubjectCountFor(subject);
                const target = document.querySelector(`.subject-btn[data-subject="${subject}"]`);
                if(target) await selectSubject(target);
            } finally { hideLoading(); }
        });
    });
}
document.addEventListener('DOMContentLoaded', () => setTimeout(setupHomeV2Actions,0));


/* =========================================================
   ENGLISH-ONLY MODES GUARD
   Flashcard + Luyện từ chỉ hiện khi môn đang chọn là Tiếng Anh.
========================================================= */
(function(){
    function syncEnglishOnlyModes(){
        const isEnglish = selectedSubject === 'Tiếng Anh';
        const flash = document.getElementById('flashcardModeBtn');
        const word = document.getElementById('wordPracticeModeBtn');
        const grid = document.getElementById('modeGrid');
        if (flash) flash.classList.toggle('show', isEnglish);
        if (word) word.classList.toggle('show', isEnglish);
        if (grid) grid.classList.toggle('english-mode-grid', isEnglish);
    }
    document.addEventListener('click', function(e){
        if (e.target.closest('.subject-btn')) {
            setTimeout(syncEnglishOnlyModes, 0);
        }
    });
    document.addEventListener('DOMContentLoaded', syncEnglishOnlyModes);
})();
