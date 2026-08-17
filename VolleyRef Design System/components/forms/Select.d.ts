export interface SelectOption { value: string; label: string; }
export interface SelectProps {
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;
