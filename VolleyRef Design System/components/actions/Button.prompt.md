Primary call-to-action control, used for main actions like "Analizza referto" or "Esporta".

```jsx
<Button variant="primary" onClick={handleAnalyze}>Analizza referto</Button>
<Button variant="secondary" icon={<UndoIcon />}>Ripristina dati estratti</Button>
```

Variants: primary (blue, filled — main CTA), secondary (white, bordered), ghost (transparent, for toolbars), danger (red, destructive confirms). Sizes: sm, md, lg. Set `loading` during simulated processing states.
