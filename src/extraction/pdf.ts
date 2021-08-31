import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker';

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
