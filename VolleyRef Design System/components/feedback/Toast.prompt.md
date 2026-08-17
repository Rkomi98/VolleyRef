Bottom-center toast stack with optional inline action — used for the "Valore aggiornato / Annulla" undo pattern after any manual correction.

```jsx
<ToastProvider>
  <App />
</ToastProvider>
// inside a component:
const { push } = useToast();
push('Valore aggiornato', { actionLabel: 'Annulla', onAction: undo });
```
