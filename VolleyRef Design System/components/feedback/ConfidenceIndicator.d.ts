export interface ConfidenceIndicatorProps {
  level?: 'high' | 'medium' | 'low';
  showWhenHigh?: boolean;
  message?: string;
}
export declare function ConfidenceIndicator(props: ConfidenceIndicatorProps): JSX.Element | null;
