/* @ds-bundle: {"format":4,"namespace":"VolleyRefDesignSystem_4fa89f","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"EditableValue","sourcePath":"components/data/EditableValue.jsx"},{"name":"Tabs","sourcePath":"components/data/Tabs.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"ConfidenceIndicator","sourcePath":"components/feedback/ConfidenceIndicator.jsx"},{"name":"ProgressStep","sourcePath":"components/feedback/ProgressStep.jsx"},{"name":"StatusBadge","sourcePath":"components/feedback/StatusBadge.jsx"},{"name":"ToastProvider","sourcePath":"components/feedback/Toast.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Dialog","sourcePath":"components/overlay/Dialog.jsx"},{"name":"Tooltip","sourcePath":"components/overlay/Tooltip.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"cdc035029361","components/actions/IconButton.jsx":"e7afe3678a3b","components/data/Card.jsx":"2dbf7839268d","components/data/EditableValue.jsx":"250fd0983f75","components/data/Tabs.jsx":"4ffc828db666","components/feedback/Badge.jsx":"1d2aaef5c3ee","components/feedback/ConfidenceIndicator.jsx":"77cb77f5a49f","components/feedback/ProgressStep.jsx":"c99e1bb2826d","components/feedback/StatusBadge.jsx":"3f4c0f55beac","components/feedback/Toast.jsx":"0a7a62186101","components/forms/Input.jsx":"014af12a4274","components/forms/SegmentedControl.jsx":"54b0ca793c5f","components/forms/Select.jsx":"9f15956cd56e","components/overlay/Dialog.jsx":"fef9223b53af","components/overlay/Tooltip.jsx":"5654758fb632","ui_kits/volleyref/AppHeader.jsx":"abe750ae5a71","ui_kits/volleyref/ExportDialog.jsx":"3f2845e35971","ui_kits/volleyref/HomeScreen.jsx":"1a421aff2424","ui_kits/volleyref/Icons.jsx":"643811c16ae2","ui_kits/volleyref/MatchHeader.jsx":"40ef31c22d37","ui_kits/volleyref/MatchSummary.jsx":"0c741c4b989c","ui_kits/volleyref/MatchWorkspace.jsx":"1bd388b9fcbf","ui_kits/volleyref/PdfToolbar.jsx":"e59aaa35ab7a","ui_kits/volleyref/PdfViewer.jsx":"0ad6df529cc9","ui_kits/volleyref/ProcessingState.jsx":"b10b10a55f1a","ui_kits/volleyref/RegionOverlay.jsx":"791eaad7fa98","ui_kits/volleyref/ResetCorrectionsDialog.jsx":"55d1c6070138","ui_kits/volleyref/RotationCourt.jsx":"8a2b7386443e","ui_kits/volleyref/ServiceTurnsTable.jsx":"1ba39fe62b8b","ui_kits/volleyref/SetSelector.jsx":"8ed4e3fe4129","ui_kits/volleyref/StartingSix.jsx":"7185a047ca82","ui_kits/volleyref/UploadDropzone.jsx":"167ad35e8226","ui_kits/volleyref/ValidationPanel.jsx":"414f54ccaf2f","ui_kits/volleyref/mock-data.js":"d5aab62dbc48"},"inlinedExternals":[],"unexposedExports":[{"name":"useToast","sourcePath":"components/feedback/Toast.jsx"}]} */

(() => {

const __ds_ns = (window.VolleyRefDesignSystem_4fa89f = window.VolleyRefDesignSystem_4fa89f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const sizes = {
    sm: {
      padding: '6px 12px',
      fontSize: 'var(--text-sm)',
      gap: 6,
      height: 32
    },
    md: {
      padding: '9px 16px',
      fontSize: 'var(--text-base)',
      gap: 8,
      height: 40
    },
    lg: {
      padding: '12px 20px',
      fontSize: 'var(--text-md)',
      gap: 8,
      height: 48
    }
  };
  const palette = {
    primary: {
      bg: 'var(--color-primary)',
      bgHover: 'var(--color-primary-hover)',
      bgActive: 'var(--color-primary-active)',
      fg: 'var(--text-on-primary)',
      border: 'transparent'
    },
    secondary: {
      bg: 'var(--color-white)',
      bgHover: 'var(--neutral-50)',
      bgActive: 'var(--neutral-100)',
      fg: 'var(--color-primary-dark)',
      border: 'var(--border-default)'
    },
    ghost: {
      bg: 'transparent',
      bgHover: 'var(--neutral-100)',
      bgActive: 'var(--neutral-150)',
      fg: 'var(--color-text-primary)',
      border: 'transparent'
    },
    danger: {
      bg: 'var(--color-danger)',
      bgHover: 'var(--color-danger-hover)',
      bgActive: 'var(--color-danger-hover)',
      fg: 'var(--color-white)',
      border: 'transparent'
    }
  };
  const p = palette[variant] || palette.primary;
  const s = sizes[size] || sizes.md;
  const bg = disabled ? 'var(--neutral-150)' : active ? p.bgActive : hover ? p.bgHover : p.bg;
  const fg = disabled ? 'var(--neutral-400)' : p.fg;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled || loading,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      padding: s.padding,
      height: s.height,
      fontSize: s.fontSize,
      fontFamily: 'var(--font-body)',
      fontWeight: 'var(--weight-semibold)',
      color: fg,
      background: bg,
      border: `1px solid ${p.border === 'transparent' ? 'transparent' : disabled ? 'var(--border-default)' : p.border}`,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast)',
      boxShadow: variant === 'primary' && !disabled ? 'var(--shadow-xs)' : 'none',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), icon && iconPosition === 'left' && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex'
    }
  }, icon), loading ? 'Attendere…' : children, icon && iconPosition === 'right' && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex'
    }
  }, icon));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
const {
  useState
} = React;
function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'default',
  active = false,
  disabled = false,
  onClick,
  style
}) {
  const [hover, setHover] = useState(false);
  const dims = {
    sm: 28,
    md: 36,
    lg: 44
  }[size] || 36;
  const bgIdle = variant === 'subtle' ? 'var(--neutral-100)' : 'transparent';
  const bg = disabled ? 'transparent' : active ? 'var(--color-primary-subtle)' : hover ? 'var(--neutral-100)' : bgIdle;
  const fg = disabled ? 'var(--neutral-400)' : active ? 'var(--color-primary)' : 'var(--color-text-primary)';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: dims,
      height: dims,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      background: bg,
      color: fg,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--duration-fast) var(--ease-standard)',
      ...style
    }
  }, icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function Card({
  children,
  padding = 20,
  interactive = false,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding,
      boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      transition: 'box-shadow var(--duration-base) var(--ease-standard)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-default)'
    }
  }, tabs.map(t => {
    const isActive = t.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      type: "button",
      role: "tab",
      "aria-selected": isActive,
      disabled: t.disabled,
      onClick: () => !t.disabled && onChange && onChange(t.value),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 6px',
        marginBottom: -1,
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
        color: t.disabled ? 'var(--neutral-300)' : isActive ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--weight-semibold)',
        fontSize: 'var(--text-base)',
        cursor: t.disabled ? 'not-allowed' : 'pointer',
        transition: 'color var(--duration-fast), border-color var(--duration-fast)'
      }
    }, t.icon, t.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    bg: 'var(--neutral-100)',
    fg: 'var(--color-text-secondary)'
  },
  primary: {
    bg: 'var(--color-primary-subtle)',
    fg: 'var(--color-primary-dark)'
  },
  success: {
    bg: 'var(--color-success-subtle)',
    fg: 'var(--color-success)'
  },
  warning: {
    bg: 'var(--color-warning-subtle)',
    fg: 'var(--color-warning-hover)'
  },
  danger: {
    bg: 'var(--color-danger-subtle)',
    fg: 'var(--color-danger)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  icon = null
}) {
  const t = tones[tone] || tones.neutral;
  const pad = size === 'sm' ? '2px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: pad,
      borderRadius: 'var(--radius-full)',
      background: t.bg,
      color: t.fg,
      fontSize,
      fontFamily: 'var(--font-body)',
      fontWeight: 'var(--weight-semibold)',
      lineHeight: 1.4
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressStep.jsx
try { (() => {
function ProgressStep({
  label,
  status = 'pending',
  description,
  isLast = false
}) {
  const colors = {
    pending: {
      dot: 'var(--neutral-200)',
      text: 'var(--color-text-secondary)',
      line: 'var(--neutral-200)'
    },
    processing: {
      dot: 'var(--color-primary)',
      text: 'var(--color-text-primary)',
      line: 'var(--neutral-200)'
    },
    completed: {
      dot: 'var(--color-success)',
      text: 'var(--color-text-primary)',
      line: 'var(--color-success)'
    },
    error: {
      dot: 'var(--color-danger)',
      text: 'var(--color-danger)',
      line: 'var(--neutral-200)'
    }
  };
  const c = colors[status] || colors.pending;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: status === 'pending' ? 'var(--color-white)' : c.dot,
      border: `2px solid ${c.dot}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, status === 'completed' && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    strokeWidth: "3.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 13l4 4L19 7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), status === 'processing' && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--color-white)',
      animation: 'vr-pulse 1.1s ease-in-out infinite'
    }
  }), status === 'error' && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18",
    strokeLinecap: "round"
  }))), !isLast && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 2,
      flex: 1,
      minHeight: 22,
      background: c.line,
      marginTop: 2
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: isLast ? 0 : 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-semibold)',
      color: c.text
    }
  }, label), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-secondary)',
      marginTop: 2
    }
  }, description)));
}
Object.assign(__ds_scope, { ProgressStep });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressStep.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CheckIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "3"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M5 13l4 4L19 7",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}));
const AlertIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.6"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M12 9v4M12 17h.01M10.3 3.9L2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}));
const ErrorIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.8"
}, p), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9.5 9.5l5 5m0-5l-5 5",
  strokeLinecap: "round"
}));
const DotIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  width: "10",
  height: "10",
  viewBox: "0 0 10 10"
}, p), /*#__PURE__*/React.createElement("circle", {
  cx: "5",
  cy: "5",
  r: "5",
  fill: "currentColor"
}));
const MAP = {
  validated: {
    label: 'Validato',
    bg: 'var(--color-success-subtle)',
    fg: 'var(--color-success)',
    Icon: CheckIcon
  },
  review: {
    label: 'Da verificare',
    bg: 'var(--color-warning-subtle)',
    fg: 'var(--color-warning-hover)',
    Icon: AlertIcon
  },
  inconsistent: {
    label: 'Incoerente',
    bg: 'var(--color-danger-subtle)',
    fg: 'var(--color-danger)',
    Icon: ErrorIcon
  },
  processing: {
    label: 'In elaborazione',
    bg: 'var(--color-primary-subtle)',
    fg: 'var(--color-primary-dark)',
    Icon: DotIcon
  }
};
function StatusBadge({
  status = 'validated',
  children,
  size = 'md'
}) {
  const m = MAP[status] || MAP.validated;
  const pad = size === 'sm' ? '3px 9px' : '5px 12px';
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: pad,
      borderRadius: 'var(--radius-full)',
      background: m.bg,
      color: m.fg,
      fontSize,
      fontWeight: 'var(--weight-semibold)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(m.Icon, {
    style: {
      flexShrink: 0
    }
  }), children || m.label);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState
} = React;
const ToastContext = createContext(null);
function ToastProvider({
  children
}) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((message, opts = {}) => {
    const id = ++idRef.current;
    setToasts(t => [...t, {
      id,
      message,
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
      tone: opts.tone || 'default'
    }]);
    setTimeout(() => dismiss(id), opts.duration || 4200);
    return id;
  }, [dismiss]);
  return /*#__PURE__*/React.createElement(ToastContext.Provider, {
    value: {
      push,
      dismiss
    }
  }, children, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: '50%',
      bottom: 28,
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 200
    }
  }, toasts.map(t => /*#__PURE__*/React.createElement(Toast, _extends({
    key: t.id
  }, t, {
    onDismiss: () => dismiss(t.id)
  })))));
}
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  tone = 'default'
}) {
  const border = tone === 'success' ? 'var(--color-success)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--neutral-800)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'var(--color-text-primary)',
      color: 'var(--color-white)',
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-body)',
      minWidth: 260,
      borderLeft: `3px solid ${border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, message), actionLabel && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onAction && onAction();
      onDismiss();
    },
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--color-primary)',
      fontWeight: 'var(--weight-semibold)',
      cursor: 'pointer',
      fontSize: 'var(--text-sm)',
      padding: 0
    }
  }, actionLabel), /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    "aria-label": "Chiudi",
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--neutral-400)',
      cursor: 'pointer',
      fontSize: 16,
      lineHeight: 1,
      padding: 0
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { ToastProvider, useToast, Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  icon = null,
  error = false,
  disabled = false,
  size = 'md',
  style,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const heights = {
    sm: 32,
    md: 40,
    lg: 46
  };
  const h = heights[size] || 40;
  const borderColor = error ? 'var(--color-danger)' : focused ? 'var(--color-primary)' : 'var(--border-default)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: h,
      padding: '0 12px',
      background: disabled ? 'var(--neutral-50)' : 'var(--color-white)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focused ? 'var(--shadow-focus)' : 'none',
      transition: 'border-color var(--duration-fast), box-shadow var(--duration-fast)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--color-text-secondary)'
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    placeholder: placeholder,
    type: type,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: 'var(--text-base)',
      fontFamily: 'var(--font-body)',
      color: 'var(--color-text-primary)'
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md'
}) {
  const pad = size === 'sm' ? '5px 10px' : '7px 14px';
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'inline-flex',
      padding: 3,
      background: 'var(--neutral-100)',
      borderRadius: 'var(--radius-md)',
      gap: 2
    }
  }, options.map(opt => {
    const isActive = opt.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: opt.value,
      type: "button",
      role: "tab",
      "aria-selected": isActive,
      onClick: () => onChange && onChange(opt.value),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: pad,
        fontSize,
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--weight-semibold)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: isActive ? 'var(--color-white)' : 'transparent',
        color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
        boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
        transition: 'all var(--duration-fast) var(--ease-standard)'
      }
    }, opt.icon, opt.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState
} = React;
function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Seleziona…',
  size = 'md',
  style
}) {
  const [focused, setFocused] = useState(false);
  const heights = {
    sm: 32,
    md: 40
  };
  const h = heights[size] || 40;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: h,
      ...style
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: value ?? '',
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      width: '100%',
      height: '100%',
      appearance: 'none',
      WebkitAppearance: 'none',
      padding: '0 34px 0 12px',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--border-default)'}`,
      background: 'var(--color-white)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-base)',
      color: 'var(--color-text-primary)',
      boxShadow: focused ? 'var(--shadow-focus)' : 'none',
      cursor: 'pointer'
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    style: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--color-text-secondary)',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 9l6 6 6-6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Dialog.jsx
try { (() => {
const {
  useEffect
} = React;
function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md'
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widths = {
    sm: 400,
    md: 520,
    lg: 680
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(23,33,43,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: widths[size] || widths.md,
      background: 'var(--color-white)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      maxHeight: '86vh',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-xl)',
      fontFamily: 'var(--font-display)',
      color: 'var(--color-text-primary)',
      margin: 0
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6,
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-secondary)'
    }
  }, description)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      overflowY: 'auto'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px',
      borderTop: '1px solid var(--border-default)',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Tooltip.jsx
try { (() => {
const {
  useState
} = React;
function Tooltip({
  content,
  children,
  side = 'top'
}) {
  const [open, setOpen] = useState(false);
  if (!content) return children;
  const pos = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%) translateY(-6px)'
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%) translateY(6px)'
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%) translateX(-6px)'
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%) translateX(6px)'
    }
  }[side];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false)
  }, children, open && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      ...pos,
      background: 'var(--color-text-primary)',
      color: 'var(--color-white)',
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      fontFamily: 'var(--font-body)',
      whiteSpace: 'nowrap',
      zIndex: 50,
      boxShadow: 'var(--shadow-md)',
      pointerEvents: 'none'
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ConfidenceIndicator.jsx
try { (() => {
function ConfidenceIndicator({
  level = 'high',
  showWhenHigh = false,
  message
}) {
  if (level === 'high' && !showWhenHigh) return null;
  const color = level === 'low' ? 'var(--color-warning)' : level === 'medium' ? 'var(--neutral-400)' : 'var(--neutral-300)';
  const text = message || (level === 'low' ? 'Lettura incerta — verifica sul referto' : 'Confidenza media — verifica consigliata');
  return /*#__PURE__*/React.createElement(__ds_scope.Tooltip, {
    content: text
  }, /*#__PURE__*/React.createElement("span", {
    "aria-label": text,
    style: {
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      boxShadow: level === 'low' ? '0 0 0 3px rgba(226,161,0,0.18)' : 'none'
    }
  }));
}
Object.assign(__ds_scope, { ConfidenceIndicator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ConfidenceIndicator.jsx", error: String((e && e.message) || e) }); }

// components/data/EditableValue.jsx
try { (() => {
const {
  useEffect,
  useRef,
  useState
} = React;
function EditableValue({
  value,
  onChange,
  type = 'text',
  confidence = 'high',
  edited = false,
  size = 'md',
  ariaLabel
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [justEdited, setJustEdited] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  const commit = () => {
    const next = type === 'number' ? Number(draft) : draft;
    if (String(next) !== String(value) && draft !== '' && !(type === 'number' && Number.isNaN(next))) {
      onChange && onChange(next);
      setJustEdited(true);
      setTimeout(() => setJustEdited(false), 2600);
    }
    setEditing(false);
  };
  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };
  const fontSize = size === 'lg' ? 'var(--text-2xl)' : size === 'sm' ? 'var(--text-base)' : 'var(--text-lg)';
  if (editing) {
    return /*#__PURE__*/React.createElement("input", {
      ref: inputRef,
      value: draft,
      "aria-label": ariaLabel,
      onChange: e => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') cancel();
      },
      style: {
        width: type === 'number' ? 48 : 96,
        fontSize,
        fontFamily: 'var(--font-mono)',
        fontWeight: 'var(--weight-semibold)',
        textAlign: 'center',
        color: 'var(--color-text-primary)',
        border: '1.5px solid var(--color-primary)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px 4px',
        outline: 'none',
        boxShadow: 'var(--shadow-focus)'
      }
    });
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": (ariaLabel ? ariaLabel + ': ' : '') + value + ' — modifica',
    onClick: () => setEditing(true),
    style: {
      font: 'inherit',
      fontSize,
      fontFamily: 'var(--font-mono)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text-primary)',
      background: 'transparent',
      border: '1.5px dashed transparent',
      borderRadius: 'var(--radius-sm)',
      padding: '2px 6px',
      cursor: 'pointer'
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--neutral-300)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'transparent';
    }
  }, value), edited ? /*#__PURE__*/React.createElement("span", {
    title: "Confermato manualmente",
    "aria-label": "Confermato manualmente",
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--color-primary)'
    }
  }) : /*#__PURE__*/React.createElement(__ds_scope.ConfidenceIndicator, {
    level: confidence
  }), justEdited && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-primary-dark)',
      background: 'var(--color-primary-subtle)',
      padding: '2px 6px',
      borderRadius: 'var(--radius-full)',
      whiteSpace: 'nowrap'
    }
  }, "Modificato manualmente"));
}
Object.assign(__ds_scope, { EditableValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/EditableValue.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/AppHeader.jsx
try { (() => {
function AppHeader() {
  const {
    Dialog
  } = window.VolleyRefDesignSystem_4fa89f;
  const [dialog, setDialog] = React.useState(null);
  const navLinkStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)'
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 32px',
      borderBottom: '1px solid var(--border-default)',
      background: 'var(--color-white)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/mark.svg",
    width: "30",
    height: "30",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 19,
      color: 'var(--color-text-primary)'
    }
  }, "Volley", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-primary)'
    }
  }, "Ref"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 24,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDialog('how'),
    style: navLinkStyle
  }, "Come funziona"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDialog('privacy'),
    style: navLinkStyle
  }, "Privacy"))), /*#__PURE__*/React.createElement(Dialog, {
    open: dialog === 'how',
    onClose: () => setDialog(null),
    title: "Come funziona VolleyRef",
    size: "md"
  }, /*#__PURE__*/React.createElement("ol", {
    style: {
      margin: 0,
      paddingLeft: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      fontSize: 14,
      color: 'var(--color-text-primary)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("li", null, "Carichi il PDF del referto cartaceo o digitale."), /*#__PURE__*/React.createElement("li", null, "VolleyRef legge il documento e ricostruisce set, sestetti e turni di servizio."), /*#__PURE__*/React.createElement("li", null, "Controlli i dati estratti affiancati alla pagina originale del referto."), /*#__PURE__*/React.createElement("li", null, "Correggi eventuali letture incerte con un click."), /*#__PURE__*/React.createElement("li", null, "Esporti i dati validati in Excel o CSV."))), /*#__PURE__*/React.createElement(Dialog, {
    open: dialog === 'privacy',
    onClose: () => setDialog(null),
    title: "Privacy",
    size: "md"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--color-text-secondary)',
      lineHeight: 1.6,
      margin: 0
    }
  }, "Versione dimostrativa. I referti caricati in questo prototipo non vengono inviati a nessun server: l'elaborazione \xE8 simulata interamente nel browser.")));
}
window.AppHeader = AppHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/AppHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/ExportDialog.jsx
try { (() => {
function buildCsv(match, sections) {
  const lines = [];
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  if (sections.info) {
    lines.push('INFORMAZIONI PARTITA');
    lines.push(['Squadra A', 'Squadra B', 'Competizione', 'Data', 'Luogo', 'Risultato'].map(esc).join(','));
    lines.push([match.teamA.name, match.teamB.name, match.competition, match.date, match.venue, `${match.finalScore.a}-${match.finalScore.b}`].map(esc).join(','));
    lines.push('');
  }
  if (sections.lineups) {
    lines.push('SESTETTI INIZIALI');
    lines.push(['Set', 'Squadra', 'I', 'II', 'III', 'IV', 'V', 'VI'].map(esc).join(','));
    match.sets.forEach(s => {
      [match.teamA, match.teamB].forEach(team => {
        lines.push([s.number, team.name, ...s.lineups[team.key]].map(esc).join(','));
      });
    });
    lines.push('');
  }
  if (sections.services) {
    lines.push('TURNI DI SERVIZIO');
    lines.push(['Set', '#', 'Squadra', 'Battitore', 'Rotazione', 'Inizio', 'Fine', 'Punti', 'Stato'].map(esc).join(','));
    match.sets.forEach(s => {
      s.serviceTurns.forEach(t => {
        const teamName = t.teamKey === match.teamA.key ? match.teamA.name : match.teamB.name;
        lines.push([s.number, t.index, teamName, t.server, t.rotation, t.start, t.end, t.points, t.status].map(esc).join(','));
      });
    });
  }
  return lines.join('\n');
}
function ExportDialog({
  open,
  onClose,
  match
}) {
  const {
    Dialog,
    Button,
    SegmentedControl
  } = window.VolleyRefDesignSystem_4fa89f;
  const {
    useToast
  } = window.VolleyRefDesignSystem_4fa89f;
  const [format, setFormat] = React.useState('xlsx');
  const [sections, setSections] = React.useState({
    info: true,
    lineups: true,
    services: true
  });
  const {
    push
  } = useToast();
  const toggle = key => setSections(s => ({
    ...s,
    [key]: !s[key]
  }));
  const download = () => {
    if (format === 'csv') {
      const csv = buildCsv(match, sections);
      const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `volleyref-${match.id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push('CSV scaricato', {
        tone: 'success'
      });
    } else {
      push('Download avviato — volleyref-' + match.id + '.xlsx', {
        tone: 'success'
      });
    }
    onClose();
  };
  const checkRow = (key, label) => /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 14,
      color: 'var(--color-text-primary)',
      cursor: 'pointer',
      padding: '6px 0'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: sections[key],
    onChange: () => toggle(key),
    style: {
      width: 16,
      height: 16,
      accentColor: 'var(--color-primary)'
    }
  }), label);
  return /*#__PURE__*/React.createElement(Dialog, {
    open: open,
    onClose: onClose,
    title: "Esporta analisi",
    description: "Scegli il formato e le sezioni da includere.",
    size: "md",
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Annulla"), /*#__PURE__*/React.createElement(Button, {
      onClick: download
    }, format === 'csv' ? 'Scarica CSV' : 'Scarica Excel'))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: [{
      value: 'xlsx',
      label: 'Excel (.xlsx)'
    }, {
      value: 'csv',
      label: 'CSV'
    }],
    value: format,
    onChange: setFormat
  }), format === 'xlsx' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--color-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      marginBottom: 4
    }
  }, "Sezioni incluse"), checkRow('info', 'Informazioni partita'), checkRow('lineups', 'Sestetti iniziali'), checkRow('services', 'Turni di servizio'))));
}
window.ExportDialog = ExportDialog;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/ExportDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/HomeScreen.jsx
try { (() => {
function HomeScreen({
  onOpenMatch
}) {
  const [phase, setPhase] = React.useState('idle');
  const [outcome, setOutcome] = React.useState('success');
  if (phase === 'processing') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: '100vh',
        background: 'var(--color-background)'
      }
    }, /*#__PURE__*/React.createElement(AppHeader, null), /*#__PURE__*/React.createElement(ProcessingState, {
      outcome: outcome,
      onDone: () => onOpenMatch('cerea-rothoblaas'),
      onRetry: () => {
        setOutcome('success');
        setPhase('idle');
        setTimeout(() => setPhase('processing'), 30);
      },
      onCancel: () => setPhase('idle')
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--color-background)'
    }
  }, /*#__PURE__*/React.createElement(AppHeader, null), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 760,
      margin: '0 auto',
      padding: '72px 24px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: 36,
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 40,
      lineHeight: 1.15,
      color: 'var(--color-text-primary)',
      letterSpacing: '-0.01em'
    }
  }, "Trasforma un referto di pallavolo in dati utilizzabili"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: 1.55,
      color: 'var(--color-text-secondary)',
      margin: 0
    }
  }, "Carica il PDF del referto. VolleyRef ricostruisce sestetti, rotazioni e turni di servizio e prepara i dati per Excel.")), /*#__PURE__*/React.createElement(UploadDropzone, {
    onAnalyze: (file, out) => {
      setOutcome(out);
      setPhase('processing');
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenMatch('sanmarco-vicenza'),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--color-primary-dark)',
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer',
      textDecoration: 'underline',
      fontFamily: 'var(--font-body)'
    }
  }, "Vedi un esempio con anomalie da correggere")));
}
window.HomeScreen = HomeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/Icons.jsx
try { (() => {
(function () {
  const base = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };
  const S = (paths, vb) => p => React.createElement('svg', {
    width: p.size || 18,
    height: p.size || 18,
    viewBox: vb || '0 0 24 24',
    style: p.style,
    ...base
  }, paths.map((el, i) => React.cloneElement(el, {
    key: i
  })));
  const P = d => React.createElement('path', {
    d
  });
  const El = (tag, attrs) => React.createElement(tag, attrs);
  window.VRIcons = {
    Upload: S([P('M12 16V4M7 9l5-5 5 5'), P('M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3')]),
    FileText: S([P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'), P('M14 2v6h6'), P('M8 13h8M8 17h8M8 9h2')]),
    X: S([P('M18 6L6 18M6 6l12 12')]),
    Check: S([P('M5 13l5 5L20 6')]),
    CheckCircle: S([El('circle', {
      cx: 12,
      cy: 12,
      r: 9
    }), P('M8 12.5l2.5 2.5L16 9.5')]),
    AlertTriangle: S([P('M10.3 3.9L2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z'), P('M12 9v4'), P('M12 17h.01')]),
    AlertCircle: S([El('circle', {
      cx: 12,
      cy: 12,
      r: 9
    }), P('M12 8v5'), P('M12 16h.01')]),
    ChevronDown: S([P('M6 9l6 6 6-6')]),
    ChevronLeft: S([P('M15 18l-6-6 6-6')]),
    ChevronRight: S([P('M9 18l6-6-6-6')]),
    ZoomIn: S([El('circle', {
      cx: 11,
      cy: 11,
      r: 7
    }), P('M21 21l-4.3-4.3'), P('M11 8v6M8 11h6')]),
    ZoomOut: S([El('circle', {
      cx: 11,
      cy: 11,
      r: 7
    }), P('M21 21l-4.3-4.3'), P('M8 11h6')]),
    Maximize: S([P('M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3')]),
    RotateCw: S([P('M21 12a9 9 0 1 1-3-6.7'), P('M21 3v6h-6')]),
    Eye: S([P('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'), El('circle', {
      cx: 12,
      cy: 12,
      r: 3
    })]),
    EyeOff: S([P('M17.9 17.9A10.6 10.6 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 4.2-5.4M9.5 5.2A10 10 0 0 1 12 5c7 0 11 8 11 8a19.6 19.6 0 0 1-2.2 3.2'), P('M14.1 14.1a3 3 0 1 1-4.2-4.2'), P('M2 2l20 20')]),
    Download: S([P('M12 3v12M7 10l5 5 5-5'), P('M4 20h16')]),
    RefreshCw: S([P('M21 12a9 9 0 0 1-15.4 6.4M3 12a9 9 0 0 1 15.4-6.4'), P('M21 3v6h-6'), P('M3 21v-6h6')]),
    MoreVertical: S([El('circle', {
      cx: 12,
      cy: 5,
      r: 1.2,
      fill: 'currentColor'
    }), El('circle', {
      cx: 12,
      cy: 12,
      r: 1.2,
      fill: 'currentColor'
    }), El('circle', {
      cx: 12,
      cy: 19,
      r: 1.2,
      fill: 'currentColor'
    })]),
    Search: S([El('circle', {
      cx: 11,
      cy: 11,
      r: 7
    }), P('M21 21l-4.3-4.3')]),
    Pencil: S([P('M12 20h9'), P('M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')]),
    Undo: S([P('M3 7v6h6'), P('M3 13a9 9 0 1 0 3-7')]),
    PanelLeft: S([El('rect', {
      x: 3,
      y: 4,
      width: 18,
      height: 16,
      rx: 2
    }), P('M9 4v16')]),
    PanelRight: S([El('rect', {
      x: 3,
      y: 4,
      width: 18,
      height: 16,
      rx: 2
    }), P('M15 4v16')]),
    Columns: S([El('rect', {
      x: 3,
      y: 4,
      width: 18,
      height: 16,
      rx: 2
    }), P('M12 4v16')]),
    ArrowLeft: S([P('M19 12H5'), P('M12 19l-7-7 7-7')]),
    FileSpreadsheet: S([P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'), P('M14 2v6h6'), P('M8 13h8M8 17h8M11 13v7')]),
    Loader: S([P('M12 2v4'), P('M12 18v4'), P('M4.9 4.9l2.8 2.8'), P('M16.3 16.3l2.8 2.8'), P('M2 12h4'), P('M18 12h4'), P('M4.9 19.1l2.8-2.8'), P('M16.3 7.7l2.8-2.8')]),
    Table: S([El('rect', {
      x: 3,
      y: 4,
      width: 18,
      height: 16,
      rx: 2
    }), P('M3 10h18'), P('M9 4v16')]),
    Grid: S([El('rect', {
      x: 3,
      y: 3,
      width: 7,
      height: 7,
      rx: 1
    }), El('rect', {
      x: 14,
      y: 3,
      width: 7,
      height: 7,
      rx: 1
    }), El('rect', {
      x: 3,
      y: 14,
      width: 7,
      height: 7,
      rx: 1
    }), El('rect', {
      x: 14,
      y: 14,
      width: 7,
      height: 7,
      rx: 1
    })]),
    Ball: S([El('circle', {
      cx: 12,
      cy: 12,
      r: 9.5
    }), P('M4.5 8.5C9 4 15 4 19.5 8.5'), P('M4.5 15.5C9 20 15 20 19.5 15.5'), P('M9 3.5C14 10 14 14 9 20.5')]),
    Home: S([P('M4 11.5L12 4l8 7.5'), P('M6 10v10h12V10')])
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/Icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/MatchHeader.jsx
try { (() => {
function MatchHeader({
  match,
  onExport,
  onReanalyze,
  onNewReport,
  viewMode,
  onChangeViewMode,
  viewOptions
}) {
  const {
    Button,
    IconButton,
    StatusBadge,
    SegmentedControl
  } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const [menuOpen, setMenuOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '14px 24px',
      borderBottom: '1px solid var(--border-default)',
      background: 'var(--color-white)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onNewReport,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      padding: 0,
      color: 'var(--color-text-secondary)',
      fontSize: 12.5,
      fontWeight: 600,
      cursor: 'pointer',
      alignSelf: 'flex-start',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon.ArrowLeft, {
    size: 13
  }), " Nuovo referto"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      flexWrap: 'wrap',
      flex: 1,
      minWidth: 260
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 21,
      color: 'var(--color-text-primary)'
    }
  }, match.teamA.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 24,
      color: 'var(--color-primary-dark)'
    }
  }, match.finalScore.a, " \u2014 ", match.finalScore.b), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 21,
      color: 'var(--color-text-primary)'
    }
  }, match.teamB.name), /*#__PURE__*/React.createElement(StatusBadge, {
    status: match.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, onChangeViewMode && /*#__PURE__*/React.createElement(SegmentedControl, {
    size: "sm",
    options: viewOptions || [{
      value: 'pdf',
      label: 'Solo referto'
    }, {
      value: 'split',
      label: 'Split'
    }, {
      value: 'data',
      label: 'Solo dati'
    }],
    value: viewMode,
    onChange: onChangeViewMode
  }), /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement(Icon.Download, {
      size: 15
    }),
    onClick: onExport
  }, "Esporta"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.MoreVertical, {
      size: 17
    }),
    label: "Altre azioni",
    onClick: () => setMenuOpen(v => !v)
  }), menuOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setMenuOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 40
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 0,
      top: '110%',
      background: 'var(--color-white)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      minWidth: 180,
      zIndex: 41,
      padding: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMenuOpen(false);
      onReanalyze();
    },
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(Icon.RefreshCw, {
    size: 15
  }), " Rianalizza"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMenuOpen(false);
      onNewReport();
    },
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(Icon.Upload, {
    size: 15
  }), " Nuovo referto")))))));
}
const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  background: 'none',
  border: 'none',
  borderRadius: 6,
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--font-body)'
};
window.MatchHeader = MatchHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/MatchHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/MatchSummary.jsx
try { (() => {
function MatchSummary({
  match,
  onSelectSet
}) {
  const {
    Card,
    StatusBadge
  } = window.VolleyRefDesignSystem_4fa89f;
  const info = [['Squadra A', match.teamA.name], ['Squadra B', match.teamB.name], ['Competizione', match.competition], ['Data', match.date], ['Luogo', match.venue], ['Risultato finale', `${match.finalScore.a} — ${match.finalScore.b}`]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 16
    }
  }, info.map(([label, value]) => /*#__PURE__*/React.createElement("div", {
    key: label
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--color-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      fontWeight: 700
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--color-text-primary)',
      fontWeight: 600,
      marginTop: 3
    }
  }, value))))), /*#__PURE__*/React.createElement(Card, {
    padding: 0
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ['Set', match.teamA.short, match.teamB.short, 'Stato'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: h === 'Set' ? 'left' : 'center',
      padding: '12px 16px',
      fontSize: 11.5,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: 'var(--color-text-secondary)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, match.sets.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.number,
    onClick: () => onSelectSet(s.number),
    style: {
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--neutral-50)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '12px 16px',
      fontWeight: 700,
      color: 'var(--color-text-primary)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, s.number), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '12px 16px',
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      borderBottom: '1px solid var(--border-default)'
    }
  }, s.scoreA), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '12px 16px',
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      borderBottom: '1px solid var(--border-default)'
    }
  }, s.scoreB), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '12px 16px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: s.status,
    size: "sm"
  }))))))));
}
window.MatchSummary = MatchSummary;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/MatchSummary.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/MatchWorkspace.jsx
try { (() => {
function useIsMobile(breakpoint) {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < breakpoint);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}
function MatchWorkspace({
  matchId,
  onNewReport
}) {
  const originalRef = React.useRef(structuredClone(window.VR_MOCK.matches[matchId]));
  const [match, setMatch] = React.useState(() => structuredClone(originalRef.current));
  const lastSnapshotRef = React.useRef(null);
  const [currentSetNumber, setCurrentSetNumber] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState('summary');
  const [viewMode, setViewMode] = React.useState('split');
  const [mobileView, setMobileView] = React.useState('data');
  const [highlightRegion, setHighlightRegion] = React.useState(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [leftPct, setLeftPct] = React.useState(46);
  const dragRef = React.useRef(false);
  const isMobile = useIsMobile(880);
  const {
    useToast,
    Tabs,
    ToastProvider
  } = window.VolleyRefDesignSystem_4fa89f;
  const {
    push
  } = useToast();
  const currentSet = match.sets.find(s => s.number === currentSetNumber) || match.sets[0];
  const editCount = React.useMemo(() => {
    let n = 0;
    match.sets.forEach(s => {
      Object.values(s.lineupEdited).forEach(arr => arr.forEach(v => v && n++));
      s.serviceTurns.forEach(t => t.edited && n++);
    });
    return n;
  }, [match]);
  const snapshotThen = mutator => {
    lastSnapshotRef.current = structuredClone(match);
    setMatch(m => {
      const clone = structuredClone(m);
      mutator(clone);
      return clone;
    });
    push('Valore aggiornato', {
      actionLabel: 'Annulla',
      onAction: () => setMatch(lastSnapshotRef.current)
    });
  };
  const handleEditLineup = (teamKey, idx, value) => {
    snapshotThen(clone => {
      const s = clone.sets.find(s => s.number === currentSetNumber);
      s.lineups[teamKey][idx] = value;
      s.lineupEdited[teamKey][idx] = true;
    });
  };
  const handleEditTurn = (turnId, nextTurn) => {
    snapshotThen(clone => {
      const s = clone.sets.find(s => s.number === currentSetNumber);
      const i = s.serviceTurns.findIndex(t => t.id === turnId);
      if (i >= 0) s.serviceTurns[i] = nextTurn;
    });
  };
  const handleRegionClick = regionId => {
    setHighlightRegion(regionId);
    if (regionId === 'header') setActiveTab('summary');else if (regionId.startsWith('lineup-')) setActiveTab('lineups');else if (regionId === 'services') setActiveTab('services');
    setTimeout(() => setHighlightRegion(r => r === regionId ? null : r), 2400);
  };
  const handleHighlightTeam = teamKey => {
    setHighlightRegion(`lineup-${teamKey}`);
    if (isMobile) setMobileView('pdf');
    setTimeout(() => setHighlightRegion(r => r === `lineup-${teamKey}` ? null : r), 2400);
  };
  const handleHighlightServices = () => {
    setHighlightRegion('services');
    setTimeout(() => setHighlightRegion(r => r === 'services' ? null : r), 2400);
  };
  const handleSelectSet = n => {
    setCurrentSetNumber(n);
    setActiveTab('lineups');
  };
  const startDrag = e => {
    dragRef.current = true;
    const onMove = ev => {
      if (!dragRef.current) return;
      const pct = Math.min(72, Math.max(26, ev.clientX / window.innerWidth * 100));
      setLeftPct(pct);
    };
    const onUp = () => {
      dragRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const tabs = [{
    value: 'summary',
    label: 'Riepilogo'
  }, {
    value: 'lineups',
    label: 'Formazioni'
  }, {
    value: 'services',
    label: 'Servizi'
  }, {
    value: 'validation',
    label: 'Controllo'
  }];
  const pdfPanel = /*#__PURE__*/React.createElement(PdfViewer, {
    match: match,
    set: currentSet,
    highlightRegion: highlightRegion,
    onRegionClick: handleRegionClick,
    onHidePanel: !isMobile ? () => setViewMode('data') : null
  });
  const dataPanel = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: tabs,
    value: activeTab,
    onChange: setActiveTab
  })), activeTab !== 'summary' && /*#__PURE__*/React.createElement(SetSelector, {
    sets: match.sets,
    value: currentSetNumber,
    onChange: setCurrentSetNumber
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24
    }
  }, activeTab === 'summary' && /*#__PURE__*/React.createElement(MatchSummary, {
    match: match,
    onSelectSet: handleSelectSet
  }), activeTab === 'lineups' && /*#__PURE__*/React.createElement(StartingSix, {
    match: match,
    set: currentSet,
    onEditLineup: handleEditLineup,
    onHighlight: handleHighlightTeam
  }), activeTab === 'services' && /*#__PURE__*/React.createElement(ServiceTurnsTable, {
    match: match,
    set: currentSet,
    onEditTurn: handleEditTurn,
    onHighlight: handleHighlightServices
  }), activeTab === 'validation' && /*#__PURE__*/React.createElement(ValidationPanel, {
    set: currentSet,
    onJump: tab => {
      setActiveTab(tab);
      handleHighlightServices();
    }
  })), editCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 24px',
      borderTop: '1px solid var(--border-default)',
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setResetOpen(true),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--color-text-secondary)',
      fontSize: 12.5,
      fontWeight: 600,
      cursor: 'pointer',
      textDecoration: 'underline',
      fontFamily: 'var(--font-body)'
    }
  }, "Ripristina dati estratti (", editCount, ")")));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--color-background)'
    }
  }, /*#__PURE__*/React.createElement(MatchHeader, {
    match: match,
    onExport: () => setExportOpen(true),
    onReanalyze: () => {
      setMatch(structuredClone(originalRef.current));
      push('Referto rianalizzato');
    },
    onNewReport: onNewReport,
    viewMode: isMobile ? mobileView : viewMode,
    onChangeViewMode: isMobile ? setMobileView : setViewMode,
    viewOptions: isMobile ? [{
      value: 'pdf',
      label: 'Referto'
    }, {
      value: 'data',
      label: 'Dati'
    }] : undefined
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex'
    }
  }, isMobile ? mobileView === 'pdf' ? pdfPanel : dataPanel : viewMode === 'pdf' ? pdfPanel : viewMode === 'data' ? dataPanel : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${leftPct}%`,
      minWidth: 280,
      height: '100%'
    }
  }, pdfPanel), /*#__PURE__*/React.createElement("div", {
    onMouseDown: startDrag,
    style: {
      width: 6,
      cursor: 'col-resize',
      background: 'var(--border-default)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 320,
      height: '100%'
    }
  }, dataPanel))), /*#__PURE__*/React.createElement(ExportDialog, {
    open: exportOpen,
    onClose: () => setExportOpen(false),
    match: match
  }), /*#__PURE__*/React.createElement(ResetCorrectionsDialog, {
    open: resetOpen,
    onClose: () => setResetOpen(false),
    editCount: editCount,
    onConfirm: () => {
      setMatch(structuredClone(originalRef.current));
      setResetOpen(false);
      push('Dati ripristinati');
    }
  }));
}
window.MatchWorkspace = MatchWorkspace;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/MatchWorkspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/PdfToolbar.jsx
try { (() => {
function PdfToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  rotation,
  onRotate,
  showOverlay,
  onToggleOverlay,
  fullscreen,
  onToggleFullscreen,
  onHidePanel
}) {
  const {
    IconButton,
    Tooltip
  } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const divider = /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 22,
      background: 'var(--border-default)',
      margin: '0 4px'
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '8px 12px',
      borderBottom: '1px solid var(--border-default)',
      background: 'var(--color-white)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--color-text-secondary)',
      fontWeight: 600,
      marginRight: 4
    }
  }, "Pagina 1/1"), divider, /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.ZoomOut, {
      size: 16
    }),
    label: "Riduci zoom",
    onClick: onZoomOut
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontFamily: 'var(--font-mono)',
      color: 'var(--color-text-primary)',
      minWidth: 40,
      textAlign: 'center'
    }
  }, Math.round(zoom * 100), "%"), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.ZoomIn, {
      size: 16
    }),
    label: "Aumenta zoom",
    onClick: onZoomIn
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.Maximize, {
      size: 16
    }),
    label: "Adatta alla larghezza",
    onClick: onFitWidth
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.RotateCw, {
      size: 16
    }),
    label: "Ruota pagina",
    onClick: onRotate
  }), divider, /*#__PURE__*/React.createElement(Tooltip, {
    content: showOverlay ? 'Nascondi zone riconosciute' : 'Mostra zone riconosciute'
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: showOverlay ? /*#__PURE__*/React.createElement(Icon.Eye, {
      size: 16
    }) : /*#__PURE__*/React.createElement(Icon.EyeOff, {
      size: 16
    }),
    label: "Mostra zone riconosciute",
    active: showOverlay,
    onClick: onToggleOverlay
  })), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.Maximize, {
      size: 16
    }),
    label: fullscreen ? 'Esci da schermo intero' : 'Schermo intero',
    active: fullscreen,
    onClick: onToggleFullscreen
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), onHidePanel && /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.PanelLeft, {
      size: 16
    }),
    label: "Nascondi referto",
    onClick: onHidePanel
  }));
}
window.PdfToolbar = PdfToolbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/PdfToolbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/PdfViewer.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PdfViewer({
  match,
  set,
  highlightRegion,
  onRegionClick,
  onHidePanel
}) {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [showOverlay, setShowOverlay] = React.useState(true);
  const [fullscreen, setFullscreen] = React.useState(false);
  const teamAKey = match.teamA.key,
    teamBKey = match.teamB.key;
  const regions = [{
    id: 'header',
    top: '4%',
    left: '6%',
    width: '88%',
    height: '13%',
    label: 'Intestazione e punteggio'
  }, {
    id: `lineup-${teamAKey}`,
    top: '21%',
    left: '6%',
    width: '41%',
    height: '25%',
    label: `Sestetto ${match.teamA.short}`
  }, {
    id: `lineup-${teamBKey}`,
    top: '21%',
    left: '53%',
    width: '41%',
    height: '25%',
    label: `Sestetto ${match.teamB.short}`
  }, {
    id: 'services',
    top: '50%',
    left: '6%',
    width: '88%',
    height: '44%',
    label: 'Turni di servizio'
  }];
  const box = {
    border: '1px solid var(--neutral-300)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text-primary)'
  };
  const page = /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 600,
      height: 848,
      background: '#fff',
      boxShadow: 'var(--shadow-md)',
      transform: `scale(${zoom}) rotate(${rotation}deg)`,
      transformOrigin: 'top center',
      transition: 'transform var(--duration-base) var(--ease-standard)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '4%',
      left: '6%',
      width: '88%',
      height: '13%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#657381'
    }
  }, match.competition, " \xB7 ", match.date), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: '#17212B'
    }
  }, match.teamA.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#657381',
      fontWeight: 600
    }
  }, "vs"), " ", match.teamB.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#657381'
    }
  }, match.venue)), [[teamAKey, match.teamA.short, '21%', '6%'], [teamBKey, match.teamB.short, '21%', '53%']].map(([key, short, top, left]) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      position: 'absolute',
      top,
      left,
      width: '41%',
      height: '25%',
      border: '1px solid #EDEDED',
      borderRadius: 6,
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      color: '#285180'
    }
  }, short, set.firstServe === key ? ' · al servizio' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 4,
      flex: 1
    }
  }, set.lineups[key].map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      ...box,
      fontSize: 12
    }
  }, n))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '50%',
      left: '6%',
      width: '88%',
      height: '44%',
      border: '1px solid #EDEDED',
      borderRadius: 6,
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      color: '#285180',
      marginBottom: 2
    }
  }, "Turni di servizio"), Array.from({
    length: 9
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 10,
      border: '1px solid #D5DADF',
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 10,
      borderBottom: '1px dotted #D5DADF'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 10,
      border: '1px solid #D5DADF',
      borderRadius: 2
    }
  })))), showOverlay && regions.map(r => /*#__PURE__*/React.createElement(RegionOverlay, _extends({
    key: r.id
  }, r, {
    active: true,
    highlighted: highlightRegion === r.id,
    onClick: onRegionClick
  }))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--neutral-100)',
      ...(fullscreen ? {
        position: 'fixed',
        inset: 0,
        zIndex: 300
      } : {})
    }
  }, /*#__PURE__*/React.createElement(PdfToolbar, {
    zoom: zoom,
    onZoomIn: () => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2))),
    onZoomOut: () => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2))),
    onFitWidth: () => setZoom(1),
    rotation: rotation,
    onRotate: () => setRotation(r => (r + 90) % 360),
    showOverlay: showOverlay,
    onToggleOverlay: () => setShowOverlay(v => !v),
    fullscreen: fullscreen,
    onToggleFullscreen: () => setFullscreen(v => !v),
    onHidePanel: fullscreen ? null : onHidePanel
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      padding: 24
    }
  }, page));
}
window.PdfViewer = PdfViewer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/PdfViewer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/ProcessingState.jsx
try { (() => {
const PROCESS_STEPS = [{
  id: 'read',
  label: 'Lettura documento'
}, {
  id: 'sets',
  label: 'Riconoscimento dei set'
}, {
  id: 'lineups',
  label: 'Estrazione delle formazioni'
}, {
  id: 'services',
  label: 'Ricostruzione dei servizi'
}, {
  id: 'checks',
  label: 'Controllo di coerenza'
}];
function ProcessingState({
  outcome,
  onDone,
  onRetry,
  onCancel
}) {
  const {
    Button,
    ProgressStep
  } = window.VolleyRefDesignSystem_4fa89f;
  const [statuses, setStatuses] = React.useState(PROCESS_STEPS.map(() => 'pending'));
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setStatuses(PROCESS_STEPS.map(() => 'pending'));
    setFailed(false);
    async function run() {
      for (let i = 0; i < PROCESS_STEPS.length; i++) {
        if (cancelled) return;
        setStatuses(s => s.map((v, idx) => idx === i ? 'processing' : v));
        await new Promise(r => setTimeout(r, 650 + i * 90));
        if (cancelled) return;
        const isLastStep = i === PROCESS_STEPS.length - 1;
        if (outcome === 'error' && isLastStep) {
          setStatuses(s => s.map((v, idx) => idx === i ? 'error' : v));
          setFailed(true);
          return;
        }
        setStatuses(s => s.map((v, idx) => idx === i ? 'completed' : v));
      }
      await new Promise(r => setTimeout(r, 400));
      if (!cancelled) onDone();
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [outcome]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      margin: '64px auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 22,
      color: 'var(--color-text-primary)'
    }
  }, "Analisi del referto in corso"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--color-text-secondary)',
      marginTop: 6
    }
  }, "Non chiudere questa pagina.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-white)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px 28px'
    }
  }, PROCESS_STEPS.map((s, i) => /*#__PURE__*/React.createElement(ProgressStep, {
    key: s.id,
    label: s.label,
    status: statuses[i],
    isLast: i === PROCESS_STEPS.length - 1
  }))), failed && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-danger-subtle)',
      border: '1px solid rgba(220,28,52,0.25)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--color-danger)'
    }
  }, "Impossibile completare il controllo di coerenza"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--color-text-primary)',
      lineHeight: 1.5
    }
  }, "Il documento presenta pagine illeggibili o un formato non riconosciuto. Riprova con una scansione pi\xF9 nitida oppure torna alla home."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: onCancel
  }, "Torna alla home"), /*#__PURE__*/React.createElement(Button, {
    onClick: onRetry
  }, "Riprova"))));
}
window.ProcessingState = ProcessingState;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/ProcessingState.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/RegionOverlay.jsx
try { (() => {
function RegionOverlay({
  id,
  top,
  left,
  width,
  height,
  active,
  highlighted,
  onClick,
  label
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onClick(id),
    title: label,
    "aria-label": `Zona riconosciuta: ${label}`,
    style: {
      position: 'absolute',
      top,
      left,
      width,
      height,
      border: `1.5px solid ${highlighted ? 'var(--color-primary)' : 'rgba(0,170,234,0.55)'}`,
      background: highlighted ? 'rgba(0,170,234,0.22)' : active ? 'rgba(0,170,234,0.08)' : 'transparent',
      borderRadius: 6,
      cursor: 'pointer',
      padding: 0,
      opacity: active ? 1 : 0,
      transition: 'background var(--duration-base) var(--ease-standard), opacity var(--duration-base)',
      boxShadow: highlighted ? '0 0 0 4px rgba(0,170,234,0.18)' : 'none'
    }
  });
}
window.RegionOverlay = RegionOverlay;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/RegionOverlay.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/ResetCorrectionsDialog.jsx
try { (() => {
function ResetCorrectionsDialog({
  open,
  onClose,
  onConfirm,
  editCount
}) {
  const {
    Dialog,
    Button
  } = window.VolleyRefDesignSystem_4fa89f;
  return /*#__PURE__*/React.createElement(Dialog, {
    open: open,
    onClose: onClose,
    title: "Ripristina dati estratti",
    size: "sm",
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Annulla"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: onConfirm
    }, "Ripristina"))
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: 'var(--color-text-primary)',
      lineHeight: 1.55
    }
  }, editCount > 0 ? `Stai per eliminare ${editCount} correzion${editCount === 1 ? 'e' : 'i'} manuale${editCount === 1 ? '' : 'i'} e tornare ai dati originariamente estratti da VolleyRef. L'operazione non può essere annullata.` : 'Non ci sono correzioni manuali da eliminare in questa partita.'));
}
window.ResetCorrectionsDialog = ResetCorrectionsDialog;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/ResetCorrectionsDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/RotationCourt.jsx
try { (() => {
function RotationCourt({
  numbers,
  confidence,
  edited,
  onChange,
  firstServe,
  teamLabel
}) {
  const {
    EditableValue
  } = window.VolleyRefDesignSystem_4fa89f;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const frontRow = [3, 2, 1]; // IV, III, II
  const backRow = [4, 5, 0]; // V, VI, I

  const cell = idx => /*#__PURE__*/React.createElement("div", {
    key: idx,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: '50%',
      background: 'var(--color-white)',
      border: `2.5px solid ${idx === 0 && firstServe ? 'var(--color-primary)' : 'var(--border-strong)'}`,
      boxShadow: idx === 0 && firstServe ? '0 0 0 3px rgba(0,170,234,0.3)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(EditableValue, {
    value: numbers[idx],
    type: "number",
    size: "sm",
    confidence: confidence[idx],
    edited: edited[idx],
    onChange: v => onChange(idx, v),
    ariaLabel: `Posizione ${ROMAN[idx]}`
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.85)'
    }
  }, ROMAN[idx], idx === 0 && firstServe ? ' · serve' : ''));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-primary-dark)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      background: 'rgba(255,255,255,0.4)',
      borderRadius: 2
    },
    title: "Rete"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-around'
    }
  }, frontRow.map(cell)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-around'
    }
  }, backRow.map(cell)));
}
window.RotationCourt = RotationCourt;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/RotationCourt.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/ServiceTurnsTable.jsx
try { (() => {
function ServiceTurnsTable({
  match,
  set,
  onEditTurn,
  onHighlight
}) {
  const {
    SegmentedControl,
    EditableValue,
    StatusBadge,
    Card
  } = window.VolleyRefDesignSystem_4fa89f;
  const [filter, setFilter] = React.useState('all');
  const rows = set.serviceTurns.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'review') return t.status === 'review' && !t.edited;
    return t.teamKey === filter;
  });
  const teamShort = key => key === match.teamA.key ? match.teamA.short : match.teamB.short;
  const recompute = (turn, field, value) => {
    const parts = value.split('\u2013').map(s => Number(s.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return;
    const next = {
      ...turn,
      [field]: value,
      edited: true
    };
    const ownIdx = turn.teamKey === match.teamA.key ? 0 : 1;
    const startParts = next.start.split('\u2013').map(Number);
    const endParts = next.end.split('\u2013').map(Number);
    next.points = endParts[ownIdx] - startParts[ownIdx];
    onEditTurn(turn.id, next);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    size: "sm",
    options: [{
      value: 'all',
      label: 'Tutti'
    }, {
      value: match.teamA.key,
      label: match.teamA.short
    }, {
      value: match.teamB.key,
      label: match.teamB.short
    }, {
      value: 'review',
      label: 'Da verificare'
    }],
    value: filter,
    onChange: setFilter
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    style: {
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13.5,
      minWidth: 680
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ['#', 'Squadra', 'Battitore', 'Rotazione', 'Inizio', 'Fine', 'Punti', 'Stato'].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: h === 'Squadra' ? 'left' : 'center',
      padding: '10px 14px',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: 'var(--color-text-secondary)',
      borderBottom: '1px solid var(--border-default)',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map(t => /*#__PURE__*/React.createElement("tr", {
    key: t.id,
    onClick: () => onHighlight('services'),
    style: {
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--neutral-50)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      color: 'var(--color-text-secondary)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, t.index), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      fontWeight: 700,
      color: 'var(--color-text-primary)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, teamShort(t.teamKey)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement(EditableValue, {
    value: t.server,
    type: "number",
    size: "sm",
    confidence: t.confidence,
    edited: t.edited,
    onChange: v => onEditTurn(t.id, {
      ...t,
      server: v,
      edited: true
    }),
    ariaLabel: "Battitore"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement(EditableValue, {
    value: t.rotation,
    type: "text",
    size: "sm",
    confidence: "high",
    edited: t.edited,
    onChange: v => onEditTurn(t.id, {
      ...t,
      rotation: v,
      edited: true
    }),
    ariaLabel: "Rotazione"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement(EditableValue, {
    value: t.start,
    type: "text",
    size: "sm",
    confidence: "high",
    edited: t.edited,
    onChange: v => recompute(t, 'start', v),
    ariaLabel: "Punteggio iniziale"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement(EditableValue, {
    value: t.end,
    type: "text",
    size: "sm",
    confidence: "high",
    edited: t.edited,
    onChange: v => recompute(t, 'end', v),
    ariaLabel: "Punteggio finale"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      borderBottom: '1px solid var(--border-default)'
    }
  }, t.points), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 14px',
      textAlign: 'center',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: t.edited ? 'validated' : t.status,
    size: "sm"
  })))), rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    style: {
      padding: 24,
      textAlign: 'center',
      color: 'var(--color-text-secondary)'
    }
  }, "Nessun turno corrisponde al filtro selezionato."))))));
}
window.ServiceTurnsTable = ServiceTurnsTable;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/ServiceTurnsTable.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/SetSelector.jsx
try { (() => {
function SetSelector({
  sets,
  value,
  onChange
}) {
  const total = 5;
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    "aria-label": "Seleziona set",
    style: {
      display: 'flex',
      gap: 8,
      padding: '14px 24px 0'
    }
  }, Array.from({
    length: total
  }).map((_, i) => {
    const num = i + 1;
    const set = sets.find(s => s.number === num);
    const isActive = value === num;
    const dotColor = !set ? 'transparent' : set.status === 'validated' ? 'var(--color-success)' : set.status === 'review' ? 'var(--color-warning)' : 'var(--color-danger)';
    return /*#__PURE__*/React.createElement("button", {
      key: num,
      role: "tab",
      "aria-selected": isActive,
      disabled: !set,
      onClick: () => set && onChange(num),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 14px',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-default)'}`,
        background: isActive ? 'var(--color-primary-subtle)' : 'var(--color-white)',
        color: !set ? 'var(--neutral-300)' : isActive ? 'var(--color-primary-dark)' : 'var(--color-text-primary)',
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'var(--font-body)',
        cursor: set ? 'pointer' : 'not-allowed'
      }
    }, set && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: dotColor
      }
    }), "Set ", num);
  }));
}
window.SetSelector = SetSelector;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/SetSelector.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/StartingSix.jsx
try { (() => {
function TeamLineupTable({
  teamKey,
  numbers,
  confidence,
  edited,
  onChange,
  firstServe
}) {
  const {
    EditableValue
  } = window.VolleyRefDesignSystem_4fa89f;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6,1fr)',
      gap: 8
    }
  }, numbers.map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      padding: '12px 4px',
      background: 'var(--neutral-50)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--color-text-secondary)'
    }
  }, ROMAN[i], i === 0 && firstServe ? ' ●' : ''), /*#__PURE__*/React.createElement(EditableValue, {
    value: n,
    type: "number",
    confidence: confidence[i],
    edited: edited[i],
    onChange: v => onChange(i, v),
    ariaLabel: `Posizione ${ROMAN[i]}`
  }))));
}
function StartingSix({
  match,
  set,
  onEditLineup,
  onHighlight
}) {
  const {
    SegmentedControl,
    IconButton,
    Tooltip
  } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const [view, setView] = React.useState('table');
  const teams = [{
    key: match.teamA.key,
    name: match.teamA.name
  }, {
    key: match.teamB.key,
    name: match.teamB.name
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: [{
      value: 'table',
      label: 'Tabella',
      icon: /*#__PURE__*/React.createElement(Icon.Table, {
        size: 14
      })
    }, {
      value: 'court',
      label: 'Campo',
      icon: /*#__PURE__*/React.createElement(Icon.Grid, {
        size: 14
      })
    }],
    value: view,
    onChange: setView
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: 20
    }
  }, teams.map(team => {
    const isFirstServe = set.firstServe === team.key;
    const numbers = set.lineups[team.key];
    const confidence = set.lineupConfidence[team.key];
    const edited = set.lineupEdited[team.key];
    return /*#__PURE__*/React.createElement("div", {
      key: team.key,
      style: {
        background: 'var(--color-white)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 16,
        color: 'var(--color-text-primary)'
      }
    }, team.name), isFirstServe && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-primary-dark)',
        background: 'var(--color-primary-subtle)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)'
      }
    }, "Prima al servizio")), /*#__PURE__*/React.createElement(Tooltip, {
      content: "Evidenzia sul referto"
    }, /*#__PURE__*/React.createElement(IconButton, {
      icon: /*#__PURE__*/React.createElement(Icon.Search, {
        size: 15
      }),
      label: "Evidenzia sul referto",
      size: "sm",
      onClick: () => onHighlight(team.key)
    }))), view === 'table' ? /*#__PURE__*/React.createElement(TeamLineupTable, {
      teamKey: team.key,
      numbers: numbers,
      confidence: confidence,
      edited: edited,
      firstServe: isFirstServe,
      onChange: (i, v) => onEditLineup(team.key, i, v)
    }) : /*#__PURE__*/React.createElement(RotationCourt, {
      numbers: numbers,
      confidence: confidence,
      edited: edited,
      firstServe: isFirstServe,
      onChange: (i, v) => onEditLineup(team.key, i, v),
      teamLabel: team.name
    }));
  })));
}
window.StartingSix = StartingSix;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/StartingSix.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/UploadDropzone.jsx
try { (() => {
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function UploadDropzone({
  onAnalyze
}) {
  const {
    Button,
    IconButton,
    SegmentedControl
  } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const [file, setFile] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [outcome, setOutcome] = React.useState('success');
  const inputRef = React.useRef(null);
  const pick = f => {
    if (f) setFile(f);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto',
      width: '100%'
    }
  }, !file ? /*#__PURE__*/React.createElement("div", {
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: e => {
      e.preventDefault();
      setDragOver(false);
      pick(e.dataTransfer.files && e.dataTransfer.files[0]);
    },
    style: {
      border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--border-strong)'}`,
      borderRadius: 'var(--radius-lg)',
      background: dragOver ? 'var(--color-primary-subtle)' : 'var(--color-white)',
      padding: '56px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      transition: 'all var(--duration-base) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--color-primary-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-primary-dark)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Upload, {
    size: 26
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 19,
      color: 'var(--color-text-primary)'
    }
  }, "Trascina qui il referto PDF"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--color-text-secondary)'
    }
  }, "oppure seleziona un file dal computer"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => inputRef.current && inputRef.current.click()
  }, "Seleziona PDF"), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "application/pdf",
    style: {
      display: 'none'
    },
    onChange: e => pick(e.target.files[0])
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-text-secondary)',
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon.FileText, {
    size: 13
  }), " PDF \xB7 elaborazione locale")) : /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--color-white)',
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-danger-subtle)',
      color: 'var(--color-danger)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon.FileText, {
    size: 19
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--color-text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, file.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-text-secondary)'
    }
  }, formatSize(file.size))), /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon.X, {
      size: 16
    }),
    label: "Rimuovi file",
    onClick: () => setFile(null)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
      paddingTop: 4,
      borderTop: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--color-text-secondary)'
    }
  }, "Esito simulato (demo)"), /*#__PURE__*/React.createElement(SegmentedControl, {
    size: "sm",
    options: [{
      value: 'success',
      label: 'Successo'
    }, {
      value: 'error',
      label: 'Errore'
    }],
    value: outcome,
    onChange: setOutcome
  })), /*#__PURE__*/React.createElement(Button, {
    onClick: () => onAnalyze(file, outcome)
  }, "Analizza referto"))));
}
window.UploadDropzone = UploadDropzone;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/UploadDropzone.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/ValidationPanel.jsx
try { (() => {
const CHECK_TARGET_TAB = {
  score: 'services',
  rotation: 'services',
  sequence: 'services',
  lineup: 'lineups',
  confidence: 'lineups'
};
function ValidationPanel({
  set,
  onJump
}) {
  const {
    Card
  } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const bannerMap = {
    validated: {
      label: 'VALIDATO',
      bg: 'var(--color-success-subtle)',
      fg: 'var(--color-success)',
      Icon: Icon.CheckCircle
    },
    review: {
      label: 'DA VERIFICARE',
      bg: 'var(--color-warning-subtle)',
      fg: 'var(--color-warning-hover)',
      Icon: Icon.AlertTriangle
    },
    inconsistent: {
      label: 'INCOERENTE',
      bg: 'var(--color-danger-subtle)',
      fg: 'var(--color-danger)',
      Icon: Icon.AlertCircle
    }
  };
  const banner = bannerMap[set.status] || bannerMap.validated;
  const iconFor = status => status === 'success' ? /*#__PURE__*/React.createElement(Icon.Check, {
    size: 15,
    style: {
      color: 'var(--color-success)'
    }
  }) : status === 'warning' ? /*#__PURE__*/React.createElement(Icon.AlertTriangle, {
    size: 15,
    style: {
      color: 'var(--color-warning-hover)'
    }
  }) : /*#__PURE__*/React.createElement(Icon.AlertCircle, {
    size: 15,
    style: {
      color: 'var(--color-danger)'
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 20px',
      borderRadius: 'var(--radius-lg)',
      background: banner.bg,
      color: banner.fg
    }
  }, /*#__PURE__*/React.createElement(banner.Icon, {
    size: 22
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: '0.03em'
    }
  }, banner.label)), /*#__PURE__*/React.createElement(Card, {
    padding: 0
  }, set.checks.map((c, i) => {
    const clickable = c.status !== 'success';
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      onClick: () => clickable && onJump(CHECK_TARGET_TAB[c.id] || 'services'),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        borderBottom: i < set.checks.length - 1 ? '1px solid var(--border-default)' : 'none',
        cursor: clickable ? 'pointer' : 'default'
      },
      onMouseEnter: e => clickable && (e.currentTarget.style.background = 'var(--neutral-50)'),
      onMouseLeave: e => e.currentTarget.style.background = 'transparent'
    }, iconFor(c.status), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 14,
        color: 'var(--color-text-primary)',
        fontWeight: 500
      }
    }, c.label), clickable && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--color-primary)'
      }
    }, "Vai al dato \u2192"));
  })));
}
window.ValidationPanel = ValidationPanel;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/ValidationPanel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volleyref/mock-data.js
try { (() => {
// Deterministic mock generator for VolleyRef — no backend, replace with real API later.
(function () {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  function simulateSet(finalA, finalB, firstServer, rng) {
    const score = {
      A: 0,
      B: 0
    };
    let server = firstServer;
    let turnStart = {
      A: 0,
      B: 0
    };
    let turnPoints = 0;
    const target = {
      A: finalA,
      B: finalB
    };
    const turns = [];
    let guard = 0;
    while ((score.A !== finalA || score.B !== finalB) && guard < 400) {
      guard++;
      const candidates = ['A', 'B'].filter(t => score[t] < target[t]);
      const winner = candidates.length === 1 ? candidates[0] : candidates[Math.floor(rng() * candidates.length)];
      if (winner === server) {
        score[winner]++;
        turnPoints++;
      } else {
        turns.push({
          team: server,
          points: turnPoints,
          start: {
            ...turnStart
          },
          end: {
            ...score
          }
        });
        server = winner;
        score[winner]++;
        turnStart = {
          ...score
        };
        turnStart[winner] -= 1;
        turnPoints = 1;
      }
    }
    turns.push({
      team: server,
      points: turnPoints,
      start: turnStart,
      end: {
        ...score
      }
    });
    return turns;
  }
  function buildSet(setNumber, teamAKey, teamBKey, lineups, finalA, finalB, firstServer, rng, opts) {
    opts = opts || {};
    const rawTurns = simulateSet(finalA, finalB, firstServer, rng);
    const counters = {
      A: 0,
      B: 0
    };
    const teamKeyOf = {
      A: teamAKey,
      B: teamBKey
    };
    const rows = rawTurns.map((t, i) => {
      counters[t.team]++;
      const n = counters[t.team];
      const offset = t.team === firstServer ? 0 : 5;
      const idx = (n - 1 + offset) % 6;
      const teamKey = teamKeyOf[t.team];
      return {
        id: `s${setNumber}-t${i + 1}`,
        index: i + 1,
        teamKey,
        teamSide: t.team,
        server: lineups[teamKey][idx],
        rotationIndex: idx,
        rotation: ROMAN[idx],
        start: `${t.start.A}\u2013${t.start.B}`,
        end: `${t.end.A}\u2013${t.end.B}`,
        points: t.points,
        confidence: 'high',
        edited: false,
        status: 'validated'
      };
    });
    (opts.lowConfidenceTurnIndexes || []).forEach(i => {
      if (rows[i]) {
        rows[i].confidence = 'low';
        rows[i].status = 'review';
      }
    });
    (opts.editedTurnIndexes || []).forEach(i => {
      if (rows[i]) {
        rows[i].edited = true;
      }
    });
    if (opts.corruptLastEnd && rows.length) {
      // deliberately introduce an inconsistency: last turn end doesn't match final score
      const last = rows[rows.length - 1];
      const parts = last.end.split('\u2013').map(Number);
      if (last.teamSide === 'A') parts[0] -= 1;else parts[1] -= 1;
      last.end = `${parts[0]}\u2013${parts[1]}`;
    }
    const lineupConfidence = {
      [teamAKey]: [0, 0, 0, 0, 0, 0].map(() => 'high'),
      [teamBKey]: [0, 0, 0, 0, 0, 0].map(() => 'high')
    };
    const lineupEdited = {
      [teamAKey]: [false, false, false, false, false, false],
      [teamBKey]: [false, false, false, false, false, false]
    };
    (opts.lowConfidenceLineup || []).forEach(([teamKey, posIdx]) => {
      lineupConfidence[teamKey][posIdx] = 'low';
    });
    (opts.editedLineup || []).forEach(([teamKey, posIdx]) => {
      lineupEdited[teamKey][posIdx] = true;
    });
    let checks = [{
      id: 'score',
      label: 'Punteggio finale coerente',
      status: 'success'
    }, {
      id: 'rotation',
      label: 'Ordine delle rotazioni coerente',
      status: 'success'
    }, {
      id: 'sequence',
      label: 'Sequenza dei servizi coerente',
      status: 'success'
    }, {
      id: 'lineup',
      label: 'Sestetto iniziale completo',
      status: 'success'
    }];
    const lowCount = Object.values(lineupConfidence).flat().filter(c => c === 'low').length + rows.filter(r => r.confidence === 'low').length;
    if (lowCount > 0) {
      checks.push({
        id: 'confidence',
        label: `${lowCount} valori con confidence ridotta`,
        status: 'warning'
      });
    } else {
      checks.push({
        id: 'confidence',
        label: 'Tutti i valori con confidence alta',
        status: 'success'
      });
    }
    if (opts.corruptLastEnd) {
      checks = checks.map(c => c.id === 'score' ? {
        ...c,
        status: 'error',
        label: 'Punteggio finale non coerente con i turni di servizio'
      } : c);
    }
    if (opts.sequenceWarning) {
      checks = checks.map(c => c.id === 'sequence' ? {
        ...c,
        status: 'warning',
        label: 'Sequenza dei servizi da confermare su un turno'
      } : c);
    }
    let status = 'validated';
    if (checks.some(c => c.status === 'error')) status = 'inconsistent';else if (checks.some(c => c.status === 'warning')) status = 'review';
    return {
      number: setNumber,
      teamAKey,
      teamBKey,
      scoreA: finalA,
      scoreB: finalB,
      firstServe: firstServer === 'A' ? teamAKey : teamBKey,
      lineups: {
        [teamAKey]: lineups[teamAKey].slice(),
        [teamBKey]: lineups[teamBKey].slice()
      },
      lineupConfidence,
      lineupEdited,
      serviceTurns: rows,
      checks,
      status
    };
  }
  function buildMatch(id, opts) {
    const rng = mulberry32(opts.seed);
    const sets = opts.sets.map((s, i) => buildSet(i + 1, opts.teamAKey, opts.teamBKey, opts.lineups, s.a, s.b, s.first, rng, s.opts));
    const setsWonA = sets.filter(s => s.scoreA > s.scoreB).length;
    const setsWonB = sets.length - setsWonA;
    let status = 'validated';
    if (sets.some(s => s.status === 'inconsistent')) status = 'inconsistent';else if (sets.some(s => s.status === 'review')) status = 'review';
    return {
      id,
      competition: opts.competition,
      date: opts.date,
      venue: opts.venue,
      teamA: {
        key: opts.teamAKey,
        name: opts.teamAName,
        short: opts.teamAShort
      },
      teamB: {
        key: opts.teamBKey,
        name: opts.teamBName,
        short: opts.teamBShort
      },
      finalScore: {
        a: setsWonA,
        b: setsWonB
      },
      status,
      sets
    };
  }
  const cerea = buildMatch('cerea-rothoblaas', {
    seed: 42,
    competition: 'Serie B — Girone C',
    date: '14 apr 2026',
    venue: 'PalaCerea, Cerea (VR)',
    teamAKey: 'cerea',
    teamAName: 'ISUZU CEREA VR',
    teamAShort: 'Cerea',
    teamBKey: 'rothoblaas',
    teamBName: 'ROTHOBLAAS VOLANO TN',
    teamBShort: 'Rothoblaas',
    lineups: {
      cerea: [2, 5, 3, 8, 14, 9],
      rothoblaas: [14, 9, 3, 4, 15, 17]
    },
    sets: [{
      a: 25,
      b: 27,
      first: 'A',
      opts: {}
    }, {
      a: 19,
      b: 25,
      first: 'B',
      opts: {}
    }, {
      a: 25,
      b: 23,
      first: 'A',
      opts: {}
    }, {
      a: 24,
      b: 26,
      first: 'B',
      opts: {
        lowConfidenceLineup: [['rothoblaas', 2]],
        lowConfidenceTurnIndexes: [6]
      }
    }]
  });
  const sanmarco = buildMatch('sanmarco-vicenza', {
    seed: 7,
    competition: 'Serie C — Girone A',
    date: '3 mag 2026',
    venue: 'Palasport Comunale, San Marco',
    teamAKey: 'sanmarco',
    teamAName: 'PALLAVOLO SAN MARCO',
    teamAShort: 'San Marco',
    teamBKey: 'vicenza',
    teamBName: 'NUOVA EDIL VICENZA',
    teamBShort: 'Vicenza',
    lineups: {
      sanmarco: [7, 11, 4, 9, 2, 15],
      vicenza: [3, 18, 8, 12, 5, 21]
    },
    sets: [{
      a: 25,
      b: 19,
      first: 'A',
      opts: {}
    }, {
      a: 23,
      b: 25,
      first: 'B',
      opts: {
        corruptLastEnd: true,
        sequenceWarning: true
      }
    }, {
      a: 25,
      b: 22,
      first: 'A',
      opts: {}
    }, {
      a: 20,
      b: 25,
      first: 'B',
      opts: {
        lowConfidenceLineup: [['sanmarco', 3], ['vicenza', 1]],
        lowConfidenceTurnIndexes: [2, 9],
        editedTurnIndexes: [4]
      }
    }, {
      a: 15,
      b: 12,
      first: 'A',
      opts: {}
    }]
  });
  window.VR_MOCK = {
    matches: {
      [cerea.id]: cerea,
      [sanmarco.id]: sanmarco
    },
    matchList: [cerea, sanmarco]
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volleyref/mock-data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.EditableValue = __ds_scope.EditableValue;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.ConfidenceIndicator = __ds_scope.ConfidenceIndicator;

__ds_ns.ProgressStep = __ds_scope.ProgressStep;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.ToastProvider = __ds_scope.ToastProvider;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tooltip = __ds_scope.Tooltip;

})();
