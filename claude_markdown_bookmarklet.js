/**
 * Claude Markdown Exporter Bookmarklet
 *
 * This bookmarklet exports Claude conversations to a Markdown file.
 */

javascript:(function() {
  setTimeout(function() {
    if (!location.hostname.endsWith('claude.ai')) {
      alert('Open a Claude conversation on claude.ai first.');
      return;
    }

    const chatRoot = document.body;
    if (!chatRoot) {
      alert('Claude page body not found.');
      return;
    }

    const userNodes = sortByDocumentOrder(
      Array.from(chatRoot.querySelectorAll('[data-testid="user-message"]'))
    );

    if (!userNodes.length) {
      alert('Claude user messages not found. The page structure may have changed.');
      return;
    }

    const turns = [];
    userNodes.forEach(function(userNode, index) {
      const userMarkdown = nodeToMarkdown(userNode).trim();
      const claudeMarkdown = cleanClaudeMarkdown(
        extractClaudeReply(userNode, userNodes[index + 1], chatRoot)
      );

      if (userMarkdown) {
        turns.push({ role: 'User', markdown: userMarkdown });
      }

      if (claudeMarkdown) {
        turns.push({ role: 'Claude', markdown: claudeMarkdown });
      }
    });

    if (!turns.length) {
      alert('No exportable Claude message content found.');
      return;
    }

    if (!turns.some(function(turn) { return turn.role === 'Claude'; })) {
      alert('Claude replies were not found. The page structure may have changed.');
      return;
    }

    const title = getTitle(turns);
    const markdown = [
      '# ' + title,
      '',
      'Exported: ' + new Date().toLocaleString(),
      '',
      turns.map(function(turn) {
        return '## ' + turn.role + '\n\n' + turn.markdown;
      }).join('\n\n---\n\n')
    ].join('\n');

    downloadMarkdown(markdown, slugify(title) + '.md');
  }, 500);

  function getTitle(turns) {
    const documentTitle = document.title
      .replace(/\s*\|\s*Claude\s*$/i, '')
      .replace(/\s*-\s*Claude\s*$/i, '')
      .trim();

    if (documentTitle && documentTitle.toLowerCase() !== 'claude') {
      return documentTitle;
    }

    const firstUserTurn = turns.find(function(turn) {
      return turn.role === 'User';
    });

    if (firstUserTurn) {
      return firstUserTurn.markdown.split(/\s+/).slice(0, 10).join(' ');
    }

    return 'Claude Conversation';
  }

  function downloadMarkdown(markdown, filename) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function slugify(value) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return slug || 'claude-conversation';
  }

  function sortByDocumentOrder(nodes) {
    return nodes.filter(function(node, index) {
      return nodes.indexOf(node) === index;
    }).sort(function(a, b) {
      if (a === b) return 0;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  function extractClaudeReply(userNode, nextUserNode, chatRoot) {
    const range = document.createRange();
    range.setStartAfter(userNode);

    if (nextUserNode) {
      range.setEndBefore(nextUserNode);
    } else {
      range.setEnd(chatRoot, chatRoot.childNodes.length);
    }

    const fragment = range.cloneContents();
    cleanupExportFragment(fragment);
    range.detach();

    return nodeToMarkdown(fragment).trim();
  }

  function cleanupExportFragment(fragment) {
    fragment.querySelectorAll([
      '[data-testid="user-message"]',
      'button',
      '[role="button"]',
      '[role="menu"]',
      '[role="menubar"]',
      '[role="toolbar"]',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[data-testid*="thinking"]',
      '[class*="thinking"]',
      'input',
      'select',
      'textarea',
      'svg'
    ].join(',')).forEach(function(node) {
      node.remove();
    });
  }

  function cleanClaudeMarkdown(markdown) {
    let lines = markdown
      .replace(/\r\n/g, '\n')
      .trim()
      .split('\n')
      .map(function(line) {
        return line.trimEnd();
      });

    lines = removeLeakedUserPrompt(lines);

    const respondedIndex = lines.findIndex(function(line) {
      return /^(#{1,6}\s*)?Claude responded:\s*/i.test(line.trim());
    });

    if (respondedIndex !== -1) {
      const respondedText = lines[respondedIndex]
        .trim()
        .replace(/^#{1,6}\s*/, '')
        .replace(/^Claude responded:\s*/i, '')
        .trim();

      lines = removeClaudeLeadIn(lines.slice(respondedIndex + 1), respondedText);
    } else {
      lines = removeLeadingClaudeMetadata(lines);
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function removeLeakedUserPrompt(lines) {
    const leakedUserIndex = lines.findIndex(function(line) {
      return /^(#{1,6}\s*)?You said:\s*/i.test(line.trim());
    });

    if (leakedUserIndex === -1) {
      return lines;
    }

    return lines.slice(0, leakedUserIndex);
  }

  function removeClaudeLeadIn(lines, respondedText) {
    lines = removeLeadingClaudeMetadata(lines);

    if (respondedText) {
      const answerStartIndex = lines.findIndex(function(line) {
        return line.trim().startsWith(respondedText);
      });

      if (answerStartIndex !== -1) {
        return lines.slice(answerStartIndex);
      }
    }

    if (lines.length > 1 && isThinkingSummaryLine(lines[0])) {
      lines.shift();
    }

    return removeLeadingClaudeMetadata(lines);
  }

  function removeLeadingClaudeMetadata(lines) {
    while (lines.length && isClaudeMetadataLine(lines[0])) {
      lines.shift();
    }

    return lines;
  }

  function isClaudeMetadataLine(line) {
    const text = line.trim();

    return (
      text === '' ||
      /^Claude$/i.test(text) ||
      /^(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2}(,\s+\d{4})?$/i.test(text) ||
      /^(Today|Yesterday)$/i.test(text) ||
      /^(Thought|Thinking|Thought for|Thinking for)\b/i.test(text)
    );
  }

  function isThinkingSummaryLine(line) {
    const text = line.trim();

    return (
      text.length > 0 &&
      text.length < 140 &&
      !/[.!?:;]$/.test(text) &&
      /^(Analyzed|Assessed|Compared|Considered|Evaluated|Examined|Explored|Outlined|Reviewed|Tested|Thought|Weighed)\b/i.test(text)
    );
  }

  function nodeToMarkdown(node, context) {
    context = context || {};

    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return childrenToMarkdown(node, context);
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\s+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tag = node.tagName.toLowerCase();

    if (['script', 'style', 'button', 'svg', 'textarea', 'input', 'select'].includes(tag)) {
      return '';
    }

    if (node.getAttribute('aria-hidden') === 'true') {
      return '';
    }

    if (
      node.getAttribute('contenteditable') === 'true' ||
      ['button', 'menu', 'menubar', 'toolbar', 'textbox'].includes(node.getAttribute('role'))
    ) {
      return '';
    }

    if (tag === 'br') {
      return '\n';
    }

    if (tag === 'pre') {
      const code = node.querySelector('code') || node;
      const language = getCodeLanguage(code);
      const text = code.textContent.replace(/\n+$/g, '');
      const fence = getFence(text);
      return '\n\n' + fence + language + '\n' + text + '\n' + fence + '\n\n';
    }

    if (tag === 'code') {
      return inlineCode(node.textContent);
    }

    if (tag === 'a') {
      const text = childrenToMarkdown(node, context).trim() || node.href;
      return '[' + text.replace(/\]/g, '\\]') + '](' + node.href + ')';
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      return '\n\n' + '#'.repeat(level) + ' ' + childrenToMarkdown(node, context).trim() + '\n\n';
    }

    if (tag === 'p') {
      return '\n\n' + childrenToMarkdown(node, context).trim() + '\n\n';
    }

    if (tag === 'strong' || tag === 'b') {
      return '**' + childrenToMarkdown(node, context).trim() + '**';
    }

    if (tag === 'em' || tag === 'i') {
      return '*' + childrenToMarkdown(node, context).trim() + '*';
    }

    if (tag === 'blockquote') {
      return '\n\n' + childrenToMarkdown(node, context).trim()
        .split('\n')
        .map(function(line) {
          return line.trim() ? '> ' + line : '>';
        })
        .join('\n') + '\n\n';
    }

    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      const items = Array.from(node.children).filter(function(child) {
        return child.tagName && child.tagName.toLowerCase() === 'li';
      });

      return '\n' + items.map(function(item, index) {
        return listItemToMarkdown(item, ordered, index + 1, context.depth || 0);
      }).join('\n') + '\n';
    }

    if (tag === 'li') {
      return listItemToMarkdown(node, false, 1, context.depth || 0);
    }

    if (tag === 'table') {
      return tableToMarkdown(node);
    }

    if (isBlockElement(tag)) {
      return '\n\n' + childrenToMarkdown(node, context).trim() + '\n\n';
    }

    return childrenToMarkdown(node, context);
  }

  function childrenToMarkdown(node, context) {
    return Array.from(node.childNodes).map(function(child) {
      return nodeToMarkdown(child, context);
    }).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  function listItemToMarkdown(item, ordered, index, depth) {
    const marker = ordered ? index + '. ' : '- ';
    const indent = '  '.repeat(depth);
    const nestedLists = Array.from(item.children).filter(function(child) {
      const tag = child.tagName ? child.tagName.toLowerCase() : '';
      return tag === 'ul' || tag === 'ol';
    });
    const nestedSet = new Set(nestedLists);
    const mainText = Array.from(item.childNodes).map(function(child) {
      if (nestedSet.has(child)) return '';
      return nodeToMarkdown(child, { depth: depth + 1 });
    }).join('').trim();
    const nestedText = nestedLists.map(function(list) {
      return nodeToMarkdown(list, { depth: depth + 1 }).replace(/^\n+|\n+$/g, '');
    }).filter(Boolean).join('\n');

    return indent + marker + mainText + (nestedText ? '\n' + nestedText : '');
  }

  function tableToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll('tr')).map(function(row) {
      return Array.from(row.children).map(function(cell) {
        return childrenToMarkdown(cell, {}).trim().replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
      });
    }).filter(function(row) {
      return row.length > 0;
    });

    if (!rows.length) {
      return '';
    }

    const columnCount = Math.max.apply(null, rows.map(function(row) {
      return row.length;
    }));
    const normalizedRows = rows.map(function(row) {
      while (row.length < columnCount) row.push('');
      return row;
    });
    const header = normalizedRows[0];
    const separator = header.map(function() {
      return '---';
    });
    const body = normalizedRows.slice(1);

    return '\n\n' + [header, separator].concat(body).map(function(row) {
      return '| ' + row.join(' | ') + ' |';
    }).join('\n') + '\n\n';
  }

  function getCodeLanguage(code) {
    const className = code.className || '';
    const match = String(className).match(/language-([a-z0-9_-]+)/i);
    return match ? match[1] : '';
  }

  function getFence(text) {
    const matches = text.match(/`{3,}/g) || [];
    const longest = matches.reduce(function(max, match) {
      return Math.max(max, match.length);
    }, 2);

    return '`'.repeat(longest + 1);
  }

  function inlineCode(text) {
    const trimmed = text.trim();
    const ticks = trimmed.match(/`+/g) || [];
    const longest = ticks.reduce(function(max, tick) {
      return Math.max(max, tick.length);
    }, 0);
    const fence = '`'.repeat(longest + 1);

    return fence + trimmed + fence;
  }

  function isBlockElement(tag) {
    return [
      'article',
      'aside',
      'div',
      'figure',
      'figcaption',
      'footer',
      'header',
      'main',
      'nav',
      'section'
    ].includes(tag);
  }
})();
