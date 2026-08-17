export interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
