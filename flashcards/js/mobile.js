"use strict";
/* MOBILE-only shell. Keep MOBILE-specific behavior here. */
(() => {
    const root = document.documentElement;
    root.dataset.device = "mobile";

    const homeHash = () => {
        const h = (location.hash || "").trim().toLowerCase();
        return !h || h === "#" || h === "#home" || h === "#landingpage" || h === "#/home";
    };

    const fromSearch = () => {
        if (!document.referrer) return false;
        try {
            const h = new URL(document.referrer).hostname.toLowerCase();
            return ["google.", "bing.", "search.yahoo.", "duckduckgo.", "coccoc.", "baidu.", "yandex."]
                .some(x => h.includes(x));
        } catch (_) {
            return false;
        }
    };

    /* Chỉ tải lại Trang chủ mới quay về màn hình chọn giao diện. */
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if ((nav?.type === "reload" && homeHash()) || fromSearch()) {
        location.replace(`index.html${location.hash || ""}`);
        return;
    }

    /* Nút góc chỉ là trạng thái, không cho đổi trực tiếp sang PC. */
    const switchBtn = document.getElementById("deviceSwitch");
    if (switchBtn) {
        switchBtn.textContent = "📱 Điện thoại";
        switchBtn.disabled = true;
        switchBtn.classList.add("is-device-locked");
        switchBtn.dataset.currentDevice = "mobile";
        switchBtn.setAttribute("aria-label", "Giao diện hiện tại: Điện thoại. Tải lại Trang chủ để chọn lại giao diện.");
        switchBtn.setAttribute("title", "Giao diện hiện tại: Điện thoại • Tải lại Trang chủ để chọn lại");
    }
})();
