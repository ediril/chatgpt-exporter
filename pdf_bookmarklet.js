/**
 * ChatGPT PDF Exporter Bookmarklet
 *
 * This bookmarklet exports ChatGPT conversations to PDF via the print dialog.
 * Opens a clean, print-ready version of the conversation in a new window.
 */

javascript:(function() {
  // Scroll to trigger lazy-loaded content
  scrollTo(0, 9e9);
  scrollTo(0, 0);

  setTimeout(function() {
    // Open new window for print
    const printWindow = open('');
    const main = document.querySelector('main');
    const clone = main.cloneNode(true);
    const seenImageSrcs = [];

    // ===== PHASE 1: CLEAN UP IMAGES =====

    clone.querySelectorAll('img').forEach(function(img) {
      const src = img.src || img.dataset.src || img.getAttribute('data-src') ||
                  img.getAttribute('src') || '';

      if (src && src.length > 10 && !src.includes('data:image/svg')) {
        if (seenImageSrcs.includes(src)) {
          // Remove duplicate images
          img.remove();
        } else {
          seenImageSrcs.push(src);
          // Style images for print
          img.style.cssText =
            'max-width:400px!important;height:auto!important;border-radius:8px;' +
            'margin:10px 0!important;display:block!important';
        }
      }
    });

    // ===== PHASE 2: EXTRACT IMAGES FROM BUTTONS =====

    clone.querySelectorAll('button').forEach(function(btn) {
      // Extract images from buttons (except Sources buttons)
      if (btn.querySelector('img') && !btn.textContent.includes('Sources')) {
        const img = btn.querySelector('img');
        if (img) {
          const div = document.createElement('div');
          div.style.cssText = 'margin:10px 0!important;padding:0!important;';
          div.appendChild(img.cloneNode(true));
          btn.parentNode.insertBefore(div, btn);
          btn.remove();
        }
      }
    });

    // ===== PHASE 3: REMOVE UNNECESSARY ELEMENTS =====

    // Remove buttons without images, SVGs, and UI controls
    clone.querySelectorAll('button:not(:has(img)),[role=button]:not(:has(img)),svg:not(:has(image))').forEach(function(e) {
      e.remove();
    });

    // Remove closed/collapsed elements
    clone.querySelectorAll('[data-state=closed],span[data-state=closed]').forEach(function(e) {
      if (e.textContent.includes('Thought for') ||
          e.textContent.includes('seconds') ||
          !e.textContent.trim()) {
        e.remove();
      }
    });

    // Clean up empty containers
    clone.querySelectorAll('.relative.my-1,.pb-3,.pb-2').forEach(function(e) {
      const hasImg = e.querySelector('img');
      const hasText = e.textContent.trim().length > 10;

      if (hasImg && !hasText) {
        // Container with image but no text - extract image
        const img = e.querySelector('img');
        if (img) {
          const div = document.createElement('div');
          div.style.cssText = 'margin:10px 0!important;padding:0!important;';
          div.appendChild(img.cloneNode(true));
          e.parentNode.replaceChild(div, e);
        }
      } else if (!hasText && !hasImg) {
        // Empty container - remove it
        e.remove();
      }
    });

    // Normalize height for "Thought for X seconds" elements
    clone.querySelectorAll('*').forEach(function(e) {
      if (e.textContent &&
          (e.textContent.includes('Thought for') ||
           e.textContent.includes('seconds') ||
           e.textContent.includes('Image created')) &&
          !e.querySelector('img')) {
        e.style.cssText =
          'height:auto!important;min-height:0!important;max-height:none!important;' +
          'padding:2px 0!important;margin:2px 0!important;overflow:visible!important';
      }
    });

    // ===== PHASE 4: STYLE SOURCES BUTTONS =====

    clone.querySelectorAll('button').forEach(function(e) {
      if (e.textContent.includes('Sources') &&
          e.querySelector('img[src*="s2/favicons"]')) {
        const flexDiv = e.querySelector('.flex.flex-row-reverse');
        if (flexDiv) {
          flexDiv.style.cssText =
            'display:flex!important;flex-direction:row!important;gap:3px!important;';
        }
      }
    });

    // ===== PHASE 5: STYLE LINKS =====

    clone.querySelectorAll('a[href]').forEach(function(a) {
      if (a.href.startsWith('http')) {
        a.style.cssText =
          'background:#d1d5db!important;color:#1f2937!important;' +
          'text-decoration:none!important;padding:1px 4px!important;' +
          'border-radius:6px!important;font-size:0.75rem!important;' +
          'display:inline-block!important;margin:2px!important;' +
          'font-weight:500!important;border:1px solid #9ca3af!important;';
      }
    });

    // ===== PHASE 6: GENERATE PRINT HTML =====

    const css = `
      * {
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        margin: 20px;
        line-height: 1.6;
        color: #374151;
      }
      img {
        max-width: 400px !important;
        height: auto !important;
        border-radius: 8px;
        margin: 10px 0 !important;
        display: block !important;
      }
      pre {
        background: #f3f4f6;
        padding: 12px;
        border-radius: 6px;
      }
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .whitespace-pre-wrap {
        white-space: pre-wrap;
      }
      a[href^="http"] {
        background: #d1d5db !important;
        color: #1f2937 !important;
        text-decoration: none !important;
        padding: 1px 4px !important;
        border-radius: 6px !important;
        font-size: 0.75rem !important;
        display: inline-block !important;
        margin: 2px !important;
        font-weight: 500 !important;
        border: 1px solid #9ca3af !important;
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      a[href^="http"]:hover {
        background: #9ca3af !important;
      }
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        img {
          max-width: 350px !important;
        }
        a[href^="http"] {
          background: #d1d5db !important;
          border: 1px solid #9ca3af !important;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;

    const html = `
      <!DOCTYPE html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        <h1>ChatGPT Conversation</h1>
        <p>Exported: ${new Date().toLocaleString()}</p>
        <hr>
        ${clone.innerHTML}
      </body>
      </html>
    `;

    // Write to new window and trigger print dialog
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }, 1000);
})();
