One row of a vertical processing timeline (connected by a line). Compose a list of these for the "elaborazione referto" simulated pipeline.

```jsx
{steps.map((s, i) => <ProgressStep key={s.id} {...s} isLast={i === steps.length - 1} />)}
```
