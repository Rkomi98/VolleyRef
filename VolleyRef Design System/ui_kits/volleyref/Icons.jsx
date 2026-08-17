(function () {
  const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const S = (paths, vb) => (p) => React.createElement('svg', { width: p.size || 18, height: p.size || 18, viewBox: vb || '0 0 24 24', style: p.style, ...base }, paths.map((el, i) => React.cloneElement(el, { key: i })));
  const P = (d) => React.createElement('path', { d });
  const El = (tag, attrs) => React.createElement(tag, attrs);

  window.VRIcons = {
    Upload: S([P('M12 16V4M7 9l5-5 5 5'), P('M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3')]),
    FileText: S([P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'), P('M14 2v6h6'), P('M8 13h8M8 17h8M8 9h2')]),
    X: S([P('M18 6L6 18M6 6l12 12')]),
    Check: S([P('M5 13l5 5L20 6')]),
    CheckCircle: S([El('circle', { cx: 12, cy: 12, r: 9 }), P('M8 12.5l2.5 2.5L16 9.5')]),
    AlertTriangle: S([P('M10.3 3.9L2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z'), P('M12 9v4'), P('M12 17h.01')]),
    AlertCircle: S([El('circle', { cx: 12, cy: 12, r: 9 }), P('M12 8v5'), P('M12 16h.01')]),
    ChevronDown: S([P('M6 9l6 6 6-6')]),
    ChevronLeft: S([P('M15 18l-6-6 6-6')]),
    ChevronRight: S([P('M9 18l6-6-6-6')]),
    ZoomIn: S([El('circle', { cx: 11, cy: 11, r: 7 }), P('M21 21l-4.3-4.3'), P('M11 8v6M8 11h6')]),
    ZoomOut: S([El('circle', { cx: 11, cy: 11, r: 7 }), P('M21 21l-4.3-4.3'), P('M8 11h6')]),
    Maximize: S([P('M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3')]),
    RotateCw: S([P('M21 12a9 9 0 1 1-3-6.7'), P('M21 3v6h-6')]),
    Eye: S([P('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'), El('circle', { cx: 12, cy: 12, r: 3 })]),
    EyeOff: S([P('M17.9 17.9A10.6 10.6 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 4.2-5.4M9.5 5.2A10 10 0 0 1 12 5c7 0 11 8 11 8a19.6 19.6 0 0 1-2.2 3.2'), P('M14.1 14.1a3 3 0 1 1-4.2-4.2'), P('M2 2l20 20')]),
    Download: S([P('M12 3v12M7 10l5 5 5-5'), P('M4 20h16')]),
    RefreshCw: S([P('M21 12a9 9 0 0 1-15.4 6.4M3 12a9 9 0 0 1 15.4-6.4'), P('M21 3v6h-6'), P('M3 21v-6h6')]),
    MoreVertical: S([El('circle', { cx: 12, cy: 5, r: 1.2, fill: 'currentColor' }), El('circle', { cx: 12, cy: 12, r: 1.2, fill: 'currentColor' }), El('circle', { cx: 12, cy: 19, r: 1.2, fill: 'currentColor' })]),
    Search: S([El('circle', { cx: 11, cy: 11, r: 7 }), P('M21 21l-4.3-4.3')]),
    Pencil: S([P('M12 20h9'), P('M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')]),
    Undo: S([P('M3 7v6h6'), P('M3 13a9 9 0 1 0 3-7')]),
    PanelLeft: S([El('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), P('M9 4v16')]),
    PanelRight: S([El('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), P('M15 4v16')]),
    Columns: S([El('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), P('M12 4v16')]),
    ArrowLeft: S([P('M19 12H5'), P('M12 19l-7-7 7-7')]),
    FileSpreadsheet: S([P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'), P('M14 2v6h6'), P('M8 13h8M8 17h8M11 13v7')]),
    Loader: S([P('M12 2v4'), P('M12 18v4'), P('M4.9 4.9l2.8 2.8'), P('M16.3 16.3l2.8 2.8'), P('M2 12h4'), P('M18 12h4'), P('M4.9 19.1l2.8-2.8'), P('M16.3 7.7l2.8-2.8')]),
    Table: S([El('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), P('M3 10h18'), P('M9 4v16')]),
    Grid: S([El('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }), El('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }), El('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }), El('rect', { x: 14, y: 14, width: 7, height: 7, rx: 1 })]),
    Ball: S([El('circle', { cx: 12, cy: 12, r: 9.5 }), P('M4.5 8.5C9 4 15 4 19.5 8.5'), P('M4.5 15.5C9 20 15 20 19.5 15.5'), P('M9 3.5C14 10 14 14 9 20.5')]),
    Home: S([P('M4 11.5L12 4l8 7.5'), P('M6 10v10h12V10')]),
  };
})();
