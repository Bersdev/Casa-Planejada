// Gera os ícones do app a partir de um SVG
import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/><path d="M256 118 112 240v154a22 22 0 0 0 22 22h244a22 22 0 0 0 22-22V240Z" fill="#fff"/><path d="M256 96 84 242" stroke="#fff" stroke-width="34" stroke-linecap="round"/><path d="M256 96l172 146" stroke="#fff" stroke-width="34" stroke-linecap="round"/><path d="M206 318l36 36 68-76" fill="none" stroke="#2563eb" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
for (const [n, s] of [["app-512", 512], ["app-192", 192], ["apple-touch-icon", 180]]) await sharp(Buffer.from(svg)).resize(s, s).png().toFile(`public/icons/${n}.png`);
console.log("icons ok");
