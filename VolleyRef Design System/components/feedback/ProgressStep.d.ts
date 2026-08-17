export interface ProgressStepProps {
  label: string;
  status?: 'pending' | 'processing' | 'completed' | 'error';
  description?: string;
  isLast?: boolean;
}
export declare function ProgressStep(props: ProgressStepProps): JSX.Element;
