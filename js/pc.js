"use strict";
/* PC-only shell. Keep PC-specific behavior here. */
(() => {
    const root = document.documentElement;
    root.dataset.device = "pc";

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

    /*
       Chỉ cho chọn lại giao diện khi tải lại TRANG CHỦ.
       Tải lại trang con giữ nguyên luồng PC và không hiện màn hình chọn.
       Truy cập từ công cụ tìm kiếm vẫn đi qua màn hình chọn như yêu cầu cũ.
    */
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if ((nav?.type === "reload" && homeHash()) || fromSearch()) {
        location.replace(`index.html${location.hash || ""}`);
        return;
    }

    /*
       Nút góc chỉ HIỂN THỊ giao diện đã chọn, không còn là nút chuyển đổi.
       Không lưu bằng localStorage/sessionStorage/cookie.
    */
    const switchBtn = document.getElementById("deviceSwitch");
    if (switchBtn) {
        switchBtn.textContent = "🖥️ Máy tính";
        switchBtn.disabled = true;
        switchBtn.classList.add("is-device-locked");
        switchBtn.dataset.currentDevice = "pc";
        switchBtn.setAttribute("aria-label", "Giao diện hiện tại: Máy tính. Tải lại Trang chủ để chọn lại giao diện.");
        switchBtn.setAttribute("title", "Giao diện hiện tại: Máy tính • Tải lại Trang chủ để chọn lại");
    }
})();
