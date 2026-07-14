
// extractWords.js (Run this in your terminal with Node)
const fs = require('fs');

const srt1 = fs.readFileSync('./public/english.srt', 'utf-8');
const srt2 = fs.readFileSync('./public/arabic.srt', 'utf-8');
const srt3 = fs.readFileSync('./public/arabic_simple.srt', 'utf-8');
// Remove timestamps, HTML tags, and punctuation
const srt = srt1 +srt2 + srt3
const cleanText = srt
  .replace(/[0-9:,-->\n\r]/g, ' ')
  .replace(/<[^>]*>?/gm, '')
  .replace(/[.،؛؟!"'()\[\]{}]/g, ' ');

// Split into words, remove empty spaces, and get unique values
const words = cleanText.split(' ').filter((w: { trim: () => { (): any; new(): any; length: number; }; }) => w.trim().length > 0);
const uniqueWords = [...new Set(words)];

// Generate a template dictionary
const dictionaryTemplate = {};
uniqueWords.forEach(word => {
    word
//   dictionaryTemplate[word] = {
//     translation: "",
//     root: "",
//     type: "",
//     explanation: ""
//   };
});

fs.writeFileSync('dictionaryTemplate.json', JSON.stringify(dictionaryTemplate, null, 2));
console.log(`Extracted ${uniqueWords.length} unique words.`);