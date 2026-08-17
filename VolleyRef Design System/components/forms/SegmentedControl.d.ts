export interface SegmentOption { value: string; label: string; icon?: React.ReactNode; }
export interface SegmentedControlProps {
  options: SegmentOption[];
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
