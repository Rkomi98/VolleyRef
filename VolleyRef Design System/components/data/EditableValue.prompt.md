The core correction primitive: click a value to edit inline, Enter to confirm, Escape to cancel. Shows a confidence dot when unedited, or a "confirmed manually" marker plus a transient "Modificato manualmente" tag right after a change. Used for shirt numbers, scores, servers, rotations — anywhere an extracted value needs to be checkable and fixable.

```jsx
<EditableValue value={player} type="number" confidence="low" onChange={setPlayer} ariaLabel="Posizione I" />
```
