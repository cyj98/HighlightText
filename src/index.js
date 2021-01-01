import chardet from 'chardet';
import { parse as assParse } from 'ass-compiler';
import { parse as srtVttParse } from '@plussub/srt-vtt-parser';

const pdfjsLib = require('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker';

const classNamePrefix = 'wdautohl';

const getPageText = async (pdf, pageNo) => {
  const page = await pdf.getPage(pageNo);
  const tokenizedText = await page.getTextContent();
  const pageText = tokenizedText.items.map((token) => token.str).join('');
  return pageText;
};

/* see example of a PDFSource below */
export const getPDFText = async (source) => {
  const pdf = await pdfjsLib.getDocument(source).promise;
  const maxPages = pdf.numPages;
  const pageTextPromises = [];
  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    pageTextPromises.push(getPageText(pdf, pageNo));
  }
  const pageTexts = await Promise.all(pageTextPromises);
  return pageTexts.join(' ');
};

const formatAssTime = (time) => Math.floor(time * 1000);
const formatAssText = (text) => text.replace(/\\N/g, '\n');

export const parseAss = (raw) => {
  const parsedAss = assParse(raw);
  const parsed = parsedAss.events.dialogue
    .filter((dialog) => dialog.Text.combined)
    .map((dialog) => ({
      from: formatAssTime(dialog.Start),
      to: formatAssTime(dialog.End),
      text: formatAssText(dialog.Text.combined),
    }))
    .sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      if (a.to !== b.to) return a.to - b.to;
      return 0;
    });
  const output = [];
  // merge subtitle with same time for multi-lang subtitle
  parsed.forEach((item) => {
    const existingIndex = output.findIndex((v) => v.from === item.from && v.to === item.to);
    if (existingIndex > -1) {
      output[existingIndex].text = output[existingIndex].text.concat('\n', item.text);
    } else {
      output.push(item);
    }
  });
  return output;
};

const observeUnhighlight = (el) => {
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (
        mutation.attributeName === 'class' &&
        mutation.target.className === 'wdautohl_none_none'
      ) {
        const wordFoundEl = document.getElementById('wd-words-found-display');
        Array.from(wordFoundEl.getElementsByClassName('wdautohl_none_none')).forEach((el) => {
          el.parentElement.remove();
        });
      }
    }
  });
  observer.observe(el, { attributes: true, attributeOldValue: true });
};

const changeContent = (textContent) => {
  document.getElementById('wd-content-display').textContent = textContent;
  setTimeout(() => {
    const highlightedWords = {};
    let currentLexemeId = 0;
    document
      .getElementById('wd-content-display')
      .querySelectorAll(`[class^=${classNamePrefix}`)
      .forEach((el) => {
        observeUnhighlight(el);
        const [, lexeme, rankAndCount] = el.className.split('_');
        if (lexeme) {
          if (highlightedWords[lexeme]) {
            highlightedWords[lexeme].count += 1;
          } else {
            highlightedWords[lexeme] = { count: 1, id: currentLexemeId };
            currentLexemeId += 1;
            if (rankAndCount) {
              const [rank] = rankAndCount.split(':');
              highlightedWords[lexeme].rank = rank;
            }
          }
        }
      });
    const wordFoundElement = document.getElementById('wd-words-found-display');
    wordFoundElement.textContent = '';
    Object.entries(highlightedWords)
      .sort(([, a], [, b]) => a.rank - b.rank)
      .forEach(([word, wordInfo]) => {
        const wordSpan = document.createElement('span');
        wordSpan.textContent = `${word}:${wordInfo.count}  `;
        wordFoundElement.append(wordSpan);
      });
    wordFoundElement.querySelectorAll(`[class^=${classNamePrefix}`).forEach((el) => {
      observeUnhighlight(el);
    });
  }, 100);
};

const readFile = (file) => {
  const arrayBufferReader = new FileReader();
  arrayBufferReader.readAsArrayBuffer(file);
  arrayBufferReader.onload = async () => {
    if (file.name.split('.').pop() === 'pdf') {
      const text = await getPDFText(new Uint8Array(arrayBufferReader.result));
      changeContent(text);
      return;
    }
    const encoding = chardet.detect(new Uint8Array(arrayBufferReader.result));
    const textReader = new FileReader();
    textReader.readAsText(file, encoding ?? 'UTF-8');
    textReader.onload = () => {
      switch (file.name.split('.').pop()) {
        case 'ass':
        case 'ssa':
          parseAss(textReader.result);
          break;
        case 'srt':
        case 'vtt':
          console.log(srtVttParse(textReader.result));
          break;
        case 'txt':
          changeContent(textReader.result);
          break;
      }
    };
  };
};

const fileSelected = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const typeArr = ['ass', 'ssa', 'srt', 'vtt', 'txt', 'pdf'];
  if (!typeArr.includes(file.name.split('.').pop())) return;
  readFile(event.target.files[0]);
};

const inputChanged = (event) => {
  changeContent(event.target.value);
};

const initControls = async () => {
  document.getElementById('input-file').addEventListener('change', fileSelected);
  document.getElementById('input-text').addEventListener('input', inputChanged);
};

document.addEventListener('DOMContentLoaded', () => {
  initControls();
});
