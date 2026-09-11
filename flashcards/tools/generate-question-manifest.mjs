import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const questionsDir = path.join(root, "questions");
const outputPath = path.join(root, "question-manifest.json");

const subjects = {
  "Nội Khoa": "noikhoa",
  "Ngoại Khoa": "ngoaikhoa",
  "Nhi Khoa": "nhikhoa",
  "Sản Phụ Khoa": "sanphukhoa",
  "Giải Phẫu": "giaiphau",
  "Sinh Lý": "sinhly",
  "Hóa Sinh": "hoasinh",
  "Các môn khác": "cacmonkhac",
  "Tiếng Anh": "tienganh"
};

function countQuestions(filePath, subject) {
  if (!fs.existsSync(filePath)) return null;

  const code = fs.readFileSync(filePath, "utf8");

  const sandbox = {
    window: {
      medQuizQuestions: {},
      medQuizQuestionSets: {},
      medQuizResources: {},
      medQuizFlashcards: {}
    },
    console: {
      log() {},
      warn() {},
      error() {}
    }
  };

  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  try {
    vm.runInContext(code, sandbox, {
      filename: filePath,
      timeout: 5000
    });

    const list =
      sandbox.window.medQuizQuestions?.[subject];

    return Array.isArray(list)
      ? list.length
      : 0;
  }
  catch (error) {
    console.warn(
      `Không đếm được ${path.relative(root, filePath)}: ${error.message}`
    );
    return 0;
  }
}

const result = {
  version: Date.now(),
  generatedAt: new Date().toISOString(),
  totalQuestions: 0,
  subjects: {}
};

for (const [subject, prefix] of Object.entries(subjects)) {
  const sets = {};
  let total = 0;
  let foundSetFile = false;

  for (let i = 1; i <= 10; i++) {
    const key = `${prefix}${i}`;
    const filePath =
      path.join(questionsDir, `${key}.js`);

    const count =
      countQuestions(filePath, subject);

    if (count !== null) {
      foundSetFile = true;
      sets[key] = count;
      total += count;
    } else {
      sets[key] = 0;
    }
  }

  // Tương thích web cũ chỉ có questions/noikhoa.js...
  if (!foundSetFile) {
    const legacy =
      path.join(questionsDir, `${prefix}.js`);

    const legacyCount =
      countQuestions(legacy, subject);

    if (legacyCount !== null) {
      sets[`${prefix}1`] = legacyCount;
      total = legacyCount;
    }
  }

  result.subjects[subject] = {
    total,
    sets
  };

  result.totalQuestions += total;
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(result, null, 2) + "\n",
  "utf8"
);

console.log(
  `Đã cập nhật question-manifest.json: ${result.totalQuestions} câu`
);
