(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemDashboardParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parse(source) {
    const model = {
      title: 'Panel kursanta',
      intro: [],
      notices: [],
      sections: []
    };
    let currentSection = null;
    let currentGroup = null;
    let groupStack = [];
    let insideComment = false;

    String(source || '').replace(/\r\n?/g, '\n').split('\n').forEach((rawLine) => {
      const line = rawLine.trim();

      if (insideComment) {
        if (line.includes('-->')) insideComment = false;
        return;
      }
      if (line.startsWith('<!--')) {
        if (!line.includes('-->')) insideComment = true;
        return;
      }
      if (!line) return;

      const sectionMatch = line.match(/^##\s+(.+)$/);
      if (sectionMatch) {
        currentSection = {
          title: sectionMatch[1].trim(),
          description: [],
          notices: [],
          items: [],
          groups: []
        };
        currentGroup = null;
        groupStack = [];
        model.sections.push(currentSection);
        return;
      }

      const groupMatch = line.match(/^(#{3,6})\s+(.+)$/);
      if (groupMatch && currentSection) {
        const level = groupMatch[1].length;
        const group = {
          level,
          title: groupMatch[2].trim(),
          description: [],
          notices: [],
          items: [],
          groups: []
        };
        while (groupStack.length && groupStack[groupStack.length - 1].level >= level) {
          groupStack.pop();
        }
        const parent = groupStack[groupStack.length - 1] || null;
        if (parent) parent.groups.push(group);
        else currentSection.groups.push(group);
        groupStack.push(group);
        currentGroup = group;
        return;
      }

      const titleMatch = line.match(/^#\s+(.+)$/);
      if (titleMatch) {
        model.title = titleMatch[1].trim();
        return;
      }

      const noticeMatch = line.match(/^>\s*(.+)$/);
      if (noticeMatch) {
        const target = currentGroup
          ? currentGroup.notices
          : currentSection ? currentSection.notices : model.notices;
        target.push(noticeMatch[1].trim());
        return;
      }

      const linkMatch = line.match(/^[-*]\s+\[([^\]]+)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\s*(?:(?:—|–|-|:)\s*(.*))?$/);
      if (linkMatch && currentSection) {
        const target = currentGroup ? currentGroup.items : currentSection.items;
        target.push({
          title: linkMatch[1].trim(),
          href: linkMatch[2].trim(),
          description: (linkMatch[3] || '').trim()
        });
        return;
      }

      const cleanLine = line.replace(/^#{3,6}\s+/, '');
      if (currentGroup) currentGroup.description.push(cleanLine);
      else if (currentSection) currentSection.description.push(cleanLine);
      else model.intro.push(cleanLine);
    });

    return model;
  }

  return Object.freeze({ parse });
});
