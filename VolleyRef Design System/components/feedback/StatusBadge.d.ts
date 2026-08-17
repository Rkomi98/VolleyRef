export interface StatusBadgeProps {
  status?: 'validated' | 'review' | 'inconsistent' | 'processing';
  children?: React.ReactNode;
  size?: 'sm' | 'md';
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
