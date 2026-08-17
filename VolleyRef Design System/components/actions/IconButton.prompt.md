Square icon-only button for toolbars (PDF viewer controls, header actions). Always requires `label` for accessibility/tooltip.

```jsx
<IconButton icon={<ZoomInIcon />} label="Aumenta zoom" onClick={zoomIn} />
<IconButton icon={<EyeIcon />} label="Mostra zone riconosciute" active={showOverlay} onClick={toggleOverlay} />
```

Use `variant="subtle"` for a pre-tinted resting state, `active` for toggle buttons (overlay, panel visibility).
