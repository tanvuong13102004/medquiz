"use strict";

/* =========================================================
   TIẾNG ANH 1
   Dùng chung cho:
   1) Flashcard
   2) Luyện từ Anh ↔ Việt
   3) Trắc nghiệm 4 đáp án

   Dữ liệu gốc: 55 từ vựng
========================================================= */

(function () {
    window.medQuizQuestions = window.medQuizQuestions || {};
    window.medQuizFlashcards = window.medQuizFlashcards || {};

    const vocabulary = [
        { en: "accountant", vi: "một người chịu trách nhiệm về tiền trong một doanh nghiệp; kế toán" },
        { en: "airport", vi: "sân bay" },
        { en: "applicant", vi: "ứng viên" },
        { en: "attendant", vi: "người phục vụ" },
        { en: "bicycle", vi: "xe đạp" },
        { en: "brochure", vi: "tờ gấp quảng cáo" },
        { en: "cafeteria", vi: "quán ăn tự phục vụ" },
        { en: "caller", vi: "người đang gọi điện cho bạn" },
        { en: "candidate", vi: "ứng cử viên" },
        { en: "chef", vi: "đầu bếp" },
        { en: "clerk", vi: "nhân viên bán hàng" },
        { en: "client", vi: "khách hàng" },
        { en: "cloth", vi: "cái khăn" },
        { en: "conference", vi: "hội nghị; hội thảo" },
        { en: "correctly", vi: "một cách chính xác; đúng đắn" },
        { en: "deadline", vi: "hạn chót; thời gian cụ thể hoàn thành một nhiệm vụ hoặc công việc được giao" },
        { en: "downtown", vi: "khu vực trung tâm của thành phố" },
        { en: "e-book", vi: "sách điện tử" },
        { en: "elevator", vi: "thang máy" },
        { en: "enclose", vi: "vây quanh; rào quanh" },
        { en: "fare", vi: "tiền xe; tiền vé" },
        { en: "fax", vi: "gửi bằng máy fax" },
        { en: "goods", vi: "hàng hóa; mặt hàng" },
        { en: "infer", vi: "suy ra; phỏng đoán" },
        { en: "invoice", vi: "hóa đơn" },
        { en: "lease", vi: "thuê" },
        { en: "lobby", vi: "tiền sảnh của khách sạn" },
        { en: "logical", vi: "theo logic; hợp lý" },
        { en: "luggage", vi: "hành lý" },
        { en: "memo", vi: "giấy ghi chú" },
        { en: "mister", vi: "một cách xưng hô lịch sự với một người đàn ông" },
        { en: "noon", vi: "giữa trưa" },
        { en: "notify", vi: "thông báo; cho biết" },
        { en: "o'clock", vi: "giờ trong ngày" },
        { en: "preview", vi: "sự xem trước; sự duyệt trước" },
        { en: "publish", vi: "xuất bản; công bố; đăng tải" },
        { en: "receipt", vi: "hóa đơn" },
        { en: "reception", vi: "sự đón tiếp; tiệc chiêu đãi" },
        { en: "refund", vi: "hoàn tiền" },
        { en: "rental", vi: "sự cho thuê" },
        { en: "reservation", vi: "sự đặt trước" },
        { en: "seminar", vi: "buổi hội thảo; nghiên cứu khoa học; nghiên cứu chuyên đề; buổi báo cáo công việc" },
        { en: "shipment", vi: "sự giao hàng" },
        { en: "sincerely", vi: "một cách chân thành" },
        { en: "sometime", vi: "một lúc nào đó" },
        { en: "subscription", vi: "sự đăng ký" },
        { en: "subway", vi: "đường hầm" },
        { en: "supervisor", vi: "người giám sát" },
        { en: "technician", vi: "kỹ thuật viên" },
        { en: "traveler", vi: "khách du lịch" },
        { en: "vacation", vi: "kỳ nghỉ" },
        { en: "waiter", vi: "nhân viên phục vụ nam" },
        { en: "warranty", vi: "sự bảo hành" },
        { en: "website", vi: "trang web" },
        { en: "workshop", vi: "phân xưởng" }
    ];

    /* =====================================================
       FLASHCARD + LUYỆN TỪ
    ===================================================== */

    window.medQuizFlashcards["Tiếng Anh"] = vocabulary.map((item, index) => ({
        id: `english1-${String(index + 1).padStart(3, "0")}`,
        front: item.en,
        back: item.vi,
        pronunciation: item.pronunciation || "",
        example: item.example || ""
    }));

    /* =====================================================
       HÀM HỖ TRỢ TẠO TRẮC NGHIỆM
    ===================================================== */

    function shuffle(array) {
        const result = [...array];

        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result;
    }

    function unique(array) {
        return [...new Set(array)];
    }

    function createAnswers(correctAnswer, pool) {
        const wrongAnswers = shuffle(
            unique(pool.filter(answer => answer !== correctAnswer))
        ).slice(0, 3);

        const answers = shuffle([
            correctAnswer,
            ...wrongAnswers
        ]);

        return {
            answers,
            correct: answers.indexOf(correctAnswer)
        };
    }

    /* =====================================================
       ĐẾM NGHĨA TIẾNG VIỆT BỊ TRÙNG

       Ví dụ trong tài liệu:
       invoice = hóa đơn
       receipt = hóa đơn

       Những nghĩa bị trùng sẽ không tạo câu Việt → Anh
       để tránh có nhiều đáp án đúng.
    ===================================================== */

    const meaningCount = new Map();

    vocabulary.forEach(item => {
        const key = item.vi.trim().toLowerCase();
        meaningCount.set(key, (meaningCount.get(key) || 0) + 1);
    });

    const englishPool = vocabulary.map(item => item.en);
    const vietnamesePool = unique(vocabulary.map(item => item.vi));

    /* =====================================================
       TẠO TRẮC NGHIỆM
       - 55 câu Anh → Việt
       - Việt → Anh nếu nghĩa không bị trùng
    ===================================================== */

    const generatedQuestions = [];

    vocabulary.forEach((item, index) => {
        // Anh → Việt
        const enToVi = createAnswers(item.vi, vietnamesePool);

        generatedQuestions.push({
            id: `english1-envi-${index + 1}`,
            question: `Từ “${item.en}” có nghĩa là gì?`,
            answers: enToVi.answers,
            correct: enToVi.correct,
            explanation: `✅ ${item.en} = ${item.vi}`
        });

        // Việt → Anh
        const meaningKey = item.vi.trim().toLowerCase();
        const isUniqueMeaning = meaningCount.get(meaningKey) === 1;

        if (isUniqueMeaning) {
            const viToEn = createAnswers(item.en, englishPool);

            generatedQuestions.push({
                id: `english1-vien-${index + 1}`,
                question: `“${item.vi}” trong tiếng Anh là gì?`,
                answers: viToEn.answers,
                correct: viToEn.correct,
                explanation: `✅ ${item.vi} = ${item.en}`
            });
        }
    });

    /* =====================================================
       ĐƯA CÂU HỎI VÀO MÔN TIẾNG ANH
    ===================================================== */

    window.medQuizQuestions["Tiếng Anh"] = generatedQuestions;

    console.log(
        `✅ tienganh1.js: ${vocabulary.length} từ | ` +
        `${window.medQuizFlashcards["Tiếng Anh"].length} flashcard | ` +
        `${window.medQuizQuestions["Tiếng Anh"].length} câu trắc nghiệm`
    );
})();
