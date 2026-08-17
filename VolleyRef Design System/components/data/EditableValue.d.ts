export interface EditableValueProps {
  value: string | number;
  onChange?: (value: string | number) => void;
  type?: 'text' | 'number';
  confidence?: 'high' | 'medium' | 'low';
  edited?: boolean;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}
export declare function EditableValue(props: EditableValueProps): JSX.Element;
