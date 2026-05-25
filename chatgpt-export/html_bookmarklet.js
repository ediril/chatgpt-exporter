/**
 * ChatGPT HTML Exporter Bookmarklet
 *
 * This bookmarklet exports ChatGPT conversations to a self-contained HTML file
 * with embedded images, styled content, and collapsible source citations.
 */

javascript:(function() {
  // Scroll to trigger lazy-loaded content
  scrollTo(0, 9e9);
  scrollTo(0, 0);

  setTimeout(async function() {
    // Prevent multiple simultaneous exports
    if (window.__CGPT_HTML_EXPORTING) {
      return;
    }
    window.__CGPT_HTML_EXPORTING = true;

    try {
      // ===== PHASE 1: EXTRACT CITATIONS/SOURCES =====

      const main = document.querySelector('main');
      if (!main) {
        alert('Chat area not found');
        return;
      }

      // Find all "Sources" buttons
      const sourceBtnsToProcess = [];
      let btnIndex = 0;

      main.querySelectorAll('button').forEach(function(btn) {
        const hasSourcesText = btn.textContent.includes('Sources');
        const hasFavicon = btn.querySelector('img[src*="s2/favicons"]') ||
                          btn.querySelector('img[src*="gstatic.com"]');

        if (hasSourcesText && hasFavicon) {
          btn.setAttribute('data-cgpt-source-index', btnIndex);
          sourceBtnsToProcess.push(btn);
          btnIndex++;
        }
      });

      // Show progress indicator if we have sources to process
      let progressDiv = null;
      if (sourceBtnsToProcess.length > 0) {
        progressDiv = document.createElement('div');
        progressDiv.style.cssText =
          'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
          'background:#0f172a;color:#fff;padding:16px 24px;border-radius:8px;' +
          'font:14px/1.4 -apple-system,sans-serif;z-index:999999;' +
          'box-shadow:0 4px 12px rgba(0,0,0,0.3)';
        progressDiv.textContent = `Processing citations 0/${sourceBtnsToProcess.length}...`;
        document.body.appendChild(progressDiv);
      }

      // Process each Sources button to extract citations
      const citationsByIndex = {};

      for (let bi = 0; bi < sourceBtnsToProcess.length; bi++) {
        const btn = sourceBtnsToProcess[bi];
        const idx = btn.getAttribute('data-cgpt-source-index');

        if (progressDiv) {
          progressDiv.textContent = `Processing citations ${bi + 1}/${sourceBtnsToProcess.length}...`;
        }

        // Click button to open modal
        btn.click();

        // Wait for modal/panel to appear (max 2 seconds for right-side panel)
        let modal = null;
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(r => setTimeout(r, 100));
          modal = document.querySelector('.content-sheet') ||
                  document.querySelector('[data-content-sheet-section]') ||
                  document.querySelector('[data-testid="modal-search-results"]') ||
                  document.querySelector('[role="dialog"]') ||
                  document.querySelector('[class*="sheet"]') ||
                  document.querySelector('[class*="panel"]') ||
                  document.querySelector('[class*="sidebar"]');
          if (modal) break;
        }

        // Wait a bit more for content to load
        if (modal) {
          await new Promise(r => setTimeout(r, 300));
        }

        if (!modal) {
          // Modal didn't appear, skip this button
          citationsByIndex[idx] = [];
          const closeAnyModal = document.querySelector('button[data-silk*="a16"]') ||
                                document.querySelector('[data-testid="close-button"]') ||
                                document.querySelector('button[aria-label*="Close"]') ||
                                document.querySelector('[aria-label*="close"]');
          if (closeAnyModal) {
            closeAnyModal.click();
            await new Promise(r => setTimeout(r, 100));
          }
          continue;
        }

        // Detect popup type (citations vs sources)
        let popupType = 'citations';
        const titleEls = modal.querySelectorAll('.text-md');
        for (let ti = 0; ti < titleEls.length; ti++) {
          const titleText = titleEls[ti].textContent.trim().toLowerCase();
          if (titleText === 'sources') {
            popupType = 'sources';
            break;
          } else if (titleText === 'citations') {
            popupType = 'citations';
            break;
          }
        }

        // Extract links from modal
        const citations = [];
        const allElements = modal.querySelectorAll('*');
        let stopCollecting = false;

        for (let ei = 0; ei < allElements.length; ei++) {
          const el = allElements[ei];
          const textContent = el.textContent ? el.textContent.trim() : '';

          // Stop at "More" section
          if (textContent === 'More' || textContent === 'More results') {
            stopCollecting = true;
            break;
          }

          // Collect links
          if (!stopCollecting && el.tagName === 'A' && el.href && el.href.startsWith('http')) {
            const href = el.href;
            const titleEl = el.querySelector('.font-semibold');
            const title = titleEl ?
                         titleEl.textContent.trim() :
                         el.textContent.trim().split('\n')[0];

            if (href && title && title.length > 3) {
              citations.push({
                url: href,
                title: title,
                type: popupType
              });
            }
          }
        }

        citationsByIndex[idx] = citations;

        // Debug log
        console.log(`Sources button ${idx}: extracted ${citations.length} citations`);

        // Close modal
        const closeBtn = modal.querySelector('[data-testid="close-button"]') ||
                        modal.querySelector('[aria-label*="Close"]') ||
                        modal.querySelector('[aria-label*="close"]') ||
                        modal.querySelector('button[class*="close"]');
        if (closeBtn) {
          closeBtn.click();
        }
        await new Promise(r => setTimeout(r, 150));
      }

      if (progressDiv) {
        progressDiv.remove();
      }

      // Attach citations data to buttons
      main.querySelectorAll('button[data-cgpt-source-index]').forEach(function(btn) {
        const idx = btn.getAttribute('data-cgpt-source-index');
        const citations = citationsByIndex[idx];
        if (citations && citations.length > 0) {
          btn.setAttribute('data-citations', JSON.stringify(citations));
        }
      });

      // ===== PHASE 2: CLONE AND CLEAN CONTENT =====

      const clone = main.cloneNode(true);
      const seenImageSrcs = [];

      // Convert utility classes to inline styles for portability
      clone.querySelectorAll('*').forEach(function(el) {
        // Skip if no className or if it's not a string (e.g., SVG elements)
        if (!el.className || typeof el.className !== 'string') return;

        const classes = el.className.split(' ');
        const styles = [];
        const existingStyle = el.getAttribute('style') || '';

        classes.forEach(function(c) {
          // Flexbox
          if (c === 'flex') styles.push('display:flex');
          if (c === 'flex-col') styles.push('flex-direction:column');
          if (c === 'flex-row') styles.push('flex-direction:row');
          if (c === 'flex-wrap') styles.push('flex-wrap:wrap');
          if (c === 'flex-nowrap') styles.push('flex-wrap:nowrap');

          // Alignment
          if (c === 'items-start') styles.push('align-items:flex-start');
          if (c === 'items-end') styles.push('align-items:flex-end');
          if (c === 'items-center') styles.push('align-items:center');
          if (c === 'justify-start') styles.push('justify-content:flex-start');
          if (c === 'justify-end') styles.push('justify-content:flex-end');
          if (c === 'justify-center') styles.push('justify-content:center');
          if (c === 'justify-between') styles.push('justify-content:space-between');

          // Width/Height
          if (c === 'w-full') styles.push('width:100%');
          if (c === 'h-full') styles.push('height:100%');
          if (c === 'w-fit') styles.push('width:fit-content');
          if (c.startsWith('max-w-')) {
            const val = c.replace('max-w-', '');
            if (val === 'full') styles.push('max-width:100%');
            else if (val === 'none') styles.push('max-width:none');
            // Handle CSS variable references - default to 48rem for readability
            else if (val.includes('(--')) styles.push('max-width:48rem');
            // Handle bracket notation like max-w-[var(...)]
            else if (val.startsWith('[var(')) styles.push('max-width:70%');
          }
          if (c.startsWith('min-w-')) {
            const val = c.replace('min-w-', '');
            if (val === 'full') styles.push('min-width:100%');
            else if (val === '0') styles.push('min-width:0');
            // Handle CSS variable references - default to 100% for tables
            else if (val.includes('(--')) styles.push('min-width:100%');
          }

          // Gap
          if (c.startsWith('gap-')) {
            const val = c.replace('gap-', '');
            if (val === '1') styles.push('gap:0.25rem');
            if (val === '2') styles.push('gap:0.5rem');
            if (val === '3') styles.push('gap:0.75rem');
            if (val === '4') styles.push('gap:1rem');
          }

          // Whitespace
          if (c === 'whitespace-pre-wrap') styles.push('white-space:pre-wrap');
          if (c === 'whitespace-nowrap') styles.push('white-space:nowrap');

          // Display
          if (c === 'block') styles.push('display:block');
          if (c === 'inline') styles.push('display:inline');
          if (c === 'inline-block') styles.push('display:inline-block');
          if (c === 'hidden') styles.push('display:none');

          // Position
          if (c === 'relative') styles.push('position:relative');
          if (c === 'absolute') styles.push('position:absolute');

          // Text
          if (c === 'text-left') styles.push('text-align:left');
          if (c === 'text-right') styles.push('text-align:right');
          if (c === 'text-center') styles.push('text-align:center');

          // Padding
          if (c.startsWith('p-')) {
            const val = c.replace('p-', '');
            if (val === '1') styles.push('padding:0.25rem');
            if (val === '2') styles.push('padding:0.5rem');
            if (val === '3') styles.push('padding:0.75rem');
            if (val === '4') styles.push('padding:1rem');
          }
          if (c.startsWith('px-')) {
            const val = c.replace('px-', '');
            // Handle CSS variable references
            if (val.includes('(--')) {
              // Default to 1rem for thread content margin
              styles.push('padding-left:1rem;padding-right:1rem');
            } else {
              if (val === '1') styles.push('padding-left:0.25rem;padding-right:0.25rem');
              if (val === '2') styles.push('padding-left:0.5rem;padding-right:0.5rem');
              if (val === '3') styles.push('padding-left:0.75rem;padding-right:0.75rem');
              if (val === '4') styles.push('padding-left:1rem;padding-right:1rem');
            }
          }
          if (c.startsWith('py-')) {
            const val = c.replace('py-', '');
            if (val === '1') styles.push('padding-top:0.25rem;padding-bottom:0.25rem');
            if (val === '2') styles.push('padding-top:0.5rem;padding-bottom:0.5rem');
            if (val === '3') styles.push('padding-top:0.75rem;padding-bottom:0.75rem');
            if (val === '4') styles.push('padding-top:1rem;padding-bottom:1rem');
          }
          if (c.startsWith('pt-')) {
            const val = c.replace('pt-', '');
            if (val === '1') styles.push('padding-top:0.25rem');
            if (val === '2') styles.push('padding-top:0.5rem');
            if (val === '3') styles.push('padding-top:0.75rem');
            if (val === '4') styles.push('padding-top:1rem');
            // Skip pt-12 for now - causing issues with user bubbles
          }

          // Margin
          if (c.startsWith('m-')) {
            const val = c.replace('m-', '');
            if (val === '1') styles.push('margin:0.25rem');
            if (val === '2') styles.push('margin:0.5rem');
            if (val === '3') styles.push('margin:0.75rem');
            if (val === '4') styles.push('margin:1rem');
            if (val === 'auto') styles.push('margin:auto');
          }
          if (c.startsWith('mx-')) {
            const val = c.replace('mx-', '');
            if (val === 'auto') styles.push('margin-left:auto;margin-right:auto');
          }
          if (c.startsWith('my-')) {
            const val = c.replace('my-', '');
            if (val === 'auto') styles.push('margin-top:auto;margin-bottom:auto');
          }
        });

        if (styles.length > 0) {
          let combined = existingStyle ? existingStyle + ';' + styles.join(';') : styles.join(';');
          // Clean up double semicolons
          combined = combined.replace(/;+/g, ';').replace(/^;/, '');
          el.setAttribute('style', combined);
        }
      });

      // Preserve flex layouts for side-by-side images
      clone.querySelectorAll('div').forEach(function(div) {
        const classes = div.className || '';
        if (classes.includes('flex') && classes.includes('flex-nowrap')) {
          const imgs = div.querySelectorAll('img');
          if (imgs.length > 1) {
            div.style.cssText =
              'display:flex!important;flex-wrap:nowrap!important;gap:8px!important;' +
              'overflow-x:auto!important;margin:10px 0!important;';
            div.setAttribute('data-flex-container', 'true');
            imgs.forEach(function(img) {
              img.style.cssText =
                'max-width:200px!important;height:auto!important;border-radius:8px;' +
                'display:inline-block!important;flex-shrink:0!important;';
            });
          }
        }
      });

      // Style images and remove duplicates
      clone.querySelectorAll('img').forEach(function(img) {
        const src = img.src || img.dataset.src || img.getAttribute('data-src') ||
                    img.getAttribute('src') || '';

        if (src && src.length > 10 && !src.includes('data:image/svg')) {
          if (seenImageSrcs.includes(src)) {
            img.remove();
          } else {
            seenImageSrcs.push(src);
            const inFlexContainer = img.closest('[data-flex-container]');
            if (!inFlexContainer) {
              img.style.cssText =
                'max-width:400px!important;height:auto!important;border-radius:8px;' +
                'margin:10px 0!important;display:block!important';
            }
          }
        }
      });

      // Remove images from Sources buttons (favicons/previews we don't want)
      clone.querySelectorAll('button[data-cgpt-source-index]').forEach(function(btn) {
        const imgs = btn.querySelectorAll('img');
        imgs.forEach(function(img) {
          img.remove();
        });
      });

      // Extract images from other buttons
      clone.querySelectorAll('button').forEach(function(btn) {
        if (btn.querySelector('img') && !btn.hasAttribute('data-cgpt-source-index')) {
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

      // Remove buttons without images (except Sources buttons)
      clone.querySelectorAll('button:not(:has(img)),[role=button]:not(:has(img)),svg:not(:has(image))').forEach(function(e) {
        if (e.tagName === 'BUTTON' && e.hasAttribute('data-cgpt-source-index')) {
          return; // Keep Sources buttons
        }
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

      // Clean up empty containers (but preserve Sources buttons)
      clone.querySelectorAll('.relative.my-1,.pb-3,.pb-2').forEach(function(e) {
        const hasSourceBtn = e.querySelector('button[data-cgpt-source-index]');
        if (hasSourceBtn) {
          return;
        }

        const hasImg = e.querySelector('img');
        const hasText = e.textContent.trim().length > 10;

        if (hasImg && !hasText) {
          const img = e.querySelector('img');
          if (img) {
            const div = document.createElement('div');
            div.style.cssText = 'margin:10px 0!important;padding:0!important;';
            div.appendChild(img.cloneNode(true));
            e.parentNode.replaceChild(div, e);
          }
        } else if (!hasText && !hasImg) {
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

      // ===== PHASE 3: REPLACE SOURCES BUTTONS WITH COLLAPSIBLE SECTIONS =====

      let citIndex = 0;

      clone.querySelectorAll('button').forEach(function(e) {
        if (e.textContent.includes('Sources') && e.hasAttribute('data-citations')) {
          const idx = e.getAttribute('data-cgpt-source-index');
          const citations = JSON.parse(e.getAttribute('data-citations'));

          console.log(`Replacing Sources button ${idx} with ${citations.length} citations`);

          if (citations && citations.length > 0) {
            const citId = 'cit-' + citIndex++;
            const displayType = 'Sources';

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'cgpt-citations-wrapper';
            wrapper.style.cssText = 'margin:10px 0!important;';

            // Create toggle button with inline onclick handler
            const toggle = document.createElement('div');
            toggle.className = 'cgpt-citations-toggle';
            toggle.setAttribute('data-target', citId);
            toggle.innerHTML = `<span class="cgpt-toggle-icon">▶</span> ${displayType} (${citations.length})`;
            toggle.style.cssText =
              'font-weight:600!important;cursor:pointer!important;user-select:none!important;' +
              'padding:8px 12px!important;color:#374151!important;' +
              'background:#f3f4f6!important;border-radius:8px!important;' +
              'display:inline-block!important;margin:8px 0!important;' +
              'border:1px solid #d1d5db!important;transition:all 0.2s!important;';

            // Add inline click handler for WordPress compatibility
            toggle.setAttribute('onclick', `(function(el){var t=el.getAttribute('data-target');var l=document.getElementById(t);var i=el.querySelector('.cgpt-toggle-icon');if(l&&i){if(l.style.display==='none'||!l.style.display){l.style.display='block';i.textContent='▼'}else{l.style.display='none';i.textContent='▶'}}})(this)`);

            // Create links list
            const linksList = document.createElement('div');
            linksList.id = citId;
            linksList.className = 'cgpt-citations-list';
            linksList.style.cssText =
              'display:none!important;margin-top:8px!important;padding:12px!important;' +
              'background:#ffffff!important;border:1px solid #e5e7eb!important;' +
              'border-radius:6px!important;box-sizing:border-box!important;';

            citations.forEach(function(cit) {
              const a = document.createElement('a');
              a.href = cit.url;
              a.textContent = cit.title;
              a.target = '_blank';
              a.style.cssText =
                'display:block!important;margin:6px 0!important;' +
                'color:#2563eb!important;text-decoration:underline!important;' +
                'font-size:0.95rem!important;line-height:1.5!important;' +
                'padding:4px 0!important;word-wrap:break-word!important;';
              linksList.appendChild(a);
            });

            wrapper.appendChild(toggle);
            wrapper.appendChild(linksList);
            e.parentNode.replaceChild(wrapper, e);

            console.log(`Created collapsible section with ID: ${citId}`);
          } else {
            console.log(`Skipping button ${idx} - no citations`);
          }
        }
      });

      // ===== PHASE 4: CLEAN UP LINKS AND STYLES =====

      // Remove tracking parameters from URLs
      clone.querySelectorAll('a[href]').forEach(function(a) {
        if (a.href.startsWith('http')) {
          try {
            const url = new URL(a.href);
            const params = url.searchParams;
            const toRemove = [];

            params.forEach(function(v, k) {
              if (/^utm_|^fbclid|^gclid|^msclkid|^mc_|^_ga|^ref$|^referrer$|^source$|^campaign/i.test(k)) {
                toRemove.push(k);
              }
            });

            toRemove.forEach(k => params.delete(k));
            a.href = url.toString();
          } catch (e) {}

          // Style external links
          a.style.cssText =
            'background:#d1d5db!important;color:#1f2937!important;' +
            'text-decoration:none!important;padding:1px 4px!important;' +
            'border-radius:6px!important;font-size:0.75rem!important;' +
            'display:inline-block!important;margin:2px!important;' +
            'font-weight:500!important;border:1px solid #9ca3af!important;';
        }
      });

      // Remove file input elements
      clone.querySelectorAll('input[type="file"]').forEach(function(inp) {
        const parent = inp.closest('label,button,div,form');
        if (parent) {
          parent.remove();
        } else {
          inp.remove();
        }
      });

      // Remove "choose file" buttons/labels
      clone.querySelectorAll('button,label,div,span').forEach(function(el) {
        if (/choose files?/i.test(el.textContent || '')) {
          el.remove();
        }
      });

      // Remove ChatGPT disclaimer
      clone.querySelectorAll('div,span,p').forEach(function(el) {
        let directText = '';
        for (let i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3) {
            directText += el.childNodes[i].textContent;
          }
        }
        if (/ChatGPT can make mistakes|Check important info/i.test(directText.trim()) &&
            directText.trim().length < 100) {
          el.remove();
        }
      });

      // Remove "ChatGPT said:" prefix
      const allTextEls = clone.querySelectorAll('*');
      for (let ti = 0; ti < allTextEls.length; ti++) {
        const tel = allTextEls[ti];
        for (let ci = 0; ci < tel.childNodes.length; ci++) {
          if (tel.childNodes[ci].nodeType === 3) {
            const txt = tel.childNodes[ci].textContent;
            if (/^\s*ChatGPT said:/i.test(txt)) {
              tel.childNodes[ci].textContent = txt.replace(/^\s*ChatGPT said:\s*/i, '');
            }
          }
        }
      }

      // ===== PHASE 5: FORMAT USER MESSAGES =====

      const userMsgs = [];
      let groups = clone.querySelectorAll('[data-testid*="conversation-turn"],.group');

      if (groups.length === 0) {
        groups = clone.children;
      }

      // Find user message containers
      for (let gi = 0; gi < groups.length; gi++) {
        const grp = groups[gi];
        const fullText = grp.textContent || '';
        if (fullText.trim().startsWith('You said:') || fullText.trim().startsWith('You:')) {
          if (!userMsgs.includes(grp)) {
            userMsgs.push(grp);
            continue;
          }
        }
      }

      // Fallback: search for "You said:" in all elements
      if (userMsgs.length === 0) {
        const allEls = clone.querySelectorAll('*');
        for (let ei = 0; ei < allEls.length; ei++) {
          const el = allEls[ei];
          let txt = '';
          for (let i = 0; i < el.childNodes.length; i++) {
            if (el.childNodes[i].nodeType === 3) {
              txt = el.childNodes[i].textContent.trim();
              if (txt) break;
            }
          }

          if (txt.startsWith('You said:') || txt.startsWith('You:')) {
            let cont = el.parentElement;
            let depth = 0;
            while (cont && cont !== clone && depth < 8) {
              const par = cont.parentElement;
              if (!par || par === clone) break;
              if (par.children.length > 1 && par.children[0] === cont) {
                break;
              }
              cont = par;
              depth++;
            }
            if (cont && !userMsgs.includes(cont)) {
              userMsgs.push(cont);
            }
          }
        }
      }

      // Wrap user messages in styled boxes
      userMsgs.forEach(function(cont) {
        const wrap = document.createElement('div');
        wrap.className = 'cgpt-user-message-wrapper';

        const box = document.createElement('div');
        box.className = 'cgpt-user-message-box';

        while (cont.firstChild) {
          box.appendChild(cont.firstChild);
        }

        // Remove "You said:" prefix
        const firstText = box.textContent.trim();
        if (firstText.startsWith('You said:')) {
          const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent.trim().startsWith('You said:')) {
              node.textContent = node.textContent.replace(/^You said:\s*/, '');
              break;
            }
          }
        }

        // Style images in user messages
        box.querySelectorAll('img').forEach(function(img) {
          img.style.cssText =
            'max-width:400px!important;height:auto!important;border-radius:8px;' +
            'margin:10px 0 10px auto!important;display:block!important';
        });

        // Remove empty sr-only headers
        box.querySelectorAll('h5.sr-only,h1.sr-only,h2.sr-only,h3.sr-only,h4.sr-only,h6.sr-only').forEach(function(h) {
          if (!h.textContent.trim()) {
            h.remove();
          }
        });

        wrap.appendChild(box);
        cont.appendChild(wrap);
      });

      // ===== PHASE 6: CONVERT IMAGES TO DATA URLs =====

      const imgs = Array.from(clone.querySelectorAll('img'));

      async function toDataURL(img) {
        const src = img.getAttribute('src') || img.dataset.src || img.getAttribute('data-src') || '';
        if (!src || src.startsWith('data:')) return;

        try {
          const response = await fetch(src);
          if (!response.ok) throw new Error('fetch fail');
          const blob = await response.blob();

          await new Promise(function(resolve) {
            const fr = new FileReader();
            fr.onload = function() {
              try {
                img.setAttribute('src', fr.result);
                resolve();
              } catch (e) {
                resolve();
              }
            };
            fr.onerror = function() {
              resolve();
            };
            fr.readAsDataURL(blob);
          });
        } catch (e) {}
      }

      for (let i = 0; i < imgs.length; i++) {
        try {
          await toDataURL(imgs[i]);
        } catch (e) {}
      }

      // ===== PHASE 7: GENERATE HTML FILE =====

      const css = '.cgpt-export{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif!important;margin:20px auto!important;line-height:1.6!important;color:#374151!important;max-width:100%!important;padding:0!important;box-sizing:border-box!important}.cgpt-export *{box-sizing:border-box!important}.cgpt-export-title{display:block!important;font-size:1.8rem!important;margin:0 0 6px 0!important;font-weight:600!important;color:#111!important;line-height:1.3!important;font-family:inherit!important}.cgpt-export-meta{display:block!important;color:#6b7280!important;margin:0 0 8px 0!important;font-size:.9rem!important;font-family:inherit!important;line-height:1.4!important}.cgpt-export-sep{display:block!important;border:0!important;border-top:1px solid #e5e7eb!important;margin:10px 0 14px!important;height:0!important}.cgpt-export img{max-width:400px!important;height:auto!important;border-radius:8px!important;margin:10px 0!important;display:block!important}.cgpt-export pre{background:#f3f4f6!important;padding:12px!important;border-radius:6px!important;overflow:auto!important;margin:10px 0!important;font-family:monospace!important;font-size:0.9em!important;line-height:1.5!important}.cgpt-export code{background:#f3f4f6!important;padding:2px 6px!important;border-radius:4px!important;font-family:monospace!important;font-size:0.9em!important}.cgpt-export .whitespace-pre-wrap{white-space:pre-wrap!important}.cgpt-export a[href^="http"]{background:#d1d5db!important;color:#1f2937!important;text-decoration:none!important;padding:1px 4px!important;border-radius:6px!important;font-size:0.75rem!important;display:inline-block!important;margin:2px!important;font-weight:500!important;border:1px solid #9ca3af!important;line-height:1.4!important}.cgpt-export a[href^="http"]:hover{background:#9ca3af!important;color:#111!important}.cgpt-user-message-wrapper{display:flex!important;justify-content:flex-end!important;margin:40px 0 20px 0!important;width:100%!important;clear:both!important}.cgpt-user-message-box{background:#ececec!important;border-radius:18px!important;padding:12px 16px!important;max-width:80%!important;text-align:left!important;word-wrap:break-word!important;box-shadow:0 1px 2px rgba(0,0,0,0.05)!important;color:#111!important;font-size:1rem!important;line-height:1.6!important;font-family:inherit!important}.cgpt-user-message-box *{text-align:left!important;color:inherit!important;font-family:inherit!important}.cgpt-user-message-box img{display:block!important;margin:10px 0 10px auto!important}.cgpt-citations-wrapper{display:block!important;margin:10px 0!important;padding:0!important}.cgpt-citations-toggle{display:inline-block!important;font-weight:600!important;cursor:pointer!important;user-select:none!important;padding:8px 12px!important;color:#374151!important;font-size:0.95rem!important;line-height:1.5!important;background:#f3f4f6!important;border-radius:8px!important;border:1px solid #d1d5db!important;font-family:inherit!important;margin:8px 0!important}.cgpt-citations-toggle:hover{background:#e5e7eb!important;color:#1f2937!important}.cgpt-toggle-icon{display:inline-block!important;width:12px!important;text-align:center!important;margin-right:4px!important;font-family:inherit!important}.cgpt-citations-list{display:none!important;margin:8px 0!important;padding:12px!important;background:#ffffff!important;border:1px solid #e5e7eb!important;border-radius:6px!important;box-sizing:border-box!important}.cgpt-citations-list a{display:block!important;margin:6px 0!important;color:#2563eb!important;text-decoration:underline!important;font-size:0.95rem!important;line-height:1.5!important;padding:4px 0!important;word-wrap:break-word!important;font-family:inherit!important}.cgpt-citations-list a:hover{color:#1d4ed8!important}.cgpt-export h1,.cgpt-export h2,.cgpt-export h3,.cgpt-export h4,.cgpt-export h5,.cgpt-export h6{font-weight:600!important;color:#111!important;line-height:1.3!important;margin-top:1.5em!important;margin-bottom:0.5em!important;font-family:inherit!important}.cgpt-export h3{font-size:1.25em!important}.cgpt-export strong{font-weight:600!important}.cgpt-export em{font-style:italic!important}.cgpt-export p{margin-bottom:1em!important}.cgpt-export ul,.cgpt-export ol{margin:10px 0!important;padding-left:20px!important}.cgpt-export li{margin:5px 0!important;line-height:1.6!important}.cgpt-export blockquote{margin:10px 0!important;padding:10px 20px!important;border-left:4px solid #d1d5db!important;background:#f9fafb!important}@media print{.cgpt-export img{max-width:350px!important}.cgpt-user-message-box{background:#ececec!important}.cgpt-citations-list{display:block!important}}';

      const title = document.title || 'ChatGPT Conversation';
      const dt = new Date();

      function pad(n) {
        return String(n).padStart(2, '0');
      }

      // Generate filename: chatgpt-YYYYMMDD-title.html
      const base = 'chatgpt-' + dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate());
      const slug = (title || '')
        .trim()
        .replace(/[\s\u0000-\u001F\u007F]+/g, ' ')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/[\. ]+$/g, '');

      const fname = slug ? `${base}-${slug}.html` : `${base}.html`;

      const fragment = `<div class="cgpt-export"><h1 class="cgpt-export-title">${title}</h1><p class="cgpt-export-meta">Exported: ${dt.toLocaleString()}</p><hr class="cgpt-export-sep"><div class="cgpt-export-body">${clone.innerHTML}</div><style>${css}</style></div>`;

      const barCSS = '#cgpt-toast{position:fixed;top:20px;right:20px;z-index:2147483647;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;font:14px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s;pointer-events:none}#cgpt-toast.show{opacity:1}';

      // HTML with keyboard shortcut for WordPress workflow
      const standaloneHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="canonical" href=""><meta name="robots" content="index,follow"><script>document.querySelector('link[rel="canonical"]').href=window.location.href;</script></head><body style="margin:0;padding:0;overflow:auto"><style>${barCSS}</style><div id="cgpt-toast"></div>${fragment}<script>(function(){try{function showToast(msg){var toast=document.getElementById("cgpt-toast");if(toast){toast.textContent=msg;toast.classList.add("show");setTimeout(function(){toast.classList.remove("show")},2000)}}function legacyCopy(t){var ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand("copy")}catch(_){}ta.remove();return ok}function copyIframe(){var url=window.location.href;var iframeHtml='<iframe src="'+url+'" scrolling="no" style="width:100%;border:none;min-height:600px;overflow:hidden" onload="this.style.height=(this.contentWindow.document.body.scrollHeight+20)+\\'px\\'"><\\/iframe>';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(iframeHtml).then(function(){showToast("✓ iframe code copied!")}).catch(function(){if(legacyCopy(iframeHtml)){showToast("✓ iframe code copied!")}})}else{if(legacyCopy(iframeHtml)){showToast("✓ iframe code copied!")}}}document.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.key==="C"||e.key==="c")){e.preventDefault();copyIframe()}});document.querySelectorAll(".cgpt-citations-toggle").forEach(function(toggle){toggle.addEventListener("click",function(){var targetId=this.getAttribute("data-target");var list=document.getElementById(targetId);var icon=this.querySelector(".cgpt-toggle-icon");if(list&&icon){if(list.style.display==="none"||!list.style.display){list.style.display="block";icon.textContent="▼"}else{list.style.display="none";icon.textContent="▶"}}})})}catch(e){console.error("Script error:",e)}})();</script></body></html>`;

      // Download the standalone file (what gets uploaded to WordPress)
      const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();

      setTimeout(function() {
        URL.revokeObjectURL(a.href);
        a.remove();
        window.__CGPT_HTML_EXPORTING = false;
      }, 2000);

    } catch (e) {
      console.error(e);
      window.__CGPT_HTML_EXPORTING = false;
    }
  }, 1000);
})();
