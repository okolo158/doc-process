"use client";

import React, { useState } from "react";
import * as mammoth from "mammoth";

const WordDocProcessor = () => {
  const [processedContent, setProcessedContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const getTextNodes = (element) => {
    let textNodes = [];
    if (element.nodeType === Node.TEXT_NODE) {
      textNodes.push(element);
    } else {
      element.childNodes.forEach((child) => {
        textNodes = textNodes.concat(getTextNodes(child));
      });
    }
    return textNodes;
  };

  const processSuperscriptReferences = (doc) => {
    const superscripts = doc.querySelectorAll("sup");
    superscripts.forEach((sup) => {
      const text = sup.textContent?.trim();
      if (/^\d+$/.test(text)) {
        sup.classList.add("reference");
        sup.setAttribute("data-ref-id", text);
        sup.setAttribute("data-type", "citation");
      }
    });

    const textNodes = getTextNodes(doc.body);
    textNodes.forEach((node) => {
      const text = node.textContent;
      const superscriptPattern = /([¹²³⁴⁵⁶⁷⁸⁹⁰]+)/g;

      if (superscriptPattern.test(text)) {
        const newText = text.replace(superscriptPattern, (match) => {
          const normalNum = match
            .replace(/¹/g, "1")
            .replace(/²/g, "2")
            .replace(/³/g, "3")
            .replace(/⁴/g, "4")
            .replace(/⁵/g, "5")
            .replace(/⁶/g, "6")
            .replace(/⁷/g, "7")
            .replace(/⁸/g, "8")
            .replace(/⁹/g, "9")
            .replace(/⁰/g, "0");

          return `<sup class="reference" data-ref-id="${normalNum}" data-type="citation">${normalNum}</sup>`;
        });

        node.parentNode.innerHTML = node.parentNode.innerHTML.replace(
          text,
          newText
        );
      }
    });
  };

  const processImages = (doc) => {
    const images = doc.querySelectorAll("img");
    images.forEach((img, index) => {
      const figureWrapper = doc.createElement("div");
      figureWrapper.className = "tableHolder";
      figureWrapper.style.width = "50%"; // Match ideal output

      const captionP = doc.createElement("p");
      let captionText = `Figure ${index + 1}`;

      // Check for existing figure/caption structure
      const figure = img.closest("figure");
      if (figure) {
        const figcaption = figure.querySelector("figcaption");
        if (figcaption) {
          captionText = figcaption.textContent.trim();
        }
      }

      captionP.innerHTML = captionText;

      const imageP = doc.createElement("p");
      const newImg = img.cloneNode(true); // Keep original img attributes

      const sourceP = doc.createElement("p");
      sourceP.textContent = "Source: ";

      figureWrapper.appendChild(captionP);
      figureWrapper.appendChild(imageP);
      figureWrapper.appendChild(sourceP);

      // Replace either the figure or the img directly
      const parentToReplace = figure || img.parentNode;
      parentToReplace.parentNode.replaceChild(figureWrapper, parentToReplace);
      imageP.appendChild(newImg);
    });
  };

  const processContent = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    removeFirstPage(doc);
    processSuperscriptReferences(doc);
    processImages(doc);

    return doc.body.innerHTML;
  };

  const unwrapTableTags = (doc) => {
    const tagsToRemove = ["table", "tbody", "thead", "tfoot", "tr", "th", "td"];

    tagsToRemove.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => {
        // Replace the element with its children (unwrap)
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      });
    });
  };

  const removeFirstPage = (doc) => {
    // Find the first page break element — assuming mammoth adds a <div style="page-break-after:always"></div>
    const pageBreak = Array.from(doc.body.children).find(
      (el) => el.style && el.style.pageBreakAfter === "always"
    );

    if (pageBreak) {
      // Remove all siblings before the page break (including the page break itself)
      let current = doc.body.firstChild;

      while (current && current !== pageBreak) {
        const toRemove = current;
        current = current.nextSibling;
        doc.body.removeChild(toRemove);
      }
      // Remove the page break itself
      if (pageBreak.parentNode) {
        pageBreak.parentNode.removeChild(pageBreak);
      }
    } else {
      // If no explicit page break found, you might want to ignore entire content or do nothing
      // Optionally: doc.body.innerHTML = ""; to ignore all content if no page break found
    }
  };

  const formatContent = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // Standardize h1 to h2
    doc.querySelectorAll("h1").forEach((heading) => {
      const h2 = doc.createElement("h2");
      h2.innerHTML = heading.innerHTML;
      heading.parentNode.replaceChild(h2, heading);
    });

    // Replace all <b> and <strong> with <h2>
    doc.querySelectorAll("b, strong").forEach((bold) => {
      const style = window.getComputedStyle(bold);
      const fontSize = parseFloat(style.fontSize);
      const textLength = bold.textContent.trim().length; // count of characters excluding leading/trailing spaces

      if (fontSize > 11 && textLength <= 40) {
        // Treat as heading <h2> if font size ~12px and short enough
        if (bold.tagName.toLowerCase() !== "h2") {
          const h2 = doc.createElement("h2");
          h2.innerHTML = bold.innerHTML;
          bold.parentNode.replaceChild(h2, bold);
        }
      } else {
        // Otherwise ensure <strong>
        if (bold.tagName.toLowerCase() !== "strong") {
          const strong = doc.createElement("strong");
          strong.innerHTML = bold.innerHTML;
          bold.parentNode.replaceChild(strong, bold);
        }
      }
    });

    doc.querySelectorAll("sup").forEach((sup) => {
      const text = sup.textContent?.trim();
      if (/^\d+$/.test(text)) {
        const refSpan = doc.createElement("span");
        refSpan.textContent = `[${text}]`;
        sup.parentNode.replaceChild(refSpan, sup);
      }
    });

    doc.querySelectorAll("img").forEach((img, index) => {
      const figureWrapper = doc.createElement("p");
      const tableHolder = doc.createElement("div");
      tableHolder.className = "tableHolder";
      tableHolder.style.width = "50%";

      const captionP = doc.createElement("p");
      let captionText = `Figure ${index + 1}`;

      const figure = img.closest("figure");
      if (figure) {
        const figcaption = figure.querySelector("figcaption");
        if (figcaption) captionText = figcaption.textContent.trim();
      }

      captionP.textContent = captionText;

      const imageP = doc.createElement("p");
      const newImg = doc.createElement("img");
      newImg.alt = img.alt || "";
      newImg.src = ""; // as specified
      imageP.appendChild(newImg);

      const sourceP = doc.createElement("p");
      sourceP.textContent = "Source: ";

      tableHolder.appendChild(captionP);
      tableHolder.appendChild(imageP);
      tableHolder.appendChild(sourceP);
      figureWrapper.appendChild(tableHolder);

      const parentToReplace = figure || img;
      parentToReplace.parentNode.replaceChild(figureWrapper, parentToReplace);
    });

    unwrapTableTags(doc);

    return doc.body.innerHTML;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      setOriginalContent(html);

      const processed = processContent(html);
      const formatted = formatContent(processed);

      setProcessedContent(formatted);
    } catch (error) {
      console.error("Error processing file:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <input type="file" accept=".docx" onChange={handleFileUpload} />
      {isProcessing && <p>Processing document...</p>}
      <h2>Processed Output</h2>
      <pre className="p-5 bg-white text-black h-screen overflow-auto whitespace-pre-wrap">
        {processedContent}
      </pre>
    </div>
  );
};

export default WordDocProcessor;
