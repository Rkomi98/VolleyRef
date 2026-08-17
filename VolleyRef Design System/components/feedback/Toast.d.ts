export interface ToastProps {
  message: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  tone?: 'default' | 'success' | 'danger';
}
export declare function Toast(props: ToastProps): JSX.Element;
export declare function ToastProvider(props: { children: React.ReactNode }): JSX.Element;
export declare function useToast(): { push: (message: React.ReactNode, opts?: { actionLabel?: string; onAction?: () => void; tone?: string; duration?: number }) => number; dismiss: (id: number) => void };
