import React from 'react';
import ReactDOM from 'react-dom';
import { Table } from 'antd';
import { ColumnsType } from 'antd/es/table';
import 'antd/dist/antd.css';
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import './index.css';
import chardet from 'chardet';
import { parse as assParse } from 'ass-compiler';
// import { parse as srtVttParse } from '@plussub/srt-vtt-parser';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker';

const classNamePrefix = 'wdautohl';

interface HighlightedWords {
  index: number;
  lexeme: string;
  word: string;
  count: number;
  rank: number;
  frequency: number;
}

let wordData;

const wordSorter = (a, b) => {
  const wordA = a.word.toLowerCase();
  const wordB = b.word.toLowerCase();
  if (wordA < wordB) {
    return -1;
  }
  if (wordA > wordB) {
    return 1;
  }
  return 0;
};

const columns: ColumnsType<HighlightedWords> = [
  {
    title: 'Index',
    dataIndex: 'index',
    sorter: (a, b) => a.index - b.index,
  },
  {
    title: 'Word',
    dataIndex: 'word',
    sorter: wordSorter,
  },
  {
    title: 'Lexeme',
    dataIndex: 'lexeme',
    sorter: wordSorter,
  },
  {
    title: 'Count',
    dataIndex: 'count',
    defaultSortOrder: 'descend',
    sorter: (a, b) => a.count - b.count,
  },
  {
    title: 'Rank',
    dataIndex: 'rank',
    sorter: (a, b) => a.rank - b.rank,
  },
  {
    title: 'Frequency',
    dataIndex: 'frequency',
    // defaultSortOrder: 'descend',
    sorter: (a, b) => a.frequency - b.frequency,
  },
];

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

const formatAssTime = (time: number) => Math.floor(time * 1000);
const formatAssText = (text: string) => text.replace(/\\N/g, '\n');

export const formatBiggestUnitMinuteSmallestUnitSeconds = (time: number): string => {
  const seconds = Math.trunc((time / 1000) % 60);
  const secondsPart = `${seconds > 9 ? '' : '0'}${seconds}`;

  const minutes = Math.trunc((time / (1000 * 60)) % 1000);
  const minutesPart = `${minutes > 9 ? '' : '0'}${minutes}:`;
  return `${minutesPart}${secondsPart}`;
};

export const parseAss = (raw: string) => {
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
  let outputText = '';
  let previousItem;
  parsed.forEach((item) => {
    if (previousItem && item.from === previousItem.from && item.to === previousItem.to) {
      outputText = outputText.concat(item.text, '\n');
    } else {
      outputText = outputText.concat(
        '\n',
        formatBiggestUnitMinuteSmallestUnitSeconds(item.from),
        '-',
        formatBiggestUnitMinuteSmallestUnitSeconds(item.to),
        '\n',
        item.text,
        '\n',
      );
    }
    previousItem = item;
  });
  return outputText;
};

const observeUnhighlight = (el: HTMLElement) => {
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      const mutationTarget = mutation.target;
      if (mutationTarget.nodeType !== Node.ELEMENT_NODE) return;
      if (
        mutation.attributeName === 'class' &&
        (mutationTarget as HTMLElement).className.endsWith('none_none')
      ) {
        const [, lexeme] = mutation.oldValue.split('_');
        wordData = wordData.filter((obj) => obj.word !== lexeme);
        ReactDOM.render(
          <Table columns={columns} dataSource={wordData} />,
          document.getElementById('wd-words-found-display'),
        );
      }
    }
  });
  observer.observe(el, { subtree: true, attributes: true, attributeOldValue: true });
};

const changeContent = (textContent) => {
  // document.getElementById('wd-content-display').textContent = textContent;
  const contentSpan = document.createElement('span');
  contentSpan.textContent = textContent;
  contentSpan.id = `text-content`;
  document.getElementById('text-content').replaceWith(contentSpan);
  // wait until fully replace
  setTimeout(() => {
    const highlightedWords = {} as HighlightedWords;
    let currentLexemeId = 1;
    document
      .getElementById('wd-content-display')
      .querySelectorAll(`[class^=${classNamePrefix}`)
      .forEach((el) => {
        // observeUnhighlight(el);
        const [, lexemeRaw, wordRaw, rankAndFrequency] = el.className.split('_');
        if (!lexemeRaw || !wordRaw) return;
        const lexeme = lexemeRaw.replace(/9/g, ' ');
        const word = wordRaw.replace(/9/g, ' ');
        if (!lexeme || !word) return;
        if (highlightedWords[lexeme]) {
          highlightedWords[lexeme].count += 1;
          return;
        }
        highlightedWords[lexeme] = {
          key: currentLexemeId,
          word,
          lexeme,
          count: 1,
          index: currentLexemeId,
        };
        currentLexemeId += 1;
        if (rankAndFrequency) {
          const [rank, frequency] = rankAndFrequency.split(':');
          highlightedWords[lexeme].rank = rank;
          highlightedWords[lexeme].frequency = frequency;
        }
      });
    wordData = Object.values(highlightedWords);
    // To avoid old highlighted words still on table
    ReactDOM.render(<Table />, document.getElementById('wd-words-found-display'));
    ReactDOM.render(
      <Table columns={columns} dataSource={wordData} />,
      document.getElementById('wd-words-found-display'),
    );
  }, 300);
};

const readFile = (file) => {
  const arrayBufferReader = new FileReader();
  arrayBufferReader.readAsArrayBuffer(file);
  arrayBufferReader.onload = async () => {
    if (file.name.split('.').pop() === 'pdf') {
      const text = await getPDFText(new Uint8Array(arrayBufferReader.result as ArrayBuffer));
      changeContent(text);
      return;
    }
    const encoding = chardet.detect(new Uint8Array(arrayBufferReader.result as ArrayBuffer));
    const textReader = new FileReader();
    textReader.readAsText(file, encoding ?? 'UTF-8');
    textReader.onload = () => {
      switch (file.name.split('.').pop()) {
        case 'ass':
        case 'ssa':
          changeContent(parseAss(textReader.result as string));
          break;
        case 'srt':
        case 'vtt':
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

const fileClicked = (event) => {
  event.target.value = null;
};

const inputChanged = (event) => {
  changeContent(event.target.value);
};

const initControls = async () => {
  document.getElementById('input-file').addEventListener('change', fileSelected);
  document.getElementById('input-file').addEventListener('click', fileClicked);
  document.getElementById('input-text').addEventListener('input', inputChanged);
  observeUnhighlight(document.getElementById('wd-content-display'));
  observeUnhighlight(document.getElementById('wd-words-found-display'));
};

document.addEventListener('DOMContentLoaded', () => {
  initControls();
});
