export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
