// One-off generator for the Open Graph share cards (assets/og-*.png).
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';

const b64 = (p, mime) => `data:${mime};base64,` + fs.readFileSync(p).toString('base64');
const portrait = b64('assets/josh-engels.jpg', 'image/jpeg');
const iconTasks = b64('assets/icons/tasks-uniflow.png', 'image/png');
const iconReadme = b64('assets/icons/readme.png', 'image/png');
const iconFood = b64('assets/icons/food-in-five.png', 'image/png');

// chimp artwork, lids stripped (resvg can't apply the CSS that hides them)
const chimp = fs.readFileSync('assets/chimp.svg', 'utf8')
  .replace(/<g class="ck-lids"[\s\S]*?<\/g>/, '')
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');

const careerCard = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" font-family="DejaVu Sans">
  <rect width="1200" height="630" fill="#f7f6f2"/>
  <rect x="0" y="0" width="1200" height="10" fill="#4f46e5"/>
  <circle cx="1080" cy="540" r="260" fill="#4f46e5" opacity="0.05"/>
  <text x="84" y="180" font-size="22" font-weight="bold" letter-spacing="4" fill="#4f46e5">TECHNOLOGY LEADER · iOS DEVELOPER</text>
  <text x="80" y="290" font-size="96" font-weight="bold" fill="#15202b">Josh Engels</text>
  <text x="84" y="362" font-size="28" fill="#475569">Resilient systems. Products people trust.</text>
  <text x="84" y="450" font-size="28" fill="#64748b">DraftKings  ·  Apple  ·  U.S. Air Force</text>
  <circle cx="92" cy="540" r="9" fill="#ff6b54"/>
  <text x="116" y="550" font-size="26" font-weight="bold" fill="#15202b">jengels34.github.io</text>
  <defs>
    <clipPath id="pc"><rect x="770" y="90" width="360" height="450" rx="28"/></clipPath>
  </defs>
  <rect x="770" y="90" width="360" height="450" rx="28" fill="#14172e"/>
  <image href="${portrait}" x="740" y="90" width="420" height="472" preserveAspectRatio="xMidYMin slice" clip-path="url(#pc)"/>
  <rect x="770" y="90" width="360" height="450" rx="28" fill="none" stroke="#15202b" stroke-opacity="0.12" stroke-width="2"/>
</svg>`;

const hqCard = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" font-family="DejaVu Sans">
  <defs>
    <radialGradient id="bg" cx="30%" cy="0%" r="120%">
      <stop offset="0%" stop-color="#1ba35e"/><stop offset="45%" stop-color="#0e7344"/>
      <stop offset="80%" stop-color="#0a4029"/><stop offset="100%" stop-color="#081711"/>
    </radialGradient>
    <clipPath id="i1"><rect x="84" y="468" width="92" height="92" rx="22"/></clipPath>
    <clipPath id="i2"><rect x="196" y="468" width="92" height="92" rx="22"/></clipPath>
    <clipPath id="i3"><rect x="308" y="468" width="92" height="92" rx="22"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="975" cy="330" r="225" fill="#a6f24a" opacity="0.16"/>
  <text x="86" y="150" font-size="22" font-weight="bold" letter-spacing="4" fill="#a6f24a">NATIVE · PRIVACY-FIRST · iOS</text>
  <text x="80" y="262" font-size="84" font-weight="bold" fill="#ffffff">Khakichimp HQ</text>
  <text x="86" y="340" font-size="36" fill="#d9f7e4">iOS apps with no trackers. Ever.</text>
  <image href="${iconTasks}" x="84" y="468" width="92" height="92" clip-path="url(#i1)"/>
  <image href="${iconReadme}" x="196" y="468" width="92" height="92" clip-path="url(#i2)"/>
  <image href="${iconFood}" x="308" y="468" width="92" height="92" clip-path="url(#i3)"/>
  <svg x="775" y="65" width="410" height="530" viewBox="0 0 240 320">${chimp}</svg>
</svg>`;

for (const [name, src] of [['og-josh', careerCard], ['og-khakichimp', hqCard]]) {
  const r = new Resvg(src, { fitTo: { mode: 'width', value: 1200 } });
  fs.writeFileSync(`assets/${name}.png`, r.render().asPng());
  console.log('wrote assets/' + name + '.png');
}
