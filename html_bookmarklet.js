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

        // Wait for modal to appear (max 3 seconds)
        let modal = null;
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(r => setTimeout(r, 150));
          modal = document.querySelector('.content-sheet') ||
                  document.querySelector('[data-content-sheet-section]') ||
                  document.querySelector('[data-testid="modal-search-results"]') ||
                  document.querySelector('[role="dialog"]');
          if (modal) break;
        }

        if (!modal) {
          // Modal didn't appear, skip this button
          citationsByIndex[idx] = [];
          const closeAnyModal = document.querySelector('button[data-silk*="a16"]') ||
                                document.querySelector('[data-testid="close-button"]') ||
                                document.querySelector('button[aria-label*="Close"]');
          if (closeAnyModal) {
            closeAnyModal.click();
            await new Promise(r => setTimeout(r, 150));
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

        // Close modal
        const closeBtn = modal.querySelector('[data-testid="close-button"]');
        if (closeBtn) {
          closeBtn.click();
        }
        await new Promise(r => setTimeout(r, 250));
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

      // Extract images from buttons (but not Sources buttons)
      clone.querySelectorAll('button').forEach(function(btn) {
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

          if (citations && citations.length > 0) {
            const citId = 'cit-' + citIndex++;
            const displayType = 'Sources';

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'cgpt-citations-wrapper';
            wrapper.style.cssText = 'margin:10px 0!important;';

            // Create toggle button
            const toggle = document.createElement('div');
            toggle.className = 'cgpt-citations-toggle';
            toggle.setAttribute('data-target', citId);
            toggle.innerHTML = `<span class="cgpt-toggle-icon">▶</span> ${displayType} (${citations.length})`;
            toggle.style.cssText =
              'font-weight:600;cursor:pointer;user-select:none;' +
              'padding:4px 0;color:#374151;';

            // Create links list
            const linksList = document.createElement('div');
            linksList.id = citId;
            linksList.className = 'cgpt-citations-list';
            linksList.style.cssText = 'display:none;margin-top:5px;padding-left:16px;';

            citations.forEach(function(cit) {
              const a = document.createElement('a');
              a.href = cit.url;
              a.textContent = cit.title;
              a.target = '_blank';
              a.style.cssText =
                'display:block!important;margin:3px 0!important;' +
                'color:#1f2937!important;text-decoration:underline!important;';
              linksList.appendChild(a);
            });

            wrapper.appendChild(toggle);
            wrapper.appendChild(linksList);
            e.parentNode.replaceChild(wrapper, e);
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

      const css = '.cgpt-export,.cgpt-export *{-webkit-print-color-adjust:exact!important;color-adjust:exact!important;print-color-adjust:exact!important}.cgpt-export{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:20px;line-height:1.6;color:#374151}.cgpt-export-title{font-size:1.8rem;margin:0 0 6px 0}.cgpt-export-meta{color:#6b7280;margin:0 0 8px 0;font-size:.9rem}.cgpt-export-sep{border:0;border-top:1px solid #e5e7eb;margin:10px 0 14px}.cgpt-export img{max-width:400px!important;height:auto!important;border-radius:8px;margin:10px 0!important;display:block!important}.cgpt-export pre{background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto}.cgpt-export code{background:#f3f4f6;padding:2px 6px;border-radius:4px}.cgpt-export .whitespace-pre-wrap{white-space:pre-wrap}.cgpt-export a[href^="http"]{background:#d1d5db!important;color:#1f2937!important;text-decoration:none!important;padding:1px 4px!important;border-radius:6px!important;font-size:0.75rem!important;display:inline-block!important;margin:2px!important;font-weight:500!important;border:1px solid #9ca3af!important}.cgpt-export a[href^="http"]:hover{background:#9ca3af!important}.cgpt-user-message-wrapper{display:flex!important;justify-content:flex-end!important;margin:40px 0 20px 0!important;width:100%!important}.cgpt-user-message-box{background:#ececec!important;border-radius:18px!important;padding:12px 16px!important;max-width:80%!important;text-align:left!important;word-wrap:break-word!important;box-shadow:0 1px 2px rgba(0,0,0,0.05)!important}.cgpt-user-message-box *{text-align:left!important;padding-top:0!important}.cgpt-user-message-box img{display:block!important;margin:10px 0 10px auto!important}.cgpt-citations-toggle:hover{color:#1f2937!important;opacity:0.8}.cgpt-toggle-icon{display:inline-block;transition:transform 0.2s;width:12px;text-align:center}.cgpt-citations-list{transition:all 0.3s ease}@media print{.cgpt-export,.cgpt-export *{-webkit-print-color-adjust:exact!important;color-adjust:exact!important;print-color-adjust:exact!important}.cgpt-export img{max-width:350px!important}.cgpt-export a[href^="http"]{background:#d1d5db!important;border:1px solid #9ca3af!important}.cgpt-user-message-box{background:#ececec!important}.cgpt-citations-list{display:block!important}}';

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

      const barCSS = '#cgpt-copy-bar{position:sticky;top:0;z-index:2147483647;background:#0f172a;color:#fff;padding:10px 12px;border-bottom:1px solid #334155;font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,sans-serif}#cgpt-copy-bar .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#cgpt-copy-bar .title{font-weight:700;margin-right:10px}#cgpt-copy-bar button{background:#10b981;border:none;color:#0b1324;font-weight:600;border-radius:6px;padding:8px 12px;cursor:pointer}#cgpt-copy-bar button:hover{background:#0ea5e9;color:#02131f}#cgpt-copy-bar .note{opacity:.85}#cgpt-copy-bar .spacer{flex:1}#cgpt-copy-bar .close{margin-left:8px;background:#ef4444;color:#fff}#cgpt-copy-bar .close:hover{background:#dc2626}';

      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><style>${barCSS}</style><div id="cgpt-copy-bar"><div class="row"><span class="title">Chat Export</span><button id="cgpt-copy-btn" onclick="window.CGPT_copy && window.CGPT_copy()">Copy for WordPress</button><span class="note">Copies only the export block; styles are scoped</span><span class="spacer"></span><button id="cgpt-close-btn" class="close" title="Dismiss" onclick="window.CGPT_close && window.CGPT_close()">✕</button></div></div>${fragment}<script>(function(){try{function pretty(t){return t.replace(/></g,">\\n<");}function legacyCopy(t){var ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand("copy")}catch(_){}ta.remove();return ok}window.CGPT_copy=function(){var btn=document.getElementById("cgpt-copy-btn");var el=document.querySelector(".cgpt-export");if(!el)return;var t=pretty(el.outerHTML);if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){if(btn){btn.textContent="Copied!";setTimeout(function(){btn.textContent="Copy for WordPress"},1200)}}).catch(function(){if(legacyCopy(t)&&btn){btn.textContent="Copied!";setTimeout(function(){btn.textContent="Copy for WordPress"},1200)}})}else{if(legacyCopy(t)&&btn){btn.textContent="Copied!";setTimeout(function(){btn.textContent="Copy for WordPress"},1200)}}};window.CGPT_close=function(){var bar=document.getElementById("cgpt-copy-bar");if(bar)bar.remove()};document.querySelectorAll(".cgpt-citations-toggle").forEach(function(toggle){toggle.addEventListener("click",function(){var targetId=this.getAttribute("data-target");var list=document.getElementById(targetId);var icon=this.querySelector(".cgpt-toggle-icon");if(list&&icon){if(list.style.display==="none"){list.style.display="block";icon.textContent="▼"}else{list.style.display="none";icon.textContent="▶"}}})})}catch(e){console.error(e)}})();<\/script></body></html>`;

      // Download the file
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
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
