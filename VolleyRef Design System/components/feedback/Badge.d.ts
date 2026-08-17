export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
