(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemDashboardParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parse(source) {
    const model = {
      id: 'course',
      type: 'course',
      progress: defaultProgress('ON', 'ON'),
      recordOpens: true,
      title: 'Panel kursanta',
      intro: [],
      notices: [],
      sections: []
    };
    let currentSection = null;
    let currentGroup = null;
    let groupStack = [];
    let insideComment = false;
    let pendingProgress = null;

    String(source || '').replace(/\r\n?/g, '\n').split('\n').forEach((rawLine) => {
      const line = rawLine.trim();

      const progressMatch = line.match(/^<!--\s*chemdisk-progress:(\{.*\})\s*-->$/i);
      if (progressMatch) {
        try { pendingProgress = normalizeMetadata(JSON.parse(progressMatch[1])); }
        catch (_) { pendingProgress = null; }
        return;
      }
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
          id: pendingProgress?.id || '',
          type: pendingProgress?.type || 'department',
          progress: pendingProgress?.progress || defaultProgress(),
          title: sectionMatch[1].trim(),
          description: [],
          notices: [],
          items: [],
          groups: []
        };
        currentGroup = null;
        groupStack = [];
        model.sections.push(currentSection);
        pendingProgress = null;
        return;
      }

      const groupMatch = line.match(/^(#{3,6})\s+(.+)$/);
      if (groupMatch && currentSection) {
        const level = groupMatch[1].length;
        const group = {
          id: pendingProgress?.id || '',
          type: pendingProgress?.type || (level === 3 ? 'section' : level === 4 ? 'subsection' : 'other'),
          progress: pendingProgress?.progress || defaultProgress(),
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
        pendingProgress = null;
        return;
      }

      const titleMatch = line.match(/^#\s+(.+)$/);
      if (titleMatch) {
        model.title = titleMatch[1].trim();
        if (pendingProgress) {
          model.id = pendingProgress.id || model.id;
          model.progress = pendingProgress.progress;
          model.recordOpens = pendingProgress.settings?.recordOpens !== false;
          pendingProgress = null;
        }
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
          id: pendingProgress?.id || '',
          type: pendingProgress?.type || materialType(linkMatch[2]),
          progress: pendingProgress?.progress || defaultProgress(),
          title: linkMatch[1].trim(),
          href: linkMatch[2].trim(),
          description: (linkMatch[3] || '').trim()
        });
        pendingProgress = null;
        return;
      }

      const cleanLine = line.replace(/^#{3,6}\s+/, '');
      if (currentGroup) currentGroup.description.push(cleanLine);
      else if (currentSection) currentSection.description.push(cleanLine);
      else model.intro.push(cleanLine);
    });

    assignStableIds(model);
    return model;
  }

  function defaultProgress(tracking = 'INHERIT', showProgress = 'INHERIT') {
    return {
      tracking,
      showProgress,
      includeInSection: true,
      includeInDepartment: true,
      includeInCourse: true,
      weight: 1
    };
  }

  function normalizeMetadata(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const progress = source.progress && typeof source.progress === 'object' ? source.progress : source;
    const state = (value) => ['ON', 'OFF', 'INHERIT'].includes(String(value || '').toUpperCase())
      ? String(value).toUpperCase() : 'INHERIT';
    return {
      id: /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(source.id || '') ? source.id : '',
      type: String(source.type || '').toLowerCase(),
      settings: {
        recordOpens: source.settings?.recordOpens !== false
      },
      progress: {
        tracking: state(progress.tracking),
        showProgress: state(progress.showProgress),
        includeInSection: true,
        includeInDepartment: true,
        includeInCourse: true,
        weight: Math.max(.01, Math.min(10000, Number(progress.weight) || 1))
      }
    };
  }

  function materialType(href) {
    try {
      const path = new URL(href, 'https://chemdisk.invalid').pathname;
      const moduleName = (path.match(/^\/members\/module\/([^/]+)/i) || [])[1]?.toLowerCase();
      return ({ lesson: 'lesson', slides: 'presentation', film: 'video', yt: 'video', pdf: 'pdf', forms: 'quiz', exam: 'exam', chat: 'script' })[moduleName] || (moduleName ? 'other' : 'embed');
    } catch (_) { return 'other'; }
  }

  function hashId(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function assignStableIds(model) {
    const used = new Set([model.id]);
    const unique = (preferred, prefix, source) => {
      let id = preferred || `${prefix}-${hashId(source)}`;
      let suffix = 2;
      while (used.has(id)) id = `${prefix}-${hashId(source)}-${suffix++}`;
      used.add(id);
      return id;
    };
    const visitGroup = (group, parentId) => {
      group.id = unique(group.id, group.type === 'section' ? 'section' : 'subsection', `${parentId}:${group.title}`);
      group.items.forEach((item) => {
        item.id = unique(item.id, item.type, `${group.id}:${item.href}:${item.title}`);
      });
      group.groups.forEach((child) => visitGroup(child, group.id));
    };
    model.sections.forEach((section) => {
      section.id = unique(section.id, 'department', section.title);
      section.items.forEach((item) => {
        item.id = unique(item.id, item.type, `${section.id}:${item.href}:${item.title}`);
      });
      section.groups.forEach((group) => visitGroup(group, section.id));
    });
  }

  return Object.freeze({ parse });
});
