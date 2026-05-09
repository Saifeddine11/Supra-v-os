/**
 * Génère docs/formation/GUIDE_COMPLET_SUPRA_AGENCY_OS.pdf à partir du Markdown.
 * Prérequis : npm install (md-to-pdf en devDependency). Chromium peut être téléchargé au premier run.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { mdToPdf } = require("md-to-pdf");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const formationDir = path.join(root, "docs", "formation");
const mdPath = path.join(formationDir, "GUIDE_COMPLET_SUPRA_AGENCY_OS.md");
const cssPath = path.join(formationDir, "print.css");
const pdfPath = path.join(formationDir, "GUIDE_COMPLET_SUPRA_AGENCY_OS.pdf");

const pdf = await mdToPdf(
  { path: mdPath },
  {
    dest: pdfPath,
    stylesheet: cssPath,
    pdf_options: {
      format: "A4",
      printBackground: true,
      margin: {
        top: "18mm",
        bottom: "18mm",
        left: "16mm",
        right: "16mm",
      },
    },
    basedir: formationDir,
  },
);

if (!pdf) {
  console.error("md-to-pdf: aucun buffer PDF retourné");
  process.exit(1);
}

console.log("PDF généré :", pdfPath);
